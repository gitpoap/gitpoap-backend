import { Router } from 'express';
import multer from 'multer';
import { DateTime } from 'luxon';
import { uploadMulterFile, s3configProfile, getS3URL } from '../../external/s3';
import {
  PutItemCommand,
  ScanCommand,
  ScanCommandInput,
  UpdateItemCommand,
} from '@aws-sdk/client-dynamodb';
import { configProfile, dynamoDBClient } from '../../external/dynamo';
import { jwtWithGithub } from '../../middleware/auth';
import { sendConfirmationEmail, sendInternalConfirmationEmail } from '../../external/postmark';
import { getOAuthAppOctokit } from '../../external/github';
import { getAccessTokenPayloadWithGithub } from '../../types/authTokens';
import {
  IntakeFormImageFilesSchema,
  IntakeFormReposSchema,
  IntakeFormSchema,
} from '../../schemas/onboarding';
import { APIResponseData, IntakeForm, PullRequestsRes, Repo } from './types';
import { getMappedOrgRepo, getMappedPrRepo, getMappedRepo } from './utils';
import { publicPRsQuery } from './queries';
import { createIntakeFormDocForDynamo, createUpdateItemParamsForImages } from './dynamo';
import { getRequestLogger } from '../../middleware/loggingAndTiming';
import { sendInternalOnboardingMessage } from '../../external/slack';

export const onboardingRouter = Router();

const upload = multer();

onboardingRouter.post<'/intake-form', any, any, IntakeForm>(
  '/intake-form',
  jwtWithGithub(),
  upload.array('images', 5),
  async (req, res) => {
    const logger = getRequestLogger(req);

    const {
      github: { githubHandle },
    } = getAccessTokenPayloadWithGithub(req.user);
    const unixTime = DateTime.local().toUnixInteger();
    const intakeFormTable = configProfile.tables.intakeForm;

    logger.info(`Request from GitHub handle ${githubHandle} to onboard via the intake form`);

    /* Validate form data */
    const schemaResult = IntakeFormSchema.safeParse(req.body);
    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    /* Validate repos array */
    const reposSchemaResult = IntakeFormReposSchema.safeParse(JSON.parse(req.body.repos));
    if (!reposSchemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(reposSchemaResult.error.issues)}`,
      );
      return res.status(400).send({ issues: reposSchemaResult.error.issues });
    }

    /* Validate image files array */
    const imageSchemaResult = IntakeFormImageFilesSchema.safeParse(req.files);
    if (!imageSchemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(imageSchemaResult.error.issues)}`,
      );
      return res.status(400).send({ issues: imageSchemaResult.error.issues });
    }

    /* Push results to Dynamo DB */
    try {
      const params = createIntakeFormDocForDynamo(githubHandle, req.body, unixTime);
      await dynamoDBClient.send(new PutItemCommand(params));
      logger.info(
        `Submitted intake form for GitHub user - ${githubHandle} to DynamoDB table ${intakeFormTable}`,
      );
    } catch (err) {
      logger.error(
        `Received error when pushing new item to DynamoDB table ${intakeFormTable} - ${err} `,
      );
      return res.status(400).send({ msg: 'Failed to submit intake form' });
    }

    /* Push images to S3 */
    const images = req.files;
    const urls = [];
    if (images && Array.isArray(images) && images?.length > 0) {
      logger.info(`Found ${images.length} images to upload to S3. Attempting to upload.`);
      for (const [index, image] of images.entries()) {
        try {
          const key = `${unixTime}-${githubHandle}-${req.body.email}-${index}`;
          await uploadMulterFile(image, s3configProfile.buckets.intakeForm, key);
          /* Get s3 file URL */
          const url = getS3URL(s3configProfile.buckets.intakeForm, key);
          urls.push(url);
          logger.info(
            `Uploaded image ${index + 1} to S3 bucket ${s3configProfile.buckets.intakeForm}`,
          );
        } catch (err) {
          logger.error(`Received error when uploading image to S3 - ${err}`);
          return res.status(400).send({ msg: 'Failed to submit intake form assets to S3' });
        }
      }
      logger.info(`Uploaded ${images.length}/${images.length} images to S3.`);

      /* Update new s3 image urls to the dynamo DB record with the associated private key  */
      const updateParams = createUpdateItemParamsForImages(
        `${req.body.email}-${githubHandle}`,
        githubHandle,
        unixTime,
        urls,
      );
      try {
        await dynamoDBClient.send(new UpdateItemCommand(updateParams));
        logger.info(
          `Updated DynamoDB table ${intakeFormTable} record with key: ${githubHandle} with new image URLs`,
        );
      } catch (err) {
        logger.error(`Received error when updating DynamoDB table ${intakeFormTable} - ${err} `);
        return res.status(400).send({ msg: 'Failed to submit image URLs to DynamoDB' });
      }
    } else {
      logger.info(`No images found to upload to S3. Skipping S3 upload step.`);
    }

    /* If successful, then dispatch confirmation email to user via PostMark. Also fetch the DynamoDB item count as a proxy for queue number */
    let tableCount = undefined;
    try {
      /* Get the count of all items within the dynamoDB table with isComplete = false */
      const params: ScanCommandInput = {
        Select: 'COUNT',
        TableName: intakeFormTable,
        FilterExpression: 'isComplete = :isComplete',
        ExpressionAttributeValues: {
          ':isComplete': { BOOL: false },
        },
      };

      const dynamoRes = await dynamoDBClient.send(new ScanCommand(params));
      tableCount = dynamoRes.Count;

      logger.info(
        `Retrieved count of all incomplete records in DynamoDB table ${intakeFormTable} - Count: ${tableCount}`,
      );
      logger.info('Sending internal and external confirmation emails');
      void sendConfirmationEmail(githubHandle, req.body, tableCount);
      void sendInternalConfirmationEmail(githubHandle, req.body, tableCount, urls);
    } catch (err) {
      /* Log error, but don't return error to user. Sending the email is secondary to storing the form data */
      logger.error(`Received error when sending confirmation email to ${req.body.email} - ${err} `);
    }

    /* Send message to slack */
    void sendInternalOnboardingMessage(
      githubHandle,
      req.body,
      reposSchemaResult.data.map(repoData => repoData.full_name),
    );

    logger.info(
      `Successfully submitted intake form for GitHub user - ${githubHandle} and email - ${req.body.email}`,
    );

    /* Return form data, the queue number, and a confirmation message to the user */
    return res.status(200).send({
      formData: req.body,
      queueNumber: tableCount,
      msg: 'Successfully submitted intake form',
    });
  },
);

