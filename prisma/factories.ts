import { ClaimStatus, GitPOAPStatus } from '@generated/type-graphql';
import {
  Prisma,
  User,
  Organization,
  Repo,
  GitPOAP,
  Claim,
  Profile,
  FeaturedPOAP,
} from '@prisma/client';
import { prisma } from './seed';

export class ClaimFactory {
  static createClaim = async (
    gitPOAPId: number,
    userId: number,
    status?: ClaimStatus,
    address?: string,
    poapTokenId?: string,
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
      },
    });
    console.log(`Creating claim with id: ${claim.id}`);

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
    console.log(`Creating user with id: ${user.id}`);

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
    const repo = await prisma.repo.create({
      data: <Prisma.RepoCreateInput>{
        name,
        githubRepoId,
        organization: {
          connect: {
            id: organizationId,
          },
        },
      },
    });
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
    status?: GitPOAPStatus,
  ): Promise<GitPOAP> => {
    const gitPOAP = await prisma.gitPOAP.create({
      data: <Prisma.GitPOAPCreateInput>{
        year,
        poapEventId,
        poapSecret,
        status,
        repo: {
          connect: {
            id: repoId,
          },
        },
      },
    });
    console.log(`Creating gitPOAP with id: ${gitPOAP.id}`);

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
    console.log(`Creating featuredPOAP with id: ${featuredPOAP.id}`);

    return featuredPOAP;
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
    const profile = await prisma.profile.create({
      data: <Prisma.ProfileCreateInput>{
        address,
        bio,
        name,
        twitterHandle,
        personalSiteUrl,
      },
    });
    console.log(`Creating profile with id: ${profile.id}`);

    return profile;
  };
}

// export class FeaturedPOAPFac
