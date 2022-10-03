import {
  CreateGitPOAPSchema,
  CreateGitPOAPProjectSchema,
  UploadGitPOAPCodesSchema,
} from '../schemas/gitpoaps';
import { Request, Router } from 'express';
import { z } from 'zod';
import { context } from '../context';
import { createPOAPEvent } from '../external/poap';
import { createScopedLogger } from '../logging';
import { jwtWithAdminOAuth } from '../middleware';
import multer from 'multer';
import { ClaimStatus, GitPOAPStatus } from '@generated/type-graphql';
import { httpRequestDurationSeconds } from '../metrics';
import { AccessTokenPayloadWithOAuth } from '../types/tokens';
import { backloadGithubPullRequestData } from '../lib/pullRequests';
import {
  createProjectWithGithubRepoIds,
  getOrCreateProjectWithGithubRepoId,
} from '../lib/projects';
import { upsertCode } from '../lib/codes';
import { generatePOAPSecret } from '../lib/secrets';

export const gitpoapsRouter = Router();

const upload = multer();

type CreateGitPOAPReqBody = z.infer<typeof CreateGitPOAPSchema>;

gitpoapsRouter.post(
  '/',
  jwtWithAdminOAuth(),
  upload.single('image'),
  async function (req: Request<any, any, CreateGitPOAPReqBody>, res) {
    const logger = createScopedLogger('POST /gitpoaps');

    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    const endTimer = httpRequestDurationSeconds.startTimer('POST', '/gitpoaps');

    const schemaResult = CreateGitPOAPSchema.safeParse(req.body);
    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ issues: schemaResult.error.issues });
    }
    if (!req.file) {
      const msg = 'Missing/invalid "image" upload in request';
      logger.warn(msg);
      endTimer({ status: 400 });
      return res.status(400).send({ msg });
    }

    const projectChoice: z.infer<typeof CreateGitPOAPProjectSchema> = JSON.parse(req.body.project);
    const projectSchemaResult = CreateGitPOAPProjectSchema.safeParse(projectChoice);
    if (!projectSchemaResult.success) {
      logger.warn(
        `Missing/invalid fields in the "project" provided JSON in request: ${JSON.stringify(
          projectSchemaResult.error.issues,
        )}`,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ issues: projectSchemaResult.error.issues });
    }

    let project: { id: number } | null = null;
    if ('projectId' in projectChoice && projectChoice.projectId) {
      logger.info(
        `Request to create a new GitPOAP "${req.body.name}" for year ${req.body.year} in Project ID ${projectChoice.projectId}`,
      );

      project = await context.prisma.project.findUnique({
        where: {
          id: projectChoice.projectId,
        },
        select: {
          id: true,
        },
      });
      if (project === null) {
        const msg = `Failed to find project with id: ${projectChoice.projectId}`;
        logger.warn(msg);
        endTimer({ status: 404 });
        return res.status(404).send({ msg });
      }
    } else if ('githubRepoIds' in projectChoice) {
      logger.info(
        `Request to create a new GitPOAP "${req.body.name}" for year ${req.body.year} in Project with Github Repo IDs: ${projectChoice.githubRepoIds}`,
      );
      if (projectChoice.githubRepoIds.length === 1) {
        project = await getOrCreateProjectWithGithubRepoId(
          projectChoice.githubRepoIds[0],
          (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken,
        );
      } else {
        project = await createProjectWithGithubRepoIds(
          projectChoice.githubRepoIds,
          (<AccessTokenPayloadWithOAuth>req.user).githubOAuthToken,
        );
      }
    }

    if (project === null) {
      const msg = `Failed to create a new project.`;
      logger.warn(msg);
      endTimer({ status: 400 });
      return res.status(400).send({ msg });
    }

    // Create a secret code of the form "[0-9]{6}" that will be used to
    // modify the event and allow minting of POAPs
    const secretCode = generatePOAPSecret();

    const year = parseInt(req.body.year, 10);

    // Call the POAP API to create the event
    const poapInfo = await createPOAPEvent(
      req.body.name,
      req.body.description,
      req.body.startDate,
      req.body.endDate,
      req.body.expiryDate,
      year,
      req.body.eventUrl,
      req.file.originalname,
      req.file.buffer,
      secretCode,
      req.body.email,
      parseInt(req.body.numRequestedCodes, 10),
      req.body.city, // optional
      req.body.country, // optional
    );
    if (poapInfo == null) {
      logger.error('Failed to create event via POAP API');
      endTimer({ status: 500 });
      return res.status(500).send({ msg: 'Failed to create POAP via API' });
    }

    if (poapInfo.year !== year) {
      logger.warn(
        `POAP's returned year (${poapInfo.year}) doesn't equal the one we supplied (${year})`,
      );
    }

    logger.debug(`Created GitPOAP in POAP system: ${JSON.stringify(poapInfo)}`);

    await context.prisma.gitPOAP.create({
      data: {
        name: poapInfo.name,
        imageUrl: poapInfo.image_url,
        description: poapInfo.description,
        year,
        poapEventId: poapInfo.id,
        project: {
          connect: {
            id: project.id,
          },
        },
        poapSecret: secretCode,
        ongoing: req.body.ongoing === 'true',
        isPRBased: req.body.isPRBased !== 'false',
        isEnabled: req.body.isEnabled !== 'false',
      },
    });

    logger.debug(
      `Completed request to create a new GitPOAP "${req.body.name}" for project ${project.id}`,
    );

    endTimer({ status: 201 });
    return res.status(201).send('CREATED');
  },
);

