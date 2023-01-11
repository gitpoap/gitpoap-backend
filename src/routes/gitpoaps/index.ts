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
import { jwtWithAddress, jwtWithStaffAddress, jwtWithStaffOAuth } from '../../middleware/auth';
import multer from 'multer';
import { ClaimStatus, GitPOAPStatus, GitPOAPType } from '@prisma/client';
import {
  getAccessTokenPayload,
  getAccessTokenPayloadWithGithubOAuth,
} from '../../types/authTokens';
import { backloadGithubPullRequestData } from '../../lib/pullRequests';
import {
  createProjectWithGithubRepoIds,
  getOrCreateProjectWithGithubRepoId,
} from '../../lib/projects';
import { upsertRedeemCode } from '../../lib/codes';
import { generatePOAPSecret } from '../../lib/secrets';
import { customGitPOAPsRouter } from './custom';
import { isAddressAStaffMember } from '../../lib/staff';
import {
  chooseGitPOAPDates,
  convertContributorsFromSchema,
  createClaimsForContributors,
} from '../../lib/gitpoaps';
import { ensureRedeemCodeThreshold } from '../../lib/claims';
import { getRequestLogger } from '../../middleware/loggingAndTiming';
import { GITPOAP_ISSUER_EMAIL, POAP_DATE_FORMAT } from '../../constants';

export const gitPOAPsRouter = Router();

/* Add more routes for creating Custom GitPOAPs ~ "/gitpoaps/custom" */
gitPOAPsRouter.use('/custom', customGitPOAPsRouter);

const upload = multer();

type CreateGitPOAPReqBody = z.infer<typeof CreateGitPOAPSchema>;

gitPOAPsRouter.post(
  '/',
  jwtWithStaffOAuth(),
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

    const { githubOAuthToken } = getAccessTokenPayloadWithGithubOAuth(req.user);

    const canRequestMoreCodes = schemaResult.data.isOngoing === 'true';

    const projectChoice: z.infer<typeof CreateGitPOAPProjectSchema> = JSON.parse(
      schemaResult.data.project,
    );
    const projectSchemaResult = CreateGitPOAPProjectSchema.safeParse(projectChoice);
    if (!projectSchemaResult.success) {
      logger.warn(
        `Missing/invalid fields in the "project" provided JSON in request: ${JSON.stringify(
          projectSchemaResult.error.issues,
        )}`,
      );
      return res.status(400).send({ issues: projectSchemaResult.error.issues });
    }

    const name = schemaResult.data.name;
    const year = parseInt(schemaResult.data.year, 10);

    let project: { id: number } | null = null;
    if ('projectId' in projectChoice && projectChoice.projectId) {
      logger.info(
        `Request to create a new GitPOAP "${name}" for year ${year} in Project ID ${projectChoice.projectId}`,
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
        `Request to create a new GitPOAP "${name}" for year ${year} in Project with Github Repo IDs: ${projectChoice.githubRepoIds}`,
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

    const { startDate, endDate, expiryDate } = chooseGitPOAPDates(year);

    // Create a secret code of the form "[0-9]{6}" that will be used to
    // modify the event and allow minting of POAPs
    const secretCode = generatePOAPSecret();

    // Call the POAP API to create the event
    const poapInfo = await createPOAPEvent({
      name,
      description: schemaResult.data.description,
      start_date: startDate.toFormat(POAP_DATE_FORMAT),
      end_date: endDate.toFormat(POAP_DATE_FORMAT),
      expiry_date: expiryDate.toFormat(POAP_DATE_FORMAT),
      event_url: schemaResult.data.eventUrl,
      imageName: req.file.originalname,
      imageBuffer: req.file.buffer,
      secret_code: secretCode,
      email: GITPOAP_ISSUER_EMAIL,
      num_requested_codes: parseInt(schemaResult.data.numRequestedCodes, 10),
      city: schemaResult.data.city, // optional
      country: schemaResult.data.country, // optional
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
        canRequestMoreCodes,
        isPRBased: schemaResult.data.isPRBased !== 'false',
        isEnabled: schemaResult.data.isEnabled !== 'false',
      },
    });

    logger.debug(
      `Completed request to create a new GitPOAP "${schemaResult.data.name}" for project ${project.id}`,
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
  jwtWithStaffAddress(),
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

    const gitPOAPId = parseInt(schemaResult.data.id, 10);

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

gitPOAPsRouter.put('/enable/:id', jwtWithStaffAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  const gitPOAPId = parseInt(req.params.id, 10);

  logger.info(`Staff request to enable GitPOAP ID ${gitPOAPId}`);

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

  logger.debug(`Completed staff request to enable GitPOAP ID ${gitPOAPId}`);

  return res.status(200).send('ENABLED');
});

gitPOAPsRouter.put('/deprecate/:id', jwtWithStaffAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

  const gitPOAPId = parseInt(req.params.id, 10);

  logger.info(`Staff request to deprecate GitPOAP ID ${gitPOAPId}`);

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
      canRequestMoreCodes: false,
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

  logger.debug(`Completed staff request to deprecate GitPOAP ID ${gitPOAPId}`);

  return res.status(200).send('DEPRECATED');
});

gitPOAPsRouter.put('/:gitPOAPId/claims', jwtWithAddress(), async (req, res) => {
  const logger = getRequestLogger(req);

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
      canRequestMoreCodes: true,
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
    if (!isAddressAStaffMember(address)) {
      logger.warn(`Non-staff ${address} tried to add claims to non-Custom GitPOAP ID ${gitPOAPId}`);
      return res.status(401).send({ msg: 'Not authorized to create Claims' });
    }
  }

  const claimsCount = await createClaimsForContributors(
    gitPOAPId,
    convertContributorsFromSchema(contributors),
  );

  logger.info(`Created ${claimsCount} Claims for GitPOAP with ID: ${gitPOAPId}`);

  // Run in background
  void ensureRedeemCodeThreshold(gitPOAP);

  logger.debug(`Completed request to create new Claims for GitPOAP ID ${gitPOAPId}`);

  return res.status(200).send('CREATED');
});
