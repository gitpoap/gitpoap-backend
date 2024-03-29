import {
  ClaimStatus,
  GitPOAPStatus,
  MembershipRole,
  MembershipAcceptanceStatus,
} from '@generated/type-graphql';
import {
  Address,
  StaffApprovalStatus,
  Claim,
  Email,
  FeaturedPOAP,
  GitPOAP,
  GitPOAPRequest,
  GitPOAPType,
  GithubIssue,
  GithubMention,
  GithubPullRequest,
  GithubUser,
  GithubOrganization,
  Prisma,
  Profile,
  Project,
  RedeemCode,
  Repo,
  Team,
} from '@prisma/client';
import { POAPEvent } from '../src/types/poap';
import { createScopedLogger } from '../src/logging';
import { prisma } from './seed';
import { generatePOAPSecret } from '../src/lib/secrets';
import { z } from 'zod';
import { GitPOAPContributorsSchema } from '../src/schemas/gitpoaps';
import { countContributors, convertContributorsFromSchema } from '../src/lib/gitpoaps';

const logger = createScopedLogger('factories');

export class ClaimFactory {
  static create = async (
    gitPOAPId: number,
    githubUserId: number,
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
      githubUser: {
        connect: {
          id: githubUserId,
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

  static createForEmail = async (
    gitPOAPId: number,
    emailId: number,
    status?: ClaimStatus,
  ): Promise<Claim> => {
    const data: Prisma.ClaimCreateInput = {
      gitPOAP: {
        connect: { id: gitPOAPId },
      },
      email: {
        connect: { id: emailId },
      },
      status,
    };
    const claim = await prisma.claim.create({ data });
    logger.debug(`Creating claim with id: ${claim.id}`);

    return claim;
  };

  static createForEthAddress = async (
    gitPOAPId: number,
    addressId: number,
    status?: ClaimStatus,
    mintedAddressId?: number,
    poapTokenId?: string,
    mintedAt?: Date,
  ): Promise<Claim> => {
    const mintedAddress = mintedAddressId ? { connect: { id: mintedAddressId } } : undefined;

    const data: Prisma.ClaimCreateInput = {
      gitPOAP: {
        connect: { id: gitPOAPId },
      },
      issuedAddress: {
        connect: { id: addressId },
      },
      status,
      mintedAddress,
      mintedAt,
    };
    const claim = await prisma.claim.create({ data });
    logger.debug(`Creating claim with id: ${claim.id}`);

    return claim;
  };

  static createForPR = async (
    gitPOAPId: number,
    githubUserId: number,
    githubPullRequestId: number,
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
      githubUser: {
        connect: {
          id: githubUserId,
        },
      },
      status,
      issuedAddress: issuedAddressData,
      mintedAddress: mintedAddressData,
      poapTokenId,
      mintedAt,
      pullRequestEarned: {
        connect: {
          id: githubPullRequestId,
        },
      },
    };
    const claim = await prisma.claim.create({ data });
    logger.debug(`Creating claim with id: ${claim.id}`);

    return claim;
  };

  static createForMention = async (
    gitPOAPId: number,
    githubUserId: number,
    githubMentionId: number,
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
      githubUser: {
        connect: {
          id: githubUserId,
        },
      },
      status,
      issuedAddress: issuedAddressData,
      mintedAddress: mintedAddressData,
      poapTokenId,
      mintedAt,
      mentionEarned: {
        connect: {
          id: githubMentionId,
        },
      },
    };
    const claim = await prisma.claim.create({ data });
    logger.debug(`Creating claim with id: ${claim.id}`);

    return claim;
  };
}

export class GithubUserFactory {
  static create = async (githubId: number, githubHandle: string): Promise<GithubUser> => {
    const data: Prisma.GithubUserCreateInput = {
      githubId,
      githubHandle,
    };
    const githubUser = await prisma.githubUser.create({ data });
    logger.debug(`Creating GithubUser with id: ${githubUser.id}`);

    return githubUser;
  };
}

export class GithubOrganizationFactory {
  static create = async (githubOrgId: number, name: string): Promise<GithubOrganization> => {
    const data: Prisma.GithubOrganizationCreateInput = {
      githubOrgId,
      name,
    };
    const org = await prisma.githubOrganization.create({ data });
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
    type: GitPOAPType,
    poapApprovalStatus?: GitPOAPStatus,
    level?: number,
    threshold?: number,
    isEnabled?: boolean,
    creatorAddressId?: number,
  ): Promise<GitPOAP> => {
    const data: Prisma.GitPOAPCreateInput = {
      name,
      imageUrl,
      description,
      year,
      poapEventId,
      poapSecret,
      poapApprovalStatus,
      level,
      threshold,
      isEnabled,
      type,
      project: {
        connect: {
          id: projectId,
        },
      },
      creatorAddress: creatorAddressId
        ? {
            connect: { id: creatorAddressId },
          }
        : undefined,
    };
    const gitPOAP = await prisma.gitPOAP.create({ data });
    logger.debug(`Creating gitPOAP with id: ${gitPOAP.id}`);

    return gitPOAP;
  };

