import { ClaimStatus, GitPOAPStatus } from '@generated/type-graphql';
import {
  Claim,
  FeaturedPOAP,
  GitPOAP,
  Organization,
  Prisma,
  Profile,
  Project,
  RedeemCode,
  Repo,
  User,
} from '@prisma/client';
import { createScopedLogger } from '../src/logging';
import { prisma } from './seed';

const logger = createScopedLogger('factories');

export class ClaimFactory {
  static createClaim = async (
    gitPOAPId: number,
    userId: number,
    status?: ClaimStatus,
    address?: string,
    poapTokenId?: string,
    mintedAt?: Date,
  ): Promise<Claim> => {
    const claim = await prisma.claim.create({
      data: <Prisma.ClaimCreateInput>{
        gitPOAP: {
          connect: {
            id: gitPOAPId,
          },
        },
        user: {
          connect: {
            id: userId,
          },
        },
        status,
        address,
        poapTokenId,
        mintedAt,
      },
    });
    logger.debug(`Creating claim with id: ${claim.id}`);

    return claim;
  };
}

export class UserFactory {
  static createUser = async (githubId: number, githubHandle: string): Promise<User> => {
    const user = await prisma.user.create({
      data: <Prisma.UserCreateInput>{
        githubId,
        githubHandle,
      },
    });
    logger.debug(`Creating user with id: ${user.id}`);

    return user;
  };
}

export class OrganizationFactory {
  static createOrganization = async (
    githubOrgId: number,
    name: string,
    description?: string,
    twitterHandle?: string,
    url?: string,
  ): Promise<Organization> => {
    const org = await prisma.organization.create({
      data: <Prisma.OrganizationCreateInput>{
        githubOrgId,
        name,
        description,
        twitterHandle,
        url,
      },
    });
    logger.debug(`Creating organization with id: ${org.id}`);

    return org;
  };
}

export class ProjectFactory {
  static createProject = async (): Promise<Project> => {
    const project = await prisma.project.create({ data: {} });
    logger.debug(`Creating project with id: ${project.id}`);

    return project;
  };
}

export class RepoFactory {
  static createRepo = async (
    name: string,
    githubRepoId: number,
    organizationId: number,
    projectId: number,
  ): Promise<Repo> => {
    const repo = await prisma.repo.create({
      data: <Prisma.RepoCreateInput>{
        name,
        githubRepoId,
        organization: {
          connect: {
            id: organizationId,
          },
        },
        project: {
          connect: {
            id: projectId,
          },
        },
      },
    });
    logger.debug(`Creating repo with id: ${repo.id}`);

    return repo;
  };
}

export class GitPOAPFactory {
  static createGitPOAP = async (
    name: string,
    imageUrl: string,
    description: string,
    year: number,
    poapEventId: number,
    projectId: number,
    poapSecret: string,
    status?: GitPOAPStatus,
    ongoing?: boolean,
    level?: number,
    threshold?: number,
  ): Promise<GitPOAP> => {
    const gitPOAP = await prisma.gitPOAP.create({
      data: <Prisma.GitPOAPCreateInput>{
        name,
        imageUrl,
        description,
        year,
        poapEventId,
        poapSecret,
        status,
        ongoing,
        level,
        threshold,
        project: {
          connect: {
            id: projectId,
          },
        },
      },
    });
    logger.debug(`Creating gitPOAP with id: ${gitPOAP.id}`);

    return gitPOAP;
  };
}

export class FeaturedPOAPFactory {
  static createFeaturedPOAP = async (
    poapTokenId: string,
    profileId: number,
  ): Promise<FeaturedPOAP> => {
    const featuredPOAP = await prisma.featuredPOAP.create({
      data: <Prisma.FeaturedPOAPCreateInput>{
        poapTokenId,
        profile: {
          connect: {
            id: profileId,
          },
        },
      },
    });
    logger.debug(`Creating featuredPOAP with id: ${featuredPOAP.id}`);

    return featuredPOAP;
  };
}

export class ProfileFactory {
  static createProfile = async (
    address: string,
    bio: string,
    name?: string,
    githubHandle?: string,
    twitterHandle?: string,
    personalSiteUrl?: string,
  ): Promise<Profile> => {
    const profile = await prisma.profile.create({
      data: <Prisma.ProfileCreateInput>{
        address,
        bio,
        name,
        githubHandle,
        twitterHandle,
        personalSiteUrl,
      },
    });
    logger.debug(`Creating profile with id: ${profile.id}`);

    return profile;
  };
}

export class RedeemCodeFactory {
  static createRedeemCode = async (code: string, gitPOAPId: number): Promise<RedeemCode> => {
    const redeemCode = await prisma.redeemCode.create({
      data: <Prisma.RedeemCodeCreateInput>{
        code,
        gitPOAP: {
          connect: {
            id: gitPOAPId,
          },
        },
      },
    });
    logger.debug(`Creating redeemCode with id: ${redeemCode.id}`);

    return redeemCode;
  };

  static addRedeemCodes = async (codes: string[], gitPOAPId: number): Promise<RedeemCode[]> => {
    const redeemCodes = await Promise.all(
      codes.map(code =>
        prisma.redeemCode.create({
          data: <Prisma.RedeemCodeCreateInput>{
            code,
            gitPOAP: {
              connect: {
                id: gitPOAPId,
              },
            },
          },
        }),
      ),
    );
    logger.debug(`Creating redeemCodes with ids: ${redeemCodes.map(c => c.id).join(', ')}`);

    return redeemCodes;
  };
}
