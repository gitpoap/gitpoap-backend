import { CreateGitPOAPSchema, UploadGitPOAPCodesSchema } from '../schemas/gitpoaps';
import { Router } from 'express';
import { context } from '../context';
import { createPOAPEvent } from '../external/poap';
import { createScopedLogger } from '../logging';
import { jwtWithAdminOAuth } from '../middleware';
import short from 'short-uuid';
import multer from 'multer';
import { GitPOAPStatus } from '@generated/type-graphql';

export const gitpoapsRouter = Router();

const upload = multer();

gitpoapsRouter.post('/', jwtWithAdminOAuth(), upload.single('image'), async function (req, res) {
  const logger = createScopedLogger('POST /gitpoaps');

  logger.debug(`Body: ${JSON.stringify(req.body)}`);

  const schemaResult = CreateGitPOAPSchema.safeParse(req.body);
  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }
  if (!req.file) {
    const msg = 'Missing/invalid "image" upload in request';
    logger.warn(msg);
    return res.status(400).send({ msg });
  }

  const githubRepoId = parseInt(req.body.githubRepoId, 10);

  logger.info(`Request to create a new GitPOAP "${req.body.name}" for repo ${githubRepoId}`);

  // Lookup the stored info about the repo provided
  const repo = await context.prisma.repo.findUnique({
    where: {
      githubRepoId,
    },
    include: {
      organization: true,
    },
  });

  if (!repo) {
    logger.warn("Repo hasn't been added to GitPOAP");
    return res.status(404).send({
      message: `There is no repo with id: ${githubRepoId}`,
    });
  }

  // Create a secret code of the form "[0-9]{6}" that will be used to
  // modify the event and allow minting of POAPs
  const secretCode = short('0123456789').new().slice(0, 6);

  // Call the POAP API to create the event
  const poapInfo = await createPOAPEvent(
    req.body.name,
    req.body.description,
    req.body.startDate,
    req.body.endDate,
    req.body.expiryDate,
    req.body.year,
    req.body.eventUrl,
    req.file.originalname,
    req.file.buffer,
    secretCode,
    req.body.email,
    req.body.numRequestedCodes,
  );
  if (poapInfo == null) {
    logger.error('Failed to create event via POAP API');
    return res.status(500).send({ msg: 'Failed to create POAP via API' });
  }

  logger.debug(`Created GitPOAP in POAP system: ${JSON.stringify(poapInfo)}`);

  await context.prisma.gitPOAP.create({
    data: {
      year: poapInfo.year,
      poapEventId: poapInfo.id,
      repo: {
        connect: {
          id: repo.id,
        },
      },
      poapSecret: secretCode,
      ongoing: req.body.ongoing,
    },
  });

  logger.debug(
    `Completed request to create a new GitPOAP "${req.body.name}" for repo ${githubRepoId}`,
  );

  return res.status(201).send('CREATED');
});

gitpoapsRouter.post(
  '/codes',
  jwtWithAdminOAuth(),
  upload.single('codes'),
  async function (req, res) {
    const logger = createScopedLogger('POST /gitpoaps/codes');

    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    const schemaResult = UploadGitPOAPCodesSchema.safeParse(req.body);
    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      return res.status(400).send({ issues: schemaResult.error.issues });
    }
    if (!req.file) {
      const msg = 'Missing/invalid "codes" upload in request';
      logger.warn(msg);
      return res.status(400).send({ msg });
    }

    let codes;
    try {
      codes = req.file.buffer
        .toString()
        .trim()
        .split('\n')
        .map((line: string) => {
          const index = line.lastIndexOf('/');
          if (index === -1) {
            const msg = `Expected uploaded codes in the form https://poap.xyz/claim/foobar, got: ${line}`;
            logger.error(msg);
            throw Error(msg);
          }
          return line.substr(index + 1);
        });
    } catch (err) {
      const msg = `Failed to read uploaded file for codes: ${err}`;
      logger.error(msg);
      return res.status(500).send({ msg });
    }

    const gitPOAPId = parseInt(req.body.id, 10);

    await context.prisma.redeemCode.createMany({
      data: codes.map((code: string) => {
        return {
          gitPOAPId,
          code: code,
        };
      }),
    });

    // Move the GitPOAP (back) into the APPROVED state
    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAPId,
      },
      data: {
        status: GitPOAPStatus.APPROVED,
      },
    });

    return res.status(200).send('UPLOADED');
  },
);