gitpoapsRouter.get('/poap-token-id/:id', async function (req, res) {
  const logger = createScopedLogger('GET /gitpoaps/poap-token-id/:id');

  logger.debug(`Params: ${JSON.stringify(req.params)}`);

  const endTimer = httpRequestDurationSeconds.startTimer('GET', '/gitpoaps/poap-token-id/:id');

  logger.info(`Request to validate if POAP ID ${req.params.id} is a GitPOAP`);

  const claimData = await context.prisma.claim.findUnique({
    where: {
      poapTokenId: req.params.id,
    },
    select: {
      gitPOAP: {
        select: {
          year: true,
          status: true,
          project: {
            select: {
              repos: {
                select: {
                  name: true,
                  organization: {
                    select: {
                      name: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (claimData === null || claimData.gitPOAP.status === GitPOAPStatus.DEPRECATED) {
    const msg = `There's no GitPOAP claimed with POAP ID: ${req.params.id}`;
    logger.info(msg);
    endTimer({ status: 404 });
    return res.status(404).send({ msg });
  }

  const data = {
    year: claimData.gitPOAP.year,
    repos: claimData.gitPOAP.project.repos.map(repo => ({
      organization: repo.organization.name,
      name: repo.name,
    })),
  };

  logger.debug(`Completed request to validate if POAP ID ${req.params.id} is a GitPOAP`);

  endTimer({ status: 200 });

  return res.status(200).send(data);
});

gitpoapsRouter.post(
  '/codes',
  jwtWithAdminOAuth(),
  upload.single('codes'),
  async function (req, res) {
    const logger = createScopedLogger('POST /gitpoaps/codes');

    logger.debug(`Body: ${JSON.stringify(req.body)}`);

    const endTimer = httpRequestDurationSeconds.startTimer('POST', '/gitpoaps/codes');

    const schemaResult = UploadGitPOAPCodesSchema.safeParse(req.body);
    if (!schemaResult.success) {
      logger.warn(
        `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
      );
      endTimer({ status: 400 });
      return res.status(400).send({ issues: schemaResult.error.issues });
    }
    if (!req.file) {
      const msg = 'Missing/invalid "codes" upload in request';
      logger.warn(msg);
      endTimer({ status: 400 });
      return res.status(400).send({ msg });
    }

    const gitPOAPId = parseInt(req.body.id, 10);

    logger.info(`Request to upload codes for GitPOAP ID ${gitPOAPId}`);

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
      endTimer({ status: 500 });
      return res.status(500).send({ msg });
    }

    for (const code of codes) {
      await upsertCode(gitPOAPId, code);
    }

    // Move the GitPOAP (back) into the APPROVED state
    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAPId,
      },
      data: {
        status: GitPOAPStatus.APPROVED,
      },
    });

    logger.debug(`Completed request to upload codes for GitPOAP ID ${gitPOAPId}`);

    endTimer({ status: 200 });

    res.status(200).send('UPLOADED');

    // Run the backloader in the background so that claims are created immediately
    const gitPOAPData = await context.prisma.gitPOAP.findUnique({
      where: {
        id: gitPOAPId,
      },
      select: {
        project: {
          select: {
            repos: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });
    if (gitPOAPData === null) {
      logger.error(`Failed to lookup the Repo ID for GitPOAP ID ${gitPOAPId}`);
      return;
    }

    for (const repo of gitPOAPData.project.repos) {
      backloadGithubPullRequestData(repo.id);
    }
  },
);

gitpoapsRouter.put('/enable/:id', jwtWithAdminOAuth(), async (req, res) => {
  const logger = createScopedLogger('PUT /gitpoaps/enable/:id');

  const endTimer = httpRequestDurationSeconds.startTimer('PUT', '/gitpoaps/enable/:id');

  const gitPOAPId = parseInt(req.params.id, 10);

  logger.info(`Admin request to enable GitPOAP ID ${gitPOAPId}`);

  const gitPOAPInfo = await context.prisma.gitPOAP.findUnique({
    where: {
      id: gitPOAPId,
    },
    select: {
      id: true,
      status: true,
    },
  });
  if (gitPOAPInfo === null) {
    const msg = `Failed to find GitPOAP with ID ${gitPOAPId}`;
    logger.warn(msg);
    endTimer({ status: 404 });
    return res.status(404).send({ msg });
  }
  if (gitPOAPInfo.status === GitPOAPStatus.DEPRECATED) {
    const msg = `GitPOAP with ID ${gitPOAPId} is deprecated`;
    logger.warn(msg);
    endTimer({ status: 400 });
    return res.status(400).send({ msg });
  }

  await context.prisma.gitPOAP.update({
    where: {
      id: gitPOAPId,
    },
    data: {
      isEnabled: true,
    },
  });

  logger.debug(`Completed admin request to enable GitPOAP ID ${gitPOAPId}`);

  endTimer({ status: 200 });

  return res.status(200).send('ENABLED');
});

gitpoapsRouter.put('/deprecate/:id', jwtWithAdminOAuth(), async (req, res) => {
  const logger = createScopedLogger('PUT /gitpoaps/deprecate/:id');

  const endTimer = httpRequestDurationSeconds.startTimer('PUT', '/gitpoaps/deprecate/:id');

  const gitPOAPId = parseInt(req.params.id, 10);

  logger.info(`Admin request to deprecate GitPOAP ID ${gitPOAPId}`);

  const gitPOAPInfo = await context.prisma.gitPOAP.findUnique({
    where: {
      id: gitPOAPId,
    },
    select: {
      id: true,
    },
  });
  if (gitPOAPInfo === null) {
    const msg = `Failed to find GitPOAP with ID ${gitPOAPId}`;
    logger.warn(msg);
    endTimer({ status: 404 });
    return res.status(404).send({ msg });
  }

  await context.prisma.gitPOAP.update({
    where: {
      id: gitPOAPId,
    },
    data: {
      ongoing: false,
      status: GitPOAPStatus.DEPRECATED,
    },
  });

  // Delete all the claims for the GitPOAP that are not claimed yet
  await context.prisma.claim.deleteMany({
    where: {
      gitPOAPId,
      status: ClaimStatus.UNCLAIMED,
    },
  });

  logger.debug(`Completed admin request to deprecate GitPOAP ID ${gitPOAPId}`);

  endTimer({ status: 200 });

  return res.status(200).send('DEPRECATED');
});
