import { Router } from 'express';
import { Octokit } from 'octokit';
import { z } from 'zod';
import { PutItemCommand, PutItemCommandInput } from '@aws-sdk/client-dynamodb';
import { configProfile, dynamoDBClient } from '../external/dynamo';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { jwtWithOAuth } from '../middleware';
import { AccessTokenPayloadWithOAuth } from '../types/tokens';
import { sendEmail } from '../external/postmark';

type Repo = {
  name: string;
  full_name: string;
  githubRepoId: number;
  description: string | null;
  owner: {
    id: number;
    type: string;
    name: string;
    avatar_url: string;
    url: string;
  };
  permissions?: {
    admin: boolean;
    maintain?: boolean;
    push: boolean;
    triage?: boolean;
    pull: boolean;
  };
};

const IntakeFormSchema = z.object({
  name: z.string(),
  email: z.string(),
  notes: z.string(),
  githubHandle: z.string(),
  shouldGitPOAPDesign: z.boolean(),
  isOneGitPOAPPerRepo: z.boolean(),
  repos: z.array(
    z.object({
      full_name: z.string(),
      githubRepoId: z.string(),
      permissions: z.object({
        admin: z.boolean(),
        maintain: z.boolean().optional(),
        push: z.boolean(),
        triage: z.boolean().optional(),
        pull: z.boolean(),
      }),
    }),
  ),
});

type IntakeForm = z.infer<typeof IntakeFormSchema>;

export const onboardingRouter = Router();
const createIntakeFormDocForDynamo = (formData: IntakeForm): PutItemCommandInput => ({
  TableName: configProfile.tables.intakeForm,
  Item: {
    name: { S: formData.name },
    email: { S: formData.email },
    notes: { S: formData.notes },
    githubHandle: { S: formData.githubHandle },
    shouldGitPOAPDesign: { BOOL: formData.shouldGitPOAPDesign },
    isOneGitPOAPPerRepo: { BOOL: formData.isOneGitPOAPPerRepo },
    repos: {
      L: formData.repos.map(repo => ({
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
    timestamp: { S: new Date().toISOString() },
  },
});

onboardingRouter.post<'/intake-form', {}, {}, IntakeForm>(
  '/intake-form',
  jwtWithOAuth(),
  async (req, res) => {
    const logger = createScopedLogger('GET /onboarding/intake-form');
    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    const endTimer = httpRequestDurationSeconds.startTimer('GET', '/onboarding/intake-form');

    logger.info(
      `Request from GitHub handle ${req.body.githubHandle} to onboard via the intake form`,
    );

    const schemaResult = IntakeFormSchema.safeParse(req.body);
    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ issues: schemaResult.error.issues });
    }

    /* Push results to Dynamo DB */
    try {
      const params = createIntakeFormDocForDynamo(req.body);
      await dynamoDBClient.send(new PutItemCommand(params));
      logger.info(`Successfully submitted intake form for GitHub user - ${req.body.githubHandle}.`);
    } catch (err) {
      logger.error(
        `Received error when pushing new item to dynamoDB table ${configProfile.tables.intakeForm} - ${err} `,
      );
      return res.status(400).send({ msg: 'Failed to submit intake form' });
    }

    /* If successful, then dispatch confirmation email to user via PostMark */
    try {
      const emailResponse = await sendEmail({
        From: 'jay@gitpoap.io',
        To: req.body.email,
        Subject: 'GitPoap - Thank you for your interest in GitPoap',
        HtmlBody: `<p>Thank you for your interest in GitPoap. We will be in touch soon!</p>`,
      });

      /* @TODO: IMPORTANT: send over a copy of the information that was submitted */
      /* @TODO: IMPORTANT: send over their # in the queue */
      logger.info(`Successfully sent email to ${req.body.email}`);
    } catch (err) {
      /* Log error, but don't return error to user. Sending the email is secondary to storing the form data */
      logger.error(`Received error when sending email to ${req.body.email} - ${err} `);
    }

    return res.status(201).send('CREATED');
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

    const repos = await octokit.rest.repos.listForAuthenticatedUser({
      type: 'public',
      per_page: 100,
    });

    const mappedRepos: Repo[] = repos.data
      .filter(repo => {
        /* No forks */
        if (repo.fork) {
          return false;
        }

        /* Must have at least one of these permissions */
        if (!repo.permissions?.admin && !repo.permissions?.maintain && !repo.permissions?.push) {
          return false;
        }

        return true;
      })
      .map(repo => {
        return {
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
        };
      });

    logger.info(`Found ${mappedRepos.length} applicable repos for GitHub user ${user.data.login}`);

    endTimer({ status: 200 });

    return res.status(200).json(mappedRepos);
  },
);
