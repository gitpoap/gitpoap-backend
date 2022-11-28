import { Router } from 'express';
import { jwtWithAdminAddress, jwtWithAdminOAuth } from '../middleware/auth';
import { AddReposSchema } from '../schemas/projects';
import { createRepoByGithubId } from '../lib/repos';
import { context } from '../context';
import { getAccessTokenPayloadWithGithubOAuth } from '../types/authTokens';
import { backloadGithubPullRequestData } from '../lib/pullRequests';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const projectsRouter = Router();

projectsRouter.post('/add-repos', jwtWithAdminOAuth(), async (req, res) => {
  const logger = getRequestLogger(req);

  const schemaResult = AddReposSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { githubOAuthToken } = getAccessTokenPayloadWithGithubOAuth(req.user);

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
    return res.status(404).send({ msg });
  }

  const addedIds: number[] = [];
  const failures: number[] = [];
  for (const githubRepoId of req.body.githubRepoIds) {
    const repo = await createRepoByGithubId(githubRepoId, project.id, githubOAuthToken);
    if (repo === null) {
      failures.push(githubRepoId);
    } else {
      addedIds.push(repo.id);
    }
  }

  if (failures.length > 0) {
    const msg = `Failed to add GitHub Repo IDs ${failures} to Project ID ${project.id}`;
    logger.warn(msg);
    return res.status(500).send({ msg });
  }

  logger.debug(
    `Completed request to add GitHub Repo IDs ${req.body.githubRepoIds} to Project ID ${project.id}`,
  );

  res.status(200).send('ADDED');

  // Run backloader in the background so that claims are created immediately
  for (const repoId of addedIds) {
    void backloadGithubPullRequestData(repoId);
  }
});

projectsRouter.put('/enable/:id', jwtWithAdminAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  const projectId = parseInt(req.params.id, 10);

  logger.info(`Admin request to enable all GitPOAPs in Project ID ${projectId}`);

  const projectData = await context.prisma.project.findUnique({
    where: {
      id: projectId,
    },
    select: {
      id: true,
    },
  });
  if (projectData === null) {
    const msg = `Failed to find Project with ID ${projectId}`;
    logger.warn(msg);
    return res.status(404).send({ msg });
  }

  await context.prisma.gitPOAP.updateMany({
    where: {
      projectId,
    },
    data: {
      isEnabled: true,
    },
  });

  logger.debug(`Completed admin request to enable all GitPOAPs in Project ID ${projectId}`);

  return res.status(200).send('ENABLED');
});
