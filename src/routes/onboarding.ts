import { Router } from 'express';
import { Octokit } from 'octokit';
import { z } from 'zod';
import multer from 'multer';
import { DateTime } from 'luxon';
import { uploadMulterFile, s3configProfile, s3 } from '../external/s3';
import {
  PutItemCommand,
  PutItemCommandInput,
  ScanCommand,
  UpdateItemCommand,
  UpdateItemCommandInput,
} from '@aws-sdk/client-dynamodb';
import { configProfile, dynamoDBClient } from '../external/dynamo';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { jwtWithOAuth } from '../middleware';
import { AccessTokenPayloadWithOAuth } from '../types/tokens';
import { postmarkClient } from '../external/postmark';
import {
  IntakeFormImageFilesSchema,
  IntakeFormReposSchema,
  IntakeFormSchema,
} from '../schemas/onboarding';

type Repo = {
  name: string;
  full_name: string;
  githubRepoId: number;
  description: string | null;
  url: string;
  owner: {
    id: number;
    type: string;
    name: string;
    avatar_url: string;
    url: string;
  };
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
};

const getMappedOrgRepo = (
  repo: Awaited<ReturnType<Octokit['rest']['repos']['listForOrg']>>['data'][number],
): Repo => ({
  name: repo.name,
  full_name: repo.full_name,
  githubRepoId: repo.id,
  description: repo.description,
  url: repo.html_url,
  owner: {
    id: repo.owner.id,
    type: repo.owner.type,
    name: repo.owner.login,
    avatar_url: repo.owner.avatar_url,
    url: repo.owner.html_url,
  },
  permissions: repo.permissions,
});

const getMappedRepo = (
  repo: Awaited<ReturnType<Octokit['rest']['repos']['listForAuthenticatedUser']>>['data'][number],
): Repo => ({
  name: repo.name,
  full_name: repo.full_name,
  githubRepoId: repo.id,
  description: repo.description,
  url: repo.html_url,
  owner: {
    id: repo.owner.id,
    type: repo.owner.type,
    name: repo.owner.login,
    avatar_url: repo.owner.avatar_url,
    url: repo.owner.html_url,
  },
  permissions: repo.permissions,
});

type IntakeForm = z.infer<typeof IntakeFormSchema>;

export const onboardingRouter = Router();

const upload = multer();

const createIntakeFormDocForDynamo = (
  formData: IntakeForm,
  timestamp: number,
): PutItemCommandInput => ({
  TableName: configProfile.tables.intakeForm,
  Item: {
    'email-githubHandle': {
      S: `${formData.email}-${formData.githubHandle}`,
    },
    timestamp: {
      N: timestamp.toString(),
    },
    name: { S: formData.name ?? '' },
    email: { S: formData.email },
    notes: { S: formData.notes ?? '' },
    githubHandle: { S: formData.githubHandle },
    shouldGitPOAPDesign: { BOOL: Boolean(formData.shouldGitPOAPDesign) },
    isOneGitPOAPPerRepo: { BOOL: Boolean(formData.isOneGitPOAPPerRepo) },
    repos: {
      L: JSON.parse(formData.repos).map((repo: z.infer<typeof IntakeFormReposSchema>[number]) => ({
        M: {
          full_name: { S: repo.full_name },
          githubRepoId: { S: repo.githubRepoId },
          permissions: {
            M: {
              admin: { BOOL: repo.permissions.admin },
              maintain: { BOOL: repo.permissions.maintain ?? false },
              push: { BOOL: repo.permissions.push },
              triage: { BOOL: repo.permissions.triage ?? false },
              pull: { BOOL: repo.permissions.pull },
            },
          },
        },
      })),
    },
    isComplete: { BOOL: false },
  },
});

const createUpdateItemParamsForImages = (
  key: string,
  timestamp: number,
  imageUrls: string[],
): UpdateItemCommandInput => {
  return {
    TableName: configProfile.tables.intakeForm,
    Key: {
      'email-githubHandle': { S: key },
      timestamp: { N: timestamp.toString() },
    },
    UpdateExpression: 'set images = :images',
    ExpressionAttributeValues: {
      ':images': {
        L: imageUrls.map(url => ({ S: url })),
      },
    },
    ReturnValues: 'UPDATED_NEW',
  };
};

