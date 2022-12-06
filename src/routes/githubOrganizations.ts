import { Router } from 'express';
import { jwtWithGitHubOAuth } from '../middleware/auth';
import { getGithubOrganizationAdmins } from '../external/github';
import { UpdateOrganizationSchema } from '../schemas/organizations';
import { context } from '../context';
import { getAccessTokenPayloadWithGithubOAuth } from '../types/authTokens';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const githubOrganizationsRouter = Router();

githubOrganizationsRouter.post('/', jwtWithGitHubOAuth(), async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = UpdateOrganizationSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(`Request to update GithubOrganization id ${req.body.id}'s info`);

  const githubOrganization = await context.prisma.githubOrganization.findUnique({
    where: {
      id: req.body.id,
    },
    select: {
      name: true,
    },
  });
  if (githubOrganization === null) {
    const msg = `Organization with id ${req.body.id} not found`;
    logger.warn(msg);
    return res.status(404).send({ msg });
  }

  const { githubHandle, githubOAuthToken } = getAccessTokenPayloadWithGithubOAuth(req.user);

  // Ensure that the (GitHub) authenticated member is an admin of the GithubOrganization
  const members = await getGithubOrganizationAdmins(githubOrganization.name, githubOAuthToken);
  if (members === null) {
    const msg = `Failed to lookup admins of ${githubOrganization.name} via GitHub`;
    logger.warn(msg);
    return res.status(400).send({ msg });
  }
  if (!members.map((m: { login: string }) => m.login).includes(githubHandle)) {
    logger.warn(
      `Non-member (GitHub handle: ${githubHandle} of repo ${githubOrganization.name} tried to update its data`,
    );
    return res.status(401).send({ msg: `You are not a member of ${githubOrganization.name}` });
  }

  await context.prisma.githubOrganization.update({
    where: {
      id: req.body.id,
    },
    data: req.body.data,
  });

  logger.debug(`Completed request to update GithubOrganization id ${req.body.id}'s info`);

  return res.status(200).send('UPDATED');
});
