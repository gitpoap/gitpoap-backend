import { Router } from 'express';
import { createScopedLogger } from '../logging';
import { jwtWithOAuth } from '../middleware';
import { getGithubOrganizationAdmins } from '../external/github';
import { UpdateOrganizationSchema } from '../schemas/organizations';
import { context } from '../context';
import { AccessTokenPayloadWithOAuth } from '../types/tokens';
import { httpRequestDurationSeconds } from '../metrics';

export const organizationsRouter = Router();

organizationsRouter.post('/', jwtWithOAuth(), async function (req, res) {
  const logger = createScopedLogger('POST /organizations');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const endRequest = httpRequestDurationSeconds.startTimer();

  const schemaResult = UpdateOrganizationSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    endRequest({ method: 'POST', path: '/organizations', status: 400 });
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
    endRequest({ method: 'POST', path: '/organizations', status: 404 });
    return res.status(404).send({ msg });
  }

  const accessToken = <AccessTokenPayloadWithOAuth>req.user;

  // Ensure that the (GitHub) authenticated member is an admin of the organization
  const members = await getGithubOrganizationAdmins(
    organization.name,
    accessToken.githubOAuthToken,
  );
  if (
    !members
      .map((m: Record<string, { login: string }>) => m.login)
      .includes(accessToken.githubHandle)
  ) {
    logger.warn(
      `Non-member (GitHub handle: ${accessToken.githubHandle} of repo ${organization.name} tried to update its data`,
    );
    endRequest({ method: 'POST', path: '/organizations', status: 401 });
    return res.status(401).send({ msg: `You are not a member of ${organization.name}` });
  }

  await context.prisma.organization.update({
    where: {
      id: req.body.id,
    },
    data: req.body.data,
  });

  logger.debug(`Completed request to update organization id ${req.body.id}'s info`);

  endRequest({ method: 'POST', path: '/organizations', status: 200 });

  return res.status(200).send('UPDATED');
});
