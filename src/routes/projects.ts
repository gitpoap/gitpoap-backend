import { AddProjectSchema } from '../schemas/projects';
import { Router } from 'express';
import fetch from 'cross-fetch';
import { context } from '../context';
import { getGithubRepository } from '../github';
import { AccessTokenPayloadWithOAuth } from '../types';
import { jwtWithOAuth } from '../middleware';

export const projectsRouter = Router();

projectsRouter.post('/', jwtWithOAuth(), async function (req, res) {
  const schemaResult = AddProjectSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  console.log(`Received request to add ${req.body.organization}/${req.body.repository}`);

  const repoInfo = await getGithubRepository(
    req.body.organization,
    req.body.repository,
    (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken,
  );
  if (repoInfo === null) {
    return res.status(400).send({
      message: 'Failed to lookup repository on GitHub',
    });
  }

  console.log(`Adding Org with githubId: ${repoInfo.owner.id} and name: ${repoInfo.owner.login}`);

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
    console.log(`Repo with githubId: ${repoInfo.id} and name: ${repoInfo.name} already exists`);

    return res.status(200).send('ALREADY EXISTS');
  }

  console.log(`Creating Repo with githubId: ${repoInfo.id} and name: ${repoInfo.name}`);

  await context.prisma.repo.create({
    data: {
      githubRepoId: repoInfo.id,
      name: repoInfo.name,
      organizationId: org.id,
    },
  });

  return res.status(201).send('CREATED');
});