onboardingRouter.get<'/github/repos', any, APIResponseData<Repo[]>>(
  '/github/repos',
  jwtWithGithub(),
  async function (req, res) {
    const logger = getRequestLogger(req);

    const {
      github: { githubHandle },
    } = getAccessTokenPayloadWithGithub(req.user);

    const octokit = getOAuthAppOctokit();

    logger.info(`Fetching repos lists for GitHub user ${githubHandle}`);

    const foundRepoIds = new Set<number>();
    const rejectedRepoIds = new Set<number>();

    let mappedPrRepos: Repo[] = [];
    let mappedRepos: Repo[] = [];
    let mappedOrgRepos: Repo[] = [];

    try {
      /* Fetch first 100 public PRs for a user */
      const publicPrs = await octokit.graphql<PullRequestsRes>(publicPRsQuery(githubHandle));

      const uniquePrRepos = publicPrs.search.edges.filter(repo => {
        /* Do NOT filter out repos based on stars */
        if (repo.node.repository.isFork) {
          rejectedRepoIds.add(repo.node.repository.databaseId);
          return false;
        }
        const isFound = foundRepoIds.has(repo.node.repository.databaseId);
        foundRepoIds.add(repo.node.repository.databaseId);

        return !isFound;
      });

      mappedPrRepos = uniquePrRepos.map((pr): Repo => getMappedPrRepo(pr));
      logger.debug(`Found ${mappedPrRepos.length} unique PR-related repos`);

      /* Fetch list of repos for authenticated user */
      const repos = await octokit.rest.repos.listForAuthenticatedUser({
        type: 'public',
        per_page: 100,
      });

      /* Fetch list of orgs that the user is a member of */
      const orgs = await octokit.rest.orgs.listForUser({
        username: githubHandle,
        per_page: 100,
      });

      /* Fetch list of repos for each org the user is a member of */
      const orgsWithRepos = await Promise.all(
        orgs.data.map(
          async org =>
            await octokit.rest.repos.listForOrg({
              org: org.login,
              per_page: 100,
            }),
        ),
      );

      /* Combine all org repos into one array */
      mappedOrgRepos = orgsWithRepos
        .map(org => org.data)
        .reduce((acc, repos) => [...acc, ...repos], [])
        .filter(repo => {
          const isFound = foundRepoIds.has(repo.id);
          foundRepoIds.add(repo.id);
          if (isFound) {
            return false;
          } else if (repo.fork) {
            rejectedRepoIds.add(repo.id);
            return false;
          } else if (!repo.stargazers_count || repo.stargazers_count < 2) {
            rejectedRepoIds.add(repo.id);
            return false;
          }
          const hasPermission =
            repo.permissions?.admin || repo.permissions?.maintain || repo.permissions?.push;
          return hasPermission;
        })
        .map(repo => getMappedOrgRepo(repo));

      /* Combine all public repos into one array */
      mappedRepos = repos.data
        .filter(repo => {
          const isFound = foundRepoIds.has(repo.id);
          foundRepoIds.add(repo.id);
          if (isFound) {
            return false;
          } else if (repo.fork) {
            rejectedRepoIds.add(repo.id);
            return false;
          } else if (!repo.stargazers_count || repo.stargazers_count < 2) {
            rejectedRepoIds.add(repo.id);
            return false;
          }
          const hasPermission =
            repo.permissions?.admin || repo.permissions?.maintain || repo.permissions?.push;
          return hasPermission;
        })
        .map(repo => getMappedRepo(repo));
    } catch (error) {
      logger.error(`Received error when fetching repos for GitHub user - ${error}`);
      return res.status(400).send({ message: 'Failed to fetch repos for GitHub user' });
    }

    /* Combine all repos into one array */
    const allRepos = [...mappedRepos, ...mappedOrgRepos, ...mappedPrRepos];

    logger.info(
      `Found ${allRepos.length} total applicable repos for GitHub user ${githubHandle}. Rejected ${rejectedRepoIds.size} repos.`,
    );

    /* Return status 200 and set a stale-while-revalidate cache-control header */
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=1800');
    return res.status(200).json(allRepos);
  },
);
