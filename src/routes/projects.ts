import { AddProjectSchema } from '../schemas/projects';
import { Router } from 'express';
import fetch from 'cross-fetch';
import { context } from '../context';
import { getGithubRepository } from '../external/github';
import { AccessTokenPayloadWithOAuth } from '../types/tokens';
import { jwtWithOAuth } from '../middleware';
import { createScopedLogger } from '../logging';

export const projectsRouter = Router();

projectsRouter.post('/', jwtWithOAuth(), async function (req, res) {
  const logger = createScopedLogger('POST /projects');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const schemaResult = AddProjectSchema.safeParse(req.body);

  if (!schemaResult.success) {
    logger.warn(`Missing/invalid body fields in request: ${schemaResult.error.issues}`);
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(`Request to add ${req.body.organization}/${req.body.repository}`);

  const repoInfo = await getGithubRepository(
    req.body.organization,
    req.body.repository,
    (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken,
  );
  if (repoInfo === null) {
    logger.warn(`Couldn't find ${req.body.organization}/${req.body.repository} on GitHub`);
    return res.status(400).send({
      message: 'Failed to lookup repository on GitHub',
    });
  }

  // Add the org if it doesn't already exist
  const org = await context.prisma.organization.upsert({
    where: {
      githubOrgId: repoInfo.owner.id,
    },
    update: {},
    create: {
      githubOrgId: repoInfo.owner.id,
      name: repoInfo.owner.login,
    },
  });

  // Check to see if we've already created the repo
  const repo = await context.prisma.repo.findUnique({
    where: {
      githubRepoId: repoInfo.id,
    },
  });

  if (repo) {
    logger.warn(`${req.body.organization}/${repoInfo.name} already exists`);
    return res.status(200).send('ALREADY EXISTS');
  }

  await context.prisma.repo.create({
    data: {
      githubRepoId: repoInfo.id,
      name: repoInfo.name,
      organizationId: org.id,
    },
  });

  logger.debug(`Completed request to add ${req.body.organization}/${req.body.repository}`);

  return res.status(201).send('CREATED');
});