const sendConfirmationEmail = async (
  formData: IntakeForm,
  to: string,
  queueNumber: number | undefined,
) => {
  postmarkClient.sendEmailWithTemplate({
    From: 'team@gitpoap.io',
    To: 'recipient@example.com',
    TemplateAlias: 'welcome-1',
    TemplateModel: {
      product_url: 'gitpoap.io',
      product_name: 'GitPOAP',
      queue_number: queueNumber ?? '',
      email: 'email_Value',
      githubHandle: 'githubHandle_Value',
      repoCount: JSON.parse(formData.repos).length,
      support_email: 'team@gitpoap.io',
      company_name: 'MetaRep Labs Inc',
      company_address: 'One Broadway, Cambridge MA 02142',
      name: 'name_Value',
      action_url: 'action_url_Value',
      login_url: 'login_url_Value',
      username: 'username_Value',
      trial_length: 'trial_length_Value',
      trial_start_date: 'trial_start_date_Value',
      trial_end_date: 'trial_end_date_Value',
      sender_name: 'GitPOAP Team',
      help_url: 'help_url_Value',
    },
  });
};

const sendInternalConfirmationEmail = async (
  formData: IntakeForm,
  queueNumber: number | undefined,
  urls: string[],
) => {
  postmarkClient.sendEmail({
    From: 'team@gitpoap.io',
    To: 'team@gitpoap.io',
    Subject: `New intake form submission from ${formData.githubHandle} / ${formData.email} `,
    TextBody: `
      New intake form submission from ${formData.githubHandle} / ${formData.email}
      Queue number: ${queueNumber ?? ''}
      Name: ${formData.name}
      Email: ${formData.email}
      Notes: ${formData.notes}
      Github Handle: ${formData.githubHandle}
      Should GitPOAP Design: ${formData.shouldGitPOAPDesign}
      Is One GitPOAP Per Repo: ${formData.isOneGitPOAPPerRepo}
      \n
      Repos:
      ${JSON.parse(formData.repos).map(
        (repo: z.infer<typeof IntakeFormReposSchema>[number]) => repo.full_name,
      )}
      \n
      Images:
      ${urls.join('\n')}
      `,
  });
};