  static createFromEvent = async (
    projectId: number,
    event: POAPEvent,
    status?: GitPOAPStatus,
    level?: number,
    threshold?: number,
    isEnabled?: boolean,
    type: GitPOAPType = GitPOAPType.ANNUAL,
    creatorAddressId?: number,
  ): Promise<GitPOAP> => {
    return await GitPOAPFactory.create(
      event.name,
      event.image_url,
      event.description,
      event.year,
      event.id,
      projectId,
      generatePOAPSecret(),
      type,
      status,
      level,
      threshold,
      isEnabled,
      creatorAddressId,
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
  static create = async (ethAddress: string, ensName?: string): Promise<Address> => {
    const data: Prisma.AddressCreateInput = {
      ethAddress,
      ensName,
    };
    const addressResult = await prisma.address.create({ data });
    logger.debug(`Creating address with id: ${addressResult.id} & ethAddress: ${ethAddress}`);

    return addressResult;
  };
}

export class EmailFactory {
  static create = async (emailAddress: string): Promise<Email> => {
    const data: Prisma.EmailCreateInput = { emailAddress: emailAddress.toLowerCase() };
    const emailObj = await prisma.email.create({ data });
    logger.debug(`Creating email with id: ${emailObj.id}`);

    return emailObj;
  };
}

export class GithubPullRequestFactory {
  static create = async (
    githubPullNumber: number,
    githubTitle: string,
    githubCreatedAt: Date,
    githubMergedAt: Date | null,
    githubMergeCommitSha: string | null,
    repoId: number,
    githubUserId: number,
  ): Promise<GithubPullRequest> => {
    const data: Prisma.GithubPullRequestCreateInput = {
      githubPullNumber,
      githubTitle,
      githubCreatedAt,
      githubMergedAt,
      githubMergeCommitSha,
      repo: {
        connect: {
          id: repoId,
        },
      },
      githubUser: {
        connect: {
          id: githubUserId,
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
    githubCreatedAt: Date,
    githubClosedAt: Date | null,
    repoId: number,
    githubUserId: number,
  ): Promise<GithubIssue> => {
    const data: Prisma.GithubIssueCreateInput = {
      githubIssueNumber,
      githubTitle,
      githubCreatedAt,
      githubClosedAt,
      repo: {
        connect: {
          id: repoId,
        },
      },
      githubUser: {
        connect: {
          id: githubUserId,
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
    githubUserId: number,
    pullRequestId: number,
  ): Promise<GithubMention> => {
    const data: Prisma.GithubMentionCreateInput = {
      githubMentionedAt,
      repo: {
        connect: {
          id: repoId,
        },
      },
      githubUser: {
        connect: {
          id: githubUserId,
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
    githubUserId: number,
    issueId: number,
  ): Promise<GithubMention> => {
    const data: Prisma.GithubMentionCreateInput = {
      githubMentionedAt,
      repo: {
        connect: {
          id: repoId,
        },
      },
      githubUser: {
        connect: {
          id: githubUserId,
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

type CreateGitPOAPRequestParams = {
  name: string;
  description: string;
  creatorEmailId: number;
  addressId: number;
  imageUrl: string;
  contributors: z.infer<typeof GitPOAPContributorsSchema>;
  startDate: Date;
  endDate: Date;
  staffApprovalStatus: StaffApprovalStatus;
};

export class GitPOAPRequestFactory {
  static create = async ({
    name,
    description,
    creatorEmailId,
    addressId,
    imageUrl,
    contributors,
    startDate,
    endDate,
    staffApprovalStatus = StaffApprovalStatus.PENDING,
  }: CreateGitPOAPRequestParams): Promise<GitPOAPRequest> => {
    const data: Prisma.GitPOAPRequestCreateInput = {
      name,
      description,
      creatorEmail: { connect: { id: creatorEmailId } },
      startDate,
      endDate,
      numRequestedCodes: countContributors(convertContributorsFromSchema(contributors)),
      address: { connect: { id: addressId } },
      imageUrl,
      contributors,
      staffApprovalStatus,
    };
    const gitPOAPRequest = await prisma.gitPOAPRequest.create({ data });
    logger.debug(`Creating GitPOAPRequest with ID: ${gitPOAPRequest.id}`);

    return gitPOAPRequest;
  };
}

export class TeamFactory {
  static create = async (
    name: string,
    description: string,
    ownerAddressId: number,
    logoImageUrl?: string,
  ): Promise<Team> => {
    const data: Prisma.TeamCreateInput = {
      name,
      description,
      ownerAddress: {
        connect: {
          id: ownerAddressId,
        },
      },
      logoImageUrl,
    };
    const team = await prisma.team.create({ data });
    logger.debug(`Creating Team with ID: ${team.id}`);

    return team;
  };

  static addGitPOAPs = async (teamId: number, gitPOAPIds: number[]): Promise<Team> => {
    const data: Prisma.TeamUpdateInput = {
      gitPOAPs: {
        connect: gitPOAPIds.map(id => ({ id })),
      },
    };
    const team = await prisma.team.update({ where: { id: teamId }, data });
    logger.debug(`Adding GitPOAPs with IDs: ${gitPOAPIds} to Team with ID: ${teamId}`);

    return team;
  };

  static addGitPOAPRequests = async (
    teamId: number,
    gitPOAPRequestIds: number[],
  ): Promise<Team> => {
    const data: Prisma.TeamUpdateInput = {
      gitPOAPRequests: {
        connect: gitPOAPRequestIds.map(id => ({ id })),
      },
    };
    const team = await prisma.team.update({ where: { id: teamId }, data });
    logger.debug(`Adding GitPOAPRequest with IDs: ${gitPOAPRequestIds} to Team with ID: ${teamId}`);

    return team;
  };
}

export class MembershipFactory {
  static create = async (
    teamId: number,
    addressId: number,
    role: MembershipRole,
    acceptanceStatus: MembershipAcceptanceStatus,
    joinedOn?: Date,
  ): Promise<MembershipFactory> => {
    const data: Prisma.MembershipCreateInput = {
      team: {
        connect: {
          id: teamId,
        },
      },
      address: {
        connect: {
          id: addressId,
        },
      },
      role,
      acceptanceStatus,
      joinedOn,
    };
    const membership = await prisma.membership.create({ data });
    logger.debug(`Creating Membership with ID: ${membership.id}`);

    return membership;
  };
}
