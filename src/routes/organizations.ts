import { Router } from 'express';
import { jwtWithGitHubOAuth } from '../middleware/auth';
import { getGithubOrganizationAdmins } from '../external/github';
import { UpdateOrganizationSchema } from '../schemas/organizations';
import { context } from '../context';
import { getAccessTokenPayloadWithOAuth } from '../types/authTokens';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const organizationsRouter = Router();

organizationsRouter.post('/', jwtWithGitHubOAuth(), async function (req, res) {
  const logger = getRequestLogger(req);

  const schemaResult = UpdateOrganizationSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  logger.info(`Request to update organization id ${req.body.id}'s info`);

  const organization = await context.prisma.organization.findUnique({
    where: {
      id: req.body.id,
    },
    select: {
      name: true,
    },
  });
  if (organization === null) {
    const msg = `Organization with id ${req.body.id} not found`;
    logger.warn(msg);
    return res.status(404).send({ msg });
  }

  const { githubHandle, githubOAuthToken } = getAccessTokenPayloadWithOAuth(req.user);

  // Ensure that the (GitHub) authenticated member is an admin of the organization
  const members = await getGithubOrganizationAdmins(organization.name, githubOAuthToken);
  if (members === null) {
    const msg = `Failed to lookup admins of ${organization.name} via GitHub`;
    logger.warn(msg);
    return res.status(400).send({ msg });
  }
  if (!members.map((m: { login: string }) => m.login).includes(githubHandle)) {
    logger.warn(
      `Non-member (GitHub handle: ${githubHandle} of repo ${organization.name} tried to update its data`,
    );
    return res.status(401).send({ msg: `You are not a member of ${organization.name}` });
  }

  await context.prisma.organization.update({
    where: {
      id: req.body.id,
    },
    data: req.body.data,
  });

  logger.debug(`Completed request to update organization id ${req.body.id}'s info`);

  return res.status(200).send('UPDATED');
});