onboardingRouter.post<'/intake-form', {}, {}, IntakeForm>(
  '/intake-form',
  jwtWithOAuth(),
  upload.array('images', 5),
  async (req, res) => {
    const logger = createScopedLogger('GET /onboarding/intake-form');
    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    const endTimer = httpRequestDurationSeconds.startTimer('GET', '/onboarding/intake-form');
    const unixTime = DateTime.local().toUnixInteger();
    const intakeFormTable = configProfile.tables.intakeForm;

    logger.info(
      `Request from GitHub handle ${req.body.githubHandle} to onboard via the intake form`,
    );

    /* Validate form data */
    const schemaResult = IntakeFormSchema.safeParse(req.body);
    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    /* Validate repos array */
    const reposSchemaResult = IntakeFormReposSchema.safeParse(JSON.parse(req.body.repos));
    if (!reposSchemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(reposSchemaResult.error.issues)}`,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ issues: reposSchemaResult.error.issues });
    }

    /* Validate image files array */
    const imageSchemaResult = IntakeFormImageFilesSchema.safeParse(req.files);
    if (!imageSchemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(imageSchemaResult.error.issues)}`,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ issues: imageSchemaResult.error.issues });
    }

    /* Push results to Dynamo DB */
    try {
      const params = createIntakeFormDocForDynamo(req.body, unixTime);
      await dynamoDBClient.send(new PutItemCommand(params));
      logger.info(
        `Submitted intake form for GitHub user - ${req.body.githubHandle} to DynamoDB table ${intakeFormTable}`,
      );
    } catch (err) {
      logger.error(
        `Received error when pushing new item to DynamoDB table ${intakeFormTable} - ${err} `,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ msg: 'Failed to submit intake form' });
    }

    /* Push images to S3 */
    const images = req.files;
    const urls = [];
    if (images && Array.isArray(images) && images?.length > 0) {
      logger.info(`Found ${images.length} images to upload to S3. Attempting to upload.`);
      for (const [index, image] of images.entries()) {
        try {
          const key = `${unixTime}-${req.body.githubHandle}-${req.body.email}-${index}`;
          await uploadMulterFile(image, s3configProfile.buckets.intakeForm, key);
          /* Get s3 file URL */
          const url = `https://${s3configProfile.buckets.intakeForm}.s3.${s3configProfile.region}.amazonaws.com/${key}`;
          urls.push(url);
          logger.info(
            `Uploaded image ${index + 1} to S3 bucket ${s3configProfile.buckets.intakeForm}`,
          );
        } catch (err) {
          logger.error(`Received error when uploading image to S3 - ${err}`);
          endTimer({ status: 400 });
          return res.status(400).send({ msg: 'Failed to submit intake form assets to S3' });
        }
      }
      logger.info(`Uploaded ${images.length}/${images.length} images to S3.`);

      /* Update new s3 image urls to the dynamo DB record with the associated private key  */
      const updateParams = createUpdateItemParamsForImages(
        `${req.body.email}-${req.body.githubHandle}`,
        unixTime,
        urls,
      );
      try {
        await dynamoDBClient.send(new UpdateItemCommand(updateParams));
        logger.info(
          `Updated DynamoDB table ${intakeFormTable} record with key: ${req.body.githubHandle} with new image URLs`,
        );
      } catch (err) {
        logger.error(`Received error when updating DynamoDB table ${intakeFormTable} - ${err} `);
        endTimer({ status: 400 });
        return res.status(400).send({ msg: 'Failed to submit image URLs to DynamoDB' });
      }
    } else {
      logger.info(`No images found to upload to S3. Skipping S3 upload step.`);
    }

    /* If successful, then dispatch confirmation email to user via PostMark. Also fetch the DynamoDB item count as a proxy for queue number */
    let tableCount = undefined;
    try {
      /* Get the count of all items within the dynamo DB table */
      const dynamoRes = await dynamoDBClient.send(
        new ScanCommand({
          TableName: intakeFormTable,
        }),
      );
      tableCount = dynamoRes.Count;
      logger.info(
        `Retrieved count of all items in DynamoDB table ${intakeFormTable} - ${dynamoRes.Count}`,
      );

      await sendConfirmationEmail(req.body, req.body.email, tableCount);
      logger.info(`Sent confirmation email to ${req.body.email}`);
      await sendInternalConfirmationEmail(req.body, tableCount, urls);
      logger.info(`Sent internal confirmation email to team@gitpoap.io`);
    } catch (err) {
      /* Log error, but don't return error to user. Sending the email is secondary to storing the form data */
      logger.error(`Received error when sending confirmation email to ${req.body.email} - ${err} `);
    }

    logger.info(
      `Successfully submitted intake form for GitHub user - ${req.body.githubHandle} and email - ${req.body.email}`,
    );

    endTimer({ status: 200 });

    /* Return form data, the queue number, and a confirmation message to the user */
    return res.status(200).send({
      formData: req.body,
      queueNumber: tableCount,
      msg: 'Successfully submitted intake form',
    });
  },
);

onboardingRouter.get<'/github/repos', {}, Repo[]>(
  '/github/repos',
  jwtWithOAuth(),
  async function (req, res) {
    const logger = createScopedLogger('GET /onboarding/github/repos');
    const endTimer = httpRequestDurationSeconds.startTimer('GET', '/onboarding/github/repos');

    const token = (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken;
    const octokit = new Octokit({ auth: token });
    const user = await octokit.rest.users.getAuthenticated();

    logger.info(`Fetching repos list for GitHub user ${user.data.login}`);

    /* Fetch list of repos for authenticated user */
    const repos = await octokit.rest.repos.listForAuthenticatedUser({
      type: 'public',
      per_page: 100,
    });

    /* Fetch list of orgs that the user is a member of */
    const orgs = await octokit.rest.orgs.listForUser({
      username: user.data.login,
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
    const mappedOrgRepos: Repo[] = orgsWithRepos
      .map(org => org.data)
      .reduce((acc, repos) => [...acc, ...repos], [])
      .filter(repo => {
        if (repo.fork) return false;
        if (!repo.permissions?.admin && !repo.permissions?.maintain && !repo.permissions?.push)
          return false;

        return true;
      })
      .map(repo => getMappedOrgRepo(repo));

    /* Combine all public repos into one array */
    const mappedRepos: Repo[] = repos.data
      .filter(repo => {
        if (repo.fork) return false;
        if (!repo.permissions?.admin && !repo.permissions?.maintain && !repo.permissions?.push)
          return false;

        return true;
      })
      .map(repo => getMappedRepo(repo));

    /* Combine all repos into one array */
    const allRepos = [...mappedRepos, ...mappedOrgRepos];

    logger.info(`Found ${allRepos.length} applicable repos for GitHub user ${user.data.login}`);
    endTimer({ status: 200 });

    return res.status(200).json(allRepos);
  },
);
