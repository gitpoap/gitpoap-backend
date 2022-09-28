import { ClaimStatus, GitPOAPStatus } from '@generated/type-graphql';
import {
  Address,
  Claim,
  Email,
  FeaturedPOAP,
  GitPOAP,
  GithubIssue,
  GithubMention,
  GithubPullRequest,
  Organization,
  Prisma,
  Profile,
  Project,
  RedeemCode,
  Repo,
  User,
} from '@prisma/client';
import { POAPEvent } from '../src/types/poap';
import { createScopedLogger } from '../src/logging';
import { prisma } from './seed';
import { generatePOAPSecret } from '../src/lib/secrets';

const logger = createScopedLogger('factories');

export class ClaimFactory {
  static create = async (
    gitPOAPId: number,
    userId: number,
    status?: ClaimStatus,
    mintedAddressId?: number,
    poapTokenId?: string,
    mintedAt?: Date,
    issuedAddressId?: number,
  ): Promise<Claim> => {
    const issuedAddressData = issuedAddressId ? { connect: { id: issuedAddressId } } : undefined;
    const mintedAddressData = mintedAddressId ? { connect: { id: mintedAddressId } } : undefined;

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
      issuedAddress: issuedAddressData,
      mintedAddress: mintedAddressData,
      poapTokenId,
      mintedAt,
    };
    const claim = await prisma.claim.create({ data });
    logger.debug(`Creating claim with id: ${claim.id}`);

    return claim;
  };
}

export class UserFactory {
  static create = async (githubId: number, githubHandle: string): Promise<User> => {
    const data: Prisma.UserCreateInput = {
      githubId,
      githubHandle,
    };
    const user = await prisma.user.create({ data });
    logger.debug(`Creating user with id: ${user.id}`);

    return user;
  };
}

export class OrganizationFactory {
  static create = async (
    githubOrgId: number,
    name: string,
    description?: string,
    twitterHandle?: string,
    url?: string,
  ): Promise<Organization> => {
    const data: Prisma.OrganizationCreateInput = {
      githubOrgId,
      name,
      description,
      twitterHandle,
      url,
    };
    const org = await prisma.organization.create({ data });
    logger.debug(`Creating organization with id: ${org.id}`);

    return org;
  };
}

export class ProjectFactory {
  static create = async (): Promise<Project> => {
    const project = await prisma.project.create({ data: {} });
    logger.debug(`Creating project with id: ${project.id}`);

    return project;
  };
}

export class RepoFactory {
  static create = async (
    name: string,
    githubRepoId: number,
    organizationId: number,
    projectId: number,
  ): Promise<Repo> => {
    const data: Prisma.RepoCreateInput = {
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
    };
    const repo = await prisma.repo.create({ data });
    logger.debug(`Creating repo with id: ${repo.id}`);

    return repo;
  };
}

export class GitPOAPFactory {
  static create = async (
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
    isEnabled?: boolean,
  ): Promise<GitPOAP> => {
    const data: Prisma.GitPOAPCreateInput = {
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
      isEnabled,
      project: {
        connect: {
          id: projectId,
        },
      },
    };
    const gitPOAP = await prisma.gitPOAP.create({ data });
    logger.debug(`Creating gitPOAP with id: ${gitPOAP.id}`);

    return gitPOAP;
  };

  static createFromEvent = async (
    projectId: number,
    event: POAPEvent,
    status?: GitPOAPStatus,
    ongoing?: boolean,
    level?: number,
    threshold?: number,
    isEnabled?: boolean,
  ): Promise<GitPOAP> => {
    return await GitPOAPFactory.create(
      event.name,
      event.image_url,
      event.description,
      event.year,
      event.id,
      projectId,
      generatePOAPSecret(),
      status,
      ongoing,
      level,
      threshold,
      isEnabled,
    );
  };
}

export class FeaturedPOAPFactory {
  static create = async (poapTokenId: string, profileId: number): Promise<FeaturedPOAP> => {
    const data: Prisma.FeaturedPOAPCreateInput = {
      poapTokenId,
      profile: {
        connect: {
          id: profileId,
        },
      },
    };
    const featuredPOAP = await prisma.featuredPOAP.create({ data });
    logger.debug(`Creating featuredPOAP with id: ${featuredPOAP.id}`);

    return featuredPOAP;
  };
}

