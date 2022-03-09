import { ClaimStatus } from '@generated/type-graphql';
import { Prisma, User, Organization, Repo, GitPOAP, Claim, Profile } from '@prisma/client';
import { prisma } from './seed';

export class ClaimFactory {
  static createClaim = async (
    gitPOAPId: number,
    userId: number,
    status?: ClaimStatus,
    address?: string,
    poapTokenId?: string,
  ): Promise<Claim> => {
    const data: Prisma.ClaimCreateInput = {
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
    };

    const claim = await prisma.claim.create({ data });
    console.log(`Creating claim with id: ${claim.id}`);

    return claim;
  };
}

export class UserFactory {
  static createUser = async (githubId: number, githubHandle: string): Promise<User> => {
    const data: Prisma.UserCreateInput = {
      githubId,
      githubHandle,
    };

    const user = await prisma.user.create({ data });
    console.log(`Creating user with id: ${user.id}`);

    return user;
  };
}

export class OrganizationFactory {
  static createOrganization = async (githubOrgId: number, name: string): Promise<Organization> => {
    const data: Prisma.OrganizationCreateInput = {
      githubOrgId,
      name,
    };

    const org = await prisma.organization.create({ data });
    console.log(`Creating organization with id: ${org.id}`);

    return org;
  };
}

export class RepoFactory {
  static createRepo = async (
    name: string,
    githubRepoId: number,
    organizationId: number,
  ): Promise<Repo> => {
    const data: Prisma.RepoCreateInput = {
      name,
      githubRepoId,
      Organization: {
        connect: {
          id: organizationId,
        },
      },
    };

    const repo = await prisma.repo.create({ data });
    console.log(`Creating repo with id: ${repo.id}`);

    return repo;
  };
}

export class GitPOAPFactory {
  static createGitPOAP = async (
    year: number,
    poapEventId: number,
    repoId: number,
    poapSecret: string,
    poapQRHash: string,
  ): Promise<GitPOAP> => {
    const data: Prisma.GitPOAPCreateInput = {
      year,
      poapEventId,
      poapSecret,
      poapQRHash,
      repo: {
        connect: {
          id: repoId,
        },
      },
    };

    const gitPOAP = await prisma.gitPOAP.create({ data });
    console.log(`Creating gitPOAP with id: ${gitPOAP.id}`);

    return gitPOAP;
  };
}

export class ProfileFactory {
  static createProfile = async (
    address: string,
    bio: string,
    name?: string,
    twitterHandle?: string,
    personalSiteUrl?: string,
  ): Promise<Profile> => {
    const data: Prisma.ProfileCreateInput = {
      address,
      bio,
      name,
      twitterHandle,
      personalSiteUrl,
    };

    const profile = await prisma.profile.create({ data });
    console.log(`Creating profile with id: ${profile.id}`);

    return profile;
  };
}
