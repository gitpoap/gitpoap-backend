import { Router } from 'express';
import { verify } from 'jsonwebtoken';
import { context } from '../context';
import { RequestAccessTokenSchema, RefreshAccessTokenSchema } from '../schemas/github';
import { RefreshTokenPayload } from '../types/tokens';
import { requestGithubOAuthToken, getGithubCurrentUserInfo } from '../external/github';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { generateAuthTokens, generateNewAuthTokens } from '../lib/authTokens';

export const githubRouter = Router();

githubRouter.post('/', async function (req, res) {
  const logger = createScopedLogger('POST /github');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/github');

  const schemaResult = RequestAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info('Received a GitHub login request');

  let { code } = req.body;

  // Remove state string if it exists
  const andIndex = code.indexOf('&');
  if (andIndex !== -1) {
    code = code.substr(0, andIndex);
  }

  let githubToken: string;
  try {
    githubToken = await requestGithubOAuthToken(code);
  } catch (err) {
    logger.warn(`Failed to request OAuth token with code: ${err}`);
    endTimer({ status: 400 });
    return res.status(400).send({
      message: 'A server error has occurred - GitHub access token exchange',
      error: JSON.parse(err as string),
    });
  }

  const githubUser = await getGithubCurrentUserInfo(githubToken);
  if (githubUser === null) {
    logger.error('Failed to retrieve data about logged in user');
    endTimer({ status: 400 });
    return res.status(400).send({
      message: 'A server error has occurred - GitHub current user',
    });
  }

  const authTokens = await generateNewAuthTokens(githubUser.id, githubUser.login, githubToken);

  logger.debug('Completed a GitHub login request');

  endTimer({ status: 200 });

  return res.status(200).json(authTokens);
});

githubRouter.post('/refresh', async function (req, res) {
  const logger = createScopedLogger('POST /github/refresh');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/github/refresh');

  const schemaResult = RefreshAccessTokenSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info('Request to refresh AuthToken');

  const { token } = req.body;
  let payload: RefreshTokenPayload;
  try {
    payload = <RefreshTokenPayload>verify(token, JWT_SECRET);
  } catch (err) {
    logger.warn('The refresh token is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ message: 'The refresh token is invalid' });
  }

  const authToken = await context.prisma.authToken.findUnique({
    where: {
      id: payload.authTokenId,
    },
    include: {
      user: {
        select: {
          githubHandle: true,
        },
      },
    },
  });

  if (authToken === null) {
    logger.warn('The refresh token is invalid');
    endTimer({ status: 401 });
    return res.status(401).send({ message: 'The refresh token is invalid' });
  }

  // If someone is trying to use an old generation of the refresh token, we must
  // consider the lineage to be tainted, and therefore purge it completely
  // (user will need to log back in via GitHub).
  if (payload.generation !== authToken.generation) {
    logger.warn(`GitHub user ${authToken.githubId} had a refresh token reused.`);

    try {
      await context.prisma.authToken.delete({
        where: {
          id: authToken.id,
        },
      });
    } catch (err) {
      logger.warn(`Tried to delete an AuthToken that was already deleted: ${err}`);
    }

    endTimer({ status: 401 });

    return res.status(401).send({ message: 'The refresh token has already been used' });
  }

  const nextGeneration = authToken.generation + 1;
  await context.prisma.authToken.update({
    where: {
      id: authToken.id,
    },
    data: {
      generation: nextGeneration,
    },
  });

  logger.debug('Completed request to refresh AuthToken');

  endTimer({ status: 200 });

  return res
    .status(200)
    .json(
      generateAuthTokens(
        authToken.id,
        nextGeneration,
        payload.githubId,
        authToken.user.githubHandle,
      ),
    );
});