export class ProfileFactory {
  static create = async (
    addressId: number,
    bio: string,
    name?: string,
    githubHandle?: string,
    twitterHandle?: string,
    personalSiteUrl?: string,
  ): Promise<Profile> => {
    const data: Prisma.ProfileCreateInput = {
      address: {
        connect: { id: addressId },
      },
      bio,
      name,
      githubHandle,
      twitterHandle,
      personalSiteUrl,
    };
    const profile = await prisma.profile.create({ data });
    logger.debug(`Creating profile with id: ${profile.id}`);

    return profile;
  };
}

export class RedeemCodeFactory {
  static create = async (code: string, gitPOAPId: number): Promise<RedeemCode> => {
    const data: Prisma.RedeemCodeCreateInput = {
      code,
      gitPOAP: {
        connect: {
          id: gitPOAPId,
        },
      },
    };
    const redeemCode = await prisma.redeemCode.create({ data });
    logger.debug(`Creating redeemCode with id: ${redeemCode.id}`);

    return redeemCode;
  };

  static addRedeemCodes = async (codes: string[], gitPOAPId: number): Promise<RedeemCode[]> => {
    const redeemCodes = await Promise.all(
      codes.map(code => {
        const data: Prisma.RedeemCodeCreateInput = {
          code,
          gitPOAP: {
            connect: {
              id: gitPOAPId,
            },
          },
        };
        return prisma.redeemCode.create({ data });
      }),
    );
    logger.debug(`Creating redeemCodes with ids: ${redeemCodes.map(c => c.id).join(', ')}`);

    return redeemCodes;
  };
}

export class AddressFactory {
  static create = async (address: string): Promise<Address> => {
    const data: Prisma.AddressCreateInput = { ethAddress: address };
    const addressResult = await prisma.address.create({ data });
    logger.debug(
      `Creating address with id: ${addressResult.id} & ethAddress: ${addressResult.ethAddress}`,
    );

    return addressResult;
  };
}

export class EmailFactory {
  static create = async (email: string): Promise<Email> => {
    const data: Prisma.EmailCreateInput = { emailAddress: email };
    const emailObj = await prisma.email.create({ data });
    logger.debug(`Creating email with id: ${emailObj.id}`);

    return emailObj;
  };
}

export class GithubPullRequestFactory {
  static create = async (
    githubPullNumber: number,
    githubTitle: string,
    githubMergedAt: Date | null,
    githubMergeCommitSha: string | null,
    repoId: number,
    userId: number,
  ): Promise<GithubPullRequest> => {
    const data: Prisma.GithubPullRequestCreateInput = {
      githubPullNumber,
      githubTitle,
      githubMergedAt,
      githubMergeCommitSha,
      repo: {
        connect: {
          id: repoId,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
    };
    const githubPullRequest = await prisma.githubPullRequest.create({ data });
    logger.debug(`Creating GithubPullRequest with ID: ${githubPullRequest.id}`);

    return githubPullRequest;
  };
}

export class GithubIssueFactory {
  static create = async (
    githubIssueNumber: number,
    githubTitle: string,
    githubClosedAt: Date | null,
    repoId: number,
    userId: number,
  ): Promise<GithubIssue> => {
    const data: Prisma.GithubIssueCreateInput = {
      githubIssueNumber,
      githubTitle,
      githubClosedAt,
      repo: {
        connect: {
          id: repoId,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
    };
    const githubIssue = await prisma.githubIssue.create({ data });
    logger.debug(`Creating GithubIssue with ID: ${githubIssue.id}`);

    return githubIssue;
  };
}

export class GithubMentionFactory {
  static createForPR = async (
    githubMentionedAt: Date,
    repoId: number,
    userId: number,
    pullRequestId: number,
  ): Promise<GithubMention> => {
    const data: Prisma.GithubMentionCreateInput = {
      githubMentionedAt,
      repo: {
        connect: {
          id: repoId,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
      pullRequest: {
        connect: {
          id: pullRequestId,
        },
      },
    };
    const githubMention = await prisma.githubMention.create({ data });
    logger.debug(`Creating GithubMention with ID: ${githubMention.id}`);

    return githubMention;
  };

  static createForIssue = async (
    githubMentionedAt: Date,
    repoId: number,
    userId: number,
    issueId: number,
  ): Promise<GithubMention> => {
    const data: Prisma.GithubMentionCreateInput = {
      githubMentionedAt,
      repo: {
        connect: {
          id: repoId,
        },
      },
      user: {
        connect: {
          id: userId,
        },
      },
      issue: {
        connect: {
          id: issueId,
        },
      },
    };
    const githubMention = await prisma.githubMention.create({ data });
    logger.debug(`Creating GithubMention with ID: ${githubMention.id}`);

    return githubMention;
  };
}
