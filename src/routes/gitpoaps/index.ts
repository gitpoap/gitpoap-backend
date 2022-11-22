import {
  CreateGitPOAPClaimsSchema,
  CreateGitPOAPProjectSchema,
  CreateGitPOAPSchema,
  UploadGitPOAPCodesSchema,
} from '../../schemas/gitpoaps';
import { Request, Router } from 'express';
import { z } from 'zod';
import { context } from '../../context';
import { createPOAPEvent } from '../../external/poap';
import { jwtWithAddress, jwtWithAdminAddress, jwtWithAdminOAuth } from '../../middleware/auth';
import multer from 'multer';
import { ClaimStatus, GitPOAPStatus, GitPOAPType } from '@prisma/client';
import { getAccessTokenPayload, getAccessTokenPayloadWithOAuth } from '../../types/authTokens';
import { backloadGithubPullRequestData } from '../../lib/pullRequests';
import {
  createProjectWithGithubRepoIds,
  getOrCreateProjectWithGithubRepoId,
} from '../../lib/projects';
import { upsertRedeemCode } from '../../lib/codes';
import { generatePOAPSecret } from '../../lib/secrets';
import { customGitPOAPsRouter } from './custom';
import { isAddressAnAdmin } from '../../lib/admins';
import { convertContributorsFromSchema, createClaimsForContributors } from '../../lib/gitpoaps';
import { ensureRedeemCodeThreshold } from '../../lib/claims';
import { getRequestLogger } from '../../middleware/loggingAndTiming';
import { GITPOAP_ISSUER_EMAIL } from '../../constants';

export const gitPOAPsRouter = Router();

/* Add more routes for creating Custom GitPOAPs ~ "/gitpoaps/custom" */
gitPOAPsRouter.use('/custom', customGitPOAPsRouter);

const upload = multer();

type CreateGitPOAPReqBody = z.infer<typeof CreateGitPOAPSchema>;

gitPOAPsRouter.post(
  '/',
  jwtWithAdminOAuth(),
  upload.single('image'),
  async function (req: Request<any, any, CreateGitPOAPReqBody>, res) {
    const logger = getRequestLogger(req);

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

    const { githubOAuthToken } = getAccessTokenPayloadWithOAuth(req.user);

    const projectChoice: z.infer<typeof CreateGitPOAPProjectSchema> = JSON.parse(req.body.project);
    const projectSchemaResult = CreateGitPOAPProjectSchema.safeParse(projectChoice);
    if (!projectSchemaResult.success) {
      logger.warn(
        `Missing/invalid fields in the "project" provided JSON in request: ${JSON.stringify(
          projectSchemaResult.error.issues,
        )}`,
      );
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
        return res.status(404).send({ msg });
      }
    } else if ('githubRepoIds' in projectChoice) {
      logger.info(
        `Request to create a new GitPOAP "${req.body.name}" for year ${req.body.year} in Project with Github Repo IDs: ${projectChoice.githubRepoIds}`,
      );
      if (projectChoice.githubRepoIds.length === 1) {
        project = await getOrCreateProjectWithGithubRepoId(
          projectChoice.githubRepoIds[0],
          githubOAuthToken,
        );
      } else {
        project = await createProjectWithGithubRepoIds(
          projectChoice.githubRepoIds,
          githubOAuthToken,
        );
      }
    }

    if (project === null) {
      const msg = `Failed to create a new project.`;
      logger.warn(msg);
      return res.status(400).send({ msg });
    }

    // Create a secret code of the form "[0-9]{6}" that will be used to
    // modify the event and allow minting of POAPs
    const secretCode = generatePOAPSecret();

    const year = parseInt(req.body.year, 10);

    // Call the POAP API to create the event
    const poapInfo = await createPOAPEvent({
      name: req.body.name,
      description: req.body.description,
      start_date: req.body.startDate,
      end_date: req.body.endDate,
      expiry_date: req.body.expiryDate,
      event_url: req.body.eventUrl,
      imageName: req.file.originalname,
      imageBuffer: req.file.buffer,
      secret_code: secretCode,
      email: GITPOAP_ISSUER_EMAIL,
      num_requested_codes: parseInt(req.body.numRequestedCodes, 10),
      city: req.body.city, // optional
      country: req.body.country, // optional
    });
    if (poapInfo === null) {
      logger.error('Failed to create event via POAP API');
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
        isOngoing: req.body.isOngoing === 'true',
        isPRBased: req.body.isPRBased !== 'false',
        isEnabled: req.body.isEnabled !== 'false',
      },
    });

    logger.debug(
      `Completed request to create a new GitPOAP "${req.body.name}" for project ${project.id}`,
    );

    return res.status(201).send('CREATED');
  },
);

