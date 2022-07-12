import { Router } from 'express';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { jwtWithAdminOAuth } from '../middleware';
import { AddReposSchema } from '../schemas/projects';
import { createRepoByGithubId } from '../lib/repos';
import { context } from '../context';
import { AccessTokenPayloadWithOAuth } from '../types/tokens';

export const projectsRouter = Router();

projectsRouter.post('/add-repos', jwtWithAdminOAuth(), async (req, res) => {
  const logger = createScopedLogger('POST /projects/add-repos');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('POST', '/projects/add-repos');

  const schemaResult = AddReposSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endTimer({ status: 400 });
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(
    `Request to add GitHub Repo IDs ${req.body.githubRepoIds} to Project ID ${req.body.projectId}`,
  );

  const project = await context.prisma.project.findUnique({
    where: {
      id: req.body.projectId,
    },
    select: {
      id: true,
    },
  });
  if (project === null) {
    const msg = `Project with ID ${req.body.projectId} does not exist!`;
    logger.warn(msg);
    endTimer({ status: 404 });
    return res.status(404).send({ msg });
  }

  let failures: number[] = [];
  for (const githubRepoId of req.body.githubRepoIds) {
    const repo = await createRepoByGithubId(
      githubRepoId,
      project.id,
      (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken,
    );
    if (repo === null) {
      failures.push(githubRepoId);
    }
  }

  if (failures.length > 0) {
    const msg = `Failed to add GitHub Repo IDs ${failures} to Project ID ${project.id}`;
    logger.warn(msg);
    endTimer({ status: 500 });
    return res.status(500).send({ msg });
  }

  logger.debug(
    `Completed request to add GitHub Repo IDs ${req.body.githubRepoIds} to Project ID ${project.id}`,
  );

  endTimer({ status: 200 });

  return res.status(200).send('ADDED');
});
