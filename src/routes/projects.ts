import { AddProjectSchema } from '../schemas/projects';
import { Router } from 'express';
import fetch from 'cross-fetch';
import { AccessTokenPayloadWithOAuth } from '../types/tokens';
import { jwtWithOAuth } from '../middleware';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { upsertProject } from '../lib/projects';

export const projectsRouter = Router();

projectsRouter.post('/', jwtWithOAuth(), async function (req, res) {
  const logger = createScopedLogger('POST /projects');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/projects');

  const schemaResult = AddProjectSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const repoResult = await upsertProject(
    req.body.organization,
    req.body.repository,
    (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken,
  );

  if (repoResult === null) {
    endTimer({ status: 404 });
    return res.status(404).send('Repository does not exist on GitHub');
  }

  logger.debug(`Completed request to add ${req.body.organization}/${req.body.repository}`);

  endTimer({ status: 201 });

  return res.status(201).send('CREATED');
});