gitPOAPsRouter.get('/poap-token-id/:id', async function (req, res) {
  const logger = getRequestLogger(req);

  logger.info(`Request to validate if POAP ID ${req.params.id} is a GitPOAP`);

  const claimData = await context.prisma.claim.findUnique({
    where: {
      poapTokenId: req.params.id,
    },
    select: {
      gitPOAP: {
        select: {
          year: true,
          poapApprovalStatus: true,
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
  if (claimData === null || claimData.gitPOAP.poapApprovalStatus === GitPOAPStatus.DEPRECATED) {
    const msg = `There's no GitPOAP claimed with POAP ID: ${req.params.id}`;
    logger.info(msg);
    return res.status(404).send({ msg });
  }

  const data = {
    year: claimData.gitPOAP.year,
    repos: claimData.gitPOAP.project?.repos.map(repo => ({
      organization: repo.organization.name,
      name: repo.name,
    })),
  };

  logger.debug(`Completed request to validate if POAP ID ${req.params.id} is a GitPOAP`);

  return res.status(200).send(data);
});

gitPOAPsRouter.post(
  '/codes',
  jwtWithAdminAddress(),
  upload.single('codes'),
  async function (req, res) {
    const logger = getRequestLogger(req);

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
          return line.substring(index + 1);
        });
    } catch (err) {
      const msg = `Failed to read uploaded file for codes: ${err}`;
      logger.error(msg);
      return res.status(500).send({ msg });
    }

    for (const code of codes) {
      await upsertRedeemCode(gitPOAPId, code);
    }

    // Move the GitPOAP (back) into the APPROVED state
    await context.prisma.gitPOAP.update({
      where: {
        id: gitPOAPId,
      },
      data: {
        poapApprovalStatus: GitPOAPStatus.APPROVED,
      },
    });

    logger.debug(`Completed request to upload codes for GitPOAP ID ${gitPOAPId}`);

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

    if (gitPOAPData.project !== null) {
      const repos = gitPOAPData.project.repos;
      for (const repo of repos) {
        void backloadGithubPullRequestData(repo.id);
      }
    }
  },
);

gitPOAPsRouter.put('/enable/:id', jwtWithAdminAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  const gitPOAPId = parseInt(req.params.id, 10);

  logger.info(`Admin request to enable GitPOAP ID ${gitPOAPId}`);

  const gitPOAPInfo = await context.prisma.gitPOAP.findUnique({
    where: {
      id: gitPOAPId,
    },
    select: {
      id: true,
      poapApprovalStatus: true,
    },
  });
  if (gitPOAPInfo === null) {
    const msg = `Failed to find GitPOAP with ID ${gitPOAPId}`;
    logger.warn(msg);
    return res.status(404).send({ msg });
  }
  if (gitPOAPInfo.poapApprovalStatus === GitPOAPStatus.DEPRECATED) {
    const msg = `GitPOAP with ID ${gitPOAPId} is deprecated`;
    logger.warn(msg);
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

  return res.status(200).send('ENABLED');
});

gitPOAPsRouter.put('/deprecate/:id', jwtWithAdminAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

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
    return res.status(404).send({ msg });
  }

  await context.prisma.gitPOAP.update({
    where: {
      id: gitPOAPId,
    },
    data: {
      isOngoing: false,
      poapApprovalStatus: GitPOAPStatus.DEPRECATED,
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

  return res.status(200).send('DEPRECATED');
});

gitPOAPsRouter.put('/:gitPOAPId/claims', jwtWithAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  logger.debug(`Body: ${JSON.stringify(req.body)}, Params: ${JSON.stringify(req.params)}`);

  const gitPOAPId = parseInt(req.params.gitPOAPId, 10);

  logger.info(`Request to create new Claims for GitPOAP ID ${gitPOAPId}`);

  const schemaResult = CreateGitPOAPClaimsSchema.safeParse(req.body);

  if (!schemaResult.success) {
    logger.warn(
      `Missing/invalid body fields in request: ${JSON.stringify(schemaResult.error.issues)}`,
    );
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  const { contributors } = schemaResult.data;

  const gitPOAP = await context.prisma.gitPOAP.findUnique({
    where: { id: gitPOAPId },
    select: {
      creatorAddressId: true,
      id: true,
      isOngoing: true,
      poapApprovalStatus: true,
      poapEventId: true,
      poapSecret: true,
      type: true,
    },
  });

  const { addressId, address } = getAccessTokenPayload(req.user);

  if (gitPOAP === null) {
    logger.warn(
      `Address ${address} tried to create claims for nonexistant GitPOAP ID ${gitPOAPId}`,
    );
    return res.status(404).send({ msg: "Request doesn't exist" });
  }

  if (gitPOAP.type === GitPOAPType.CUSTOM) {
    if (gitPOAP.creatorAddressId !== addressId) {
      logger.warn(`Non-creator ${address} tried to add claims to Custom GitPOAP ID ${gitPOAPId}`);
      return res.status(401).send({ msg: 'Not GitPOAP owner' });
    }
  } else {
    if (!isAddressAnAdmin(address)) {
      logger.warn(`Non-admin ${address} tried to add claims to non-Custom GitPOAP ID ${gitPOAPId}`);
      return res.status(401).send({ msg: 'Not authorized to create Claims' });
    }
  }

  const claimsCount = createClaimsForContributors(
    gitPOAPId,
    convertContributorsFromSchema(contributors),
  );

  logger.info(`Created ${claimsCount} Claims for GitPOAP with ID: ${gitPOAPId}`);

  // Run in background
  void ensureRedeemCodeThreshold(gitPOAP);

  logger.debug(`Completed request to create new Claims for GitPOAP ID ${gitPOAPId}`);

  return res.status(200).send('CREATED');
});
