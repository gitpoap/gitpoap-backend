import '../../../../__mocks__/src/logging';
import { contextMock } from '../../../../__mocks__/src/context';
import { setupApp } from '../../../../__mocks__/src/app';
import request from 'supertest';
import { getGithubAuthenticatedApp } from '../../../../src/external/github';
import { GITPOAP_BOT_APP_ID } from '../../../../src/constants';
import {
  BotCreateClaimsErrorType,
  createClaimsForIssue,
  createClaimsForPR,
} from '../../../../src/lib/bot';
import {
  ensureRedeemCodeThreshold,
  retrieveClaimsCreatedByMention,
  retrieveClaimsCreatedByPR,
  runClaimsPostProcessing,
  updateClaimStatusById,
} from '../../../../src/lib/claims';
import { generateAuthTokens } from '../../../../src/lib/authTokens';
import { STAFF_ADDRESSES } from '../../../../src/constants';
import { ADDRESSES } from '../../../../prisma/constants';
import { ClaimStatus, GitPOAPType } from '@prisma/client';
import { ClaimData } from '../../../../src/types/claims';
import {
  sendInternalClaimByMentionMessage,
  sendInternalClaimMessage,
} from '../../../../src/external/slack';
import { redeemPOAP } from '../../../../src/external/poap';
import {
  chooseUnusedRedeemCode,
  deleteRedeemCode,
  upsertRedeemCode,
} from '../../../../src/lib/codes';
import { DateTime } from 'luxon';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/github');
jest.mock('../../../../src/lib/bot');
jest.mock('../../../../src/lib/claims');
jest.mock('../../../../src/external/slack');
jest.mock('../../../../src/external/poap');
jest.mock('../../../../src/lib/codes');
jest.mock('luxon', () => ({
  DateTime: { utc: jest.fn() },
}));

const mockedGetGithubAuthenticatedApp = jest.mocked(getGithubAuthenticatedApp, true);
const mockedCreateClaimsForPR = jest.mocked(createClaimsForPR, true);
const mockedCreateClaimsForIssue = jest.mocked(createClaimsForIssue, true);
const mockedRetrieveClaimsCreatedByPR = jest.mocked(retrieveClaimsCreatedByPR, true);
const mockedRetrieveClaimsCreatedByMention = jest.mocked(retrieveClaimsCreatedByMention, true);
const mockedSendInternalClaimByMentionMessage = jest.mocked(
  sendInternalClaimByMentionMessage,
  true,
);
const mockedSendInternalClaimMessage = jest.mocked(sendInternalClaimMessage, true);
const mockedRedeemPOAP = jest.mocked(redeemPOAP, true);
const mockedUpdateClaimStatusById = jest.mocked(updateClaimStatusById, true);
const mockedEnsureRedeemCodeThreshold = jest.mocked(ensureRedeemCodeThreshold, true);
const mockedRunClaimsPostProcessing = jest.mocked(runClaimsPostProcessing, true);
const mockedChooseUnusedRedeemCode = jest.mocked(chooseUnusedRedeemCode, true);
const mockedDeleteRedeemCode = jest.mocked(deleteRedeemCode, true);
const mockedUpsertRedeemCode = jest.mocked(upsertRedeemCode, true);
const mockedDateTimeUTC = jest.mocked(DateTime.utc, true);

const botJWTToken = 'foobar2';
const contributorId = 2;
const pullRequest = {
  organization: 'foo',
  repo: 'bar',
  pullRequestNumber: 2,
  contributorGithubIds: [contributorId],
  wasEarnedByMention: false,
};
const issue = {
  organization: 'foo',
  repo: 'bar',
  issueNumber: 32,
  contributorGithubIds: [contributorId],
  wasEarnedByMention: true,
};
const claimId = 234;
const gitPOAPId = 744;
const gitPOAPName = 'Wow you arrrrr great';
const poapEventId = 9420384;
const claim: ClaimData = {
  id: claimId,
  githubUser: {
    githubId: contributorId,
    githubHandle: 'batman',
  },
  gitPOAP: {
    id: gitPOAPId,
    name: gitPOAPName,
    imageUrl: 'https://example.com/image.png',
    description: 'You are clearly a rockstar',
    threshold: 1,
  },
};
const privyUserId = 'come and claim it';
const addressId = 2342222;
const address = ADDRESSES.vitalik;
const ensName = null;
const ensAvatarImageUrl = null;
const githubId = 3333;
const githubHandle = 'burzadillo';
const discordHandle = 'test#2324';
const emailAddress = 'hi-there@gmail.com';
const redeemCodeId = 942;
const redeemCode = '4433';

function mockJwtWithAddress() {
  contextMock.prisma.address.findUnique.mockResolvedValue({
    ensName,
    ensAvatarImageUrl,
    memberships: [],
  } as any);
}

function genAuthTokens(someAddress?: string) {
  return generateAuthTokens(
    privyUserId,
    {
      id: addressId,
      ethAddress: someAddress ?? address,
      ensName,
      ensAvatarImageUrl,
    },
    {
      id: 1,
      githubId,
      githubHandle,
    },
    {
      id: 1,
      emailAddress,
    },
    {
      id: 1,
      discordId: '1',
      discordHandle,
    },
    [],
  );
}

describe('POST /claims/gitpoap-bot/create', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .send();

    expect(result.statusCode).toEqual(400);
  });

  it('Fails with bad auth headers', async () => {
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', 'foobar')
        .send();

      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', 'Bearer foo bar')
        .send();

      expect(result.statusCode).toEqual(400);
    }
  });

  it("Fails when GitHub doesn't recognize app", async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue(null);

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${botJWTToken}`)
      .send();

    expect(result.statusCode).toEqual(400);

    expect(mockedGetGithubAuthenticatedApp).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubAuthenticatedApp).toHaveBeenCalledWith(botJWTToken);
  });

  it("Fails when app isn't gitpoap-bot", async () => {
    const appId = 23423423;

    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: appId } as any);

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${botJWTToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expect(mockedGetGithubAuthenticatedApp).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubAuthenticatedApp).toHaveBeenCalledWith(botJWTToken);
  });

  it('Fails on invalid request bodies', async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID } as any);

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ bad: 'body' });

      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ pullRequest: [] });

      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ issue: [] });

      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({
          pullRequest: {
            organization: 'foo',
            repo: 'bar',
            pullRequestNumber: 2,
            contributorGithubIds: [2],
          },
        });

      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({
          issue: {
            organization: 'foo',
            issueNumber: 2,
            contributorGithubIds: [2],
            wasEarnedByMention: true,
          },
        });

      expect(result.statusCode).toEqual(400);
    }
  });

  it('Fails for a PR contribution with more than one githubId', async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID } as any);

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${botJWTToken}`)
      .send({ ...pullRequest, contributorGithubIds: [4, 5] });

    expect(result.statusCode).toEqual(400);

    expect(mockedCreateClaimsForPR).toHaveBeenCalledTimes(0);
  });

  it("Fails for issues that aren't from mentions", async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID } as any);

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${botJWTToken}`)
      .send({ ...issue, wasEarnedByMention: false });

    expect(result.statusCode).toEqual(400);

    expect(mockedCreateClaimsForIssue).toHaveBeenCalledTimes(0);
  });

  it('Fails when repository is not in DB', async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID } as any);
    mockedCreateClaimsForPR.mockResolvedValue(BotCreateClaimsErrorType.RepoNotFound);
    mockedCreateClaimsForIssue.mockResolvedValue(BotCreateClaimsErrorType.GithubRecordNotFound);

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ pullRequest });

      expect(result.statusCode).toEqual(404);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ issue });

      expect(result.statusCode).toEqual(404);
    }

    expect(mockedCreateClaimsForPR).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForPR).toHaveBeenCalledWith(
      pullRequest.organization,
      pullRequest.repo,
      pullRequest.pullRequestNumber,
      contributorId,
      pullRequest.wasEarnedByMention,
    );

    expect(mockedCreateClaimsForIssue).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForIssue).toHaveBeenCalledWith(
      issue.organization,
      issue.repo,
      issue.issueNumber,
      contributorId,
    );
  });

  it('Fails when repository is not found on GitHub', async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID } as any);
    mockedCreateClaimsForPR.mockResolvedValue(BotCreateClaimsErrorType.GithubRecordNotFound);
    mockedCreateClaimsForIssue.mockResolvedValue(BotCreateClaimsErrorType.GithubRecordNotFound);

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ pullRequest });

      expect(result.statusCode).toEqual(404);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ issue });

      expect(result.statusCode).toEqual(404);
    }

    expect(mockedCreateClaimsForPR).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForPR).toHaveBeenCalledWith(
      pullRequest.organization,
      pullRequest.repo,
      pullRequest.pullRequestNumber,
      contributorId,
      pullRequest.wasEarnedByMention,
    );

    expect(mockedCreateClaimsForIssue).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForIssue).toHaveBeenCalledWith(
      issue.organization,
      issue.repo,
      issue.issueNumber,
      contributorId,
    );
  });

  it('Fails if createClaimsForIssue returns a pullRequest', async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID } as any);
    mockedCreateClaimsForIssue.mockResolvedValue({ pullRequest: { id: 3 } });

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${botJWTToken}`)
      .send({ issue });

    expect(result.statusCode).toEqual(500);

    expect(mockedCreateClaimsForIssue).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForIssue).toHaveBeenCalledWith(
      issue.organization,
      issue.repo,
      issue.issueNumber,
      contributorId,
    );
  });

  it('Skips bot users', async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID } as any);
    mockedCreateClaimsForPR.mockResolvedValue(BotCreateClaimsErrorType.BotUser);
    mockedCreateClaimsForIssue.mockResolvedValue(BotCreateClaimsErrorType.BotUser);

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ pullRequest });

      expect(result.statusCode).toEqual(200);
      expect(JSON.parse(result.text)).toEqual({ newClaims: [] });
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ issue });

      expect(result.statusCode).toEqual(200);
      expect(JSON.parse(result.text)).toEqual({ newClaims: [] });
    }

    expect(mockedCreateClaimsForPR).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForPR).toHaveBeenCalledWith(
      pullRequest.organization,
      pullRequest.repo,
      pullRequest.pullRequestNumber,
      contributorId,
      pullRequest.wasEarnedByMention,
    );

    expect(mockedCreateClaimsForIssue).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForIssue).toHaveBeenCalledWith(
      issue.organization,
      issue.repo,
      issue.issueNumber,
      contributorId,
    );

    expect(mockedRetrieveClaimsCreatedByPR).toHaveBeenCalledTimes(0);
    expect(mockedRetrieveClaimsCreatedByMention).toHaveBeenCalledTimes(0);
  });

  it('Creates and returns new claims', async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID } as any);
    const contributionId = 324;
    mockedCreateClaimsForPR.mockResolvedValue({ pullRequest: { id: contributionId } } as any);
    mockedCreateClaimsForIssue.mockResolvedValue({ mention: { id: contributionId } } as any);
    mockedRetrieveClaimsCreatedByPR.mockResolvedValue([claim]);
    mockedRetrieveClaimsCreatedByMention.mockResolvedValue([claim]);
    const startTime = 'some-start-time';
    mockedDateTimeUTC.mockReturnValue(startTime as any);

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ pullRequest });

      expect(result.statusCode).toEqual(200);
      expect(JSON.parse(result.text)).toEqual({ newClaims: [claim] });
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${botJWTToken}`)
        .send({ issue });

      expect(result.statusCode).toEqual(200);
      expect(JSON.parse(result.text)).toEqual({ newClaims: [claim] });
    }

    expect(mockedCreateClaimsForPR).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForPR).toHaveBeenCalledWith(
      pullRequest.organization,
      pullRequest.repo,
      pullRequest.pullRequestNumber,
      contributorId,
      pullRequest.wasEarnedByMention,
    );

    expect(mockedCreateClaimsForIssue).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForIssue).toHaveBeenCalledWith(
      issue.organization,
      issue.repo,
      issue.issueNumber,
      contributorId,
    );

    expect(mockedRetrieveClaimsCreatedByPR).toHaveBeenCalledTimes(1);
    expect(mockedRetrieveClaimsCreatedByPR).toHaveBeenCalledWith(contributionId, startTime);

    expect(mockedRetrieveClaimsCreatedByMention).toHaveBeenCalledTimes(1);
    expect(mockedRetrieveClaimsCreatedByMention).toHaveBeenCalledWith(contributionId);

    expect(mockedSendInternalClaimByMentionMessage).toHaveBeenCalledTimes(1);
    expect(mockedSendInternalClaimByMentionMessage).toHaveBeenCalledWith(
      issue.organization,
      issue.repo,
      { issueNumber: issue.issueNumber },
      [claim],
    );
  });

  it("Filters out non-mentioned user's claims", async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID } as any);

    const contributionId = 324;

    mockedCreateClaimsForIssue.mockResolvedValue({ mention: { id: contributionId } } as any);

    mockedRetrieveClaimsCreatedByMention.mockResolvedValue([claim]);

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${botJWTToken}`)
      .send({
        issue: {
          ...issue,
          contributorGithubIds: [contributorId + 1],
        },
      });

    expect(result.statusCode).toEqual(200);
    expect(JSON.parse(result.text)).toEqual({ newClaims: [] });

    expect(mockedCreateClaimsForPR).toHaveBeenCalledTimes(0);

    expect(mockedCreateClaimsForIssue).toHaveBeenCalledTimes(1);
    expect(mockedCreateClaimsForIssue).toHaveBeenCalledWith(
      issue.organization,
      issue.repo,
      issue.issueNumber,
      contributorId + 1,
    );

    expect(mockedRetrieveClaimsCreatedByPR).toHaveBeenCalledTimes(0);

    expect(mockedRetrieveClaimsCreatedByMention).toHaveBeenCalledTimes(1);
    expect(mockedRetrieveClaimsCreatedByMention).toHaveBeenCalledWith(contributionId);
  });
});

describe('DELETE /claims/:id', () => {
  it('Fails with no Access Token provided', async () => {
    contextMock.prisma.claim.findUnique.mockResolvedValue(null);
    const result = await request(await setupApp())
      .delete(`/claims/${claimId}`)
      .send();

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectFindUniqueCalls = (count = 1) => {
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(count);
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledWith({
      where: { id: claimId },
      select: {
        status: true,
        gitPOAP: {
          select: {
            id: true,
            type: true,
            creatorAddressId: true,
          },
        },
      },
    });
  };

  it('Succeeds if the claim is already deleted', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue(null);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/claims/${claimId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(200);

    expectFindUniqueCalls();
  });

  it('Fails if the claim is not CUSTOM and user is not a staff member', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      gitPOAP: { type: GitPOAPType.ANNUAL },
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/claims/${claimId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expectFindUniqueCalls();
  });

  it('Fails if claim is CUSTOM and creatorAddress does not exist', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      gitPOAP: {
        type: GitPOAPType.CUSTOM,
        creatorAddressId: null,
      },
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/claims/${claimId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(500);

    expectFindUniqueCalls();
  });

  it('Fails if claim is CUSTOM the caller is not the creator', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      gitPOAP: {
        type: GitPOAPType.CUSTOM,
        creatorAddressId: addressId + 2,
      },
    } as any);
    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .delete(`/claims/${claimId}`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expectFindUniqueCalls();
  });

  it('Fails if the Claim is not UNCLAIMED', async () => {
    mockJwtWithAddress();
    const testClaimStatusValue = async (
      type: GitPOAPType,
      status: ClaimStatus,
      creatorAddressId?: number,
    ) => {
      const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);

      contextMock.prisma.claim.findUnique.mockResolvedValueOnce({
        status,
        gitPOAP: {
          type,
          creatorAddressId,
        },
      } as any);
      const result = await request(await setupApp())
        .delete(`/claims/${claimId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send();
      expect(result.statusCode).toEqual(400);
    };

    await testClaimStatusValue(GitPOAPType.ANNUAL, ClaimStatus.PENDING);
    await testClaimStatusValue(GitPOAPType.ANNUAL, ClaimStatus.MINTING);
    await testClaimStatusValue(GitPOAPType.ANNUAL, ClaimStatus.CLAIMED);
    await testClaimStatusValue(GitPOAPType.CUSTOM, ClaimStatus.PENDING, addressId);
    await testClaimStatusValue(GitPOAPType.CUSTOM, ClaimStatus.MINTING, addressId);
    await testClaimStatusValue(GitPOAPType.CUSTOM, ClaimStatus.CLAIMED, addressId);

    expectFindUniqueCalls(6);
  });

  it('Succeeds if Claim is UNCLAIMED', async () => {
    mockJwtWithAddress();
    // ANNUAL
    {
      contextMock.prisma.claim.findUnique.mockResolvedValueOnce({
        status: ClaimStatus.UNCLAIMED,
        gitPOAP: {
          type: GitPOAPType.ANNUAL,
          creatorAddressId: null,
        },
      } as any);
      const authTokens = genAuthTokens(STAFF_ADDRESSES[0]);
      const result = await request(await setupApp())
        .delete(`/claims/${claimId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send();

      expect(result.statusCode).toEqual(200);

      expect(contextMock.prisma.claim.deleteMany).toHaveBeenCalledTimes(1);
      expect(contextMock.prisma.claim.deleteMany).toHaveBeenCalledWith({
        where: { id: claimId },
      });
    }
    // CUSTOM
    {
      contextMock.prisma.claim.findUnique.mockResolvedValueOnce({
        status: ClaimStatus.UNCLAIMED,
        gitPOAP: {
          type: GitPOAPType.CUSTOM,
          creatorAddressId: addressId,
        },
      } as any);
      const authTokens = genAuthTokens();
      const result = await request(await setupApp())
        .delete(`/claims/${claimId}`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send();

      expect(result.statusCode).toEqual(200);

      expect(contextMock.prisma.claim.deleteMany).toHaveBeenCalledTimes(2);
      expect(contextMock.prisma.claim.deleteMany).toHaveBeenLastCalledWith({
        where: { id: claimId },
      });
    }

    expectFindUniqueCalls(2);
  });
});

describe('POST /claims', () => {
  it('Fails with no Access Token provided', async () => {
    const result = await request(await setupApp())
      .post(`/claims`)
      .send({ claimIds: [] });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  it('Fails with invalid request body', async () => {
    mockJwtWithAddress();

    const authTokens = genAuthTokens();
    const result = await request(await setupApp())
      .post(`/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claims: [] });

    expect(result.statusCode).toEqual(400);

    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(0);
  });

  const expectFindUniqueClaims = (claimIds: number[]) => {
    expect(contextMock.prisma.claim.findUnique).toHaveBeenCalledTimes(claimIds.length);
    for (let i = 0; i < claimIds.length; ++i) {
      expect(contextMock.prisma.claim.findUnique).toHaveBeenNthCalledWith(i + 1, {
        where: {
          id: claimIds[i],
        },
        include: {
          githubUser: {
            select: {
              githubId: true,
              githubHandle: true,
            },
          },
          gitPOAP: true,
        },
      });
    }
  };

  it('Fails when Claim not found', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue(null);

    const authTokens = genAuthTokens();
    const claimIds = [claimId];
    const result = await request(await setupApp())
      .post(`/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimIds });

    expect(result.statusCode).toEqual(400);
    expect(result.body).toEqual({
      claimed: [],
      invalid: [
        {
          claimId,
          reason: `Claim doesn't exist`,
        },
      ],
    });

    expectFindUniqueClaims(claimIds);
  });

  it('Fails when GitPOAP is not enabled', async () => {
    mockJwtWithAddress();
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      gitPOAP: {
        id: gitPOAPId,
        isEnabled: false,
      },
    } as any);

    const authTokens = genAuthTokens();
    const claimIds = [claimId];
    const result = await request(await setupApp())
      .post(`/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimIds });

    expect(result.statusCode).toEqual(400);
    expect(result.body).toEqual({
      claimed: [],
      invalid: [
        {
          claimId,
          reason: `GitPOAP ID ${gitPOAPId} is not enabled`,
        },
      ],
    });

    expectFindUniqueClaims(claimIds);
  });

  it('Fails when GitPOAP is not UNCLAIMED', async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();

    const runTestOnStatus = async (status: ClaimStatus) => {
      contextMock.prisma.claim.findUnique.mockResolvedValueOnce({
        status,
        gitPOAP: {
          id: gitPOAPId,
          isEnabled: true,
        },
      } as any);

      const result = await request(await setupApp())
        .post(`/claims`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ claimIds: [claimId] });

      expect(result.statusCode).toEqual(400);
      expect(result.body).toEqual({
        claimed: [],
        invalid: [
          {
            claimId,
            reason: `Claim has status '${status}'`,
          },
        ],
      });
    };

    await runTestOnStatus(ClaimStatus.PENDING);
    await runTestOnStatus(ClaimStatus.MINTING);
    await runTestOnStatus(ClaimStatus.CLAIMED);

    expectFindUniqueClaims([claimId, claimId, claimId]);
  });

  it("Fails when user doesn't own claim", async () => {
    mockJwtWithAddress();
    const authTokens = genAuthTokens();

    const runTest = async () => {
      const result = await request(await setupApp())
        .post(`/claims`)
        .set('Authorization', `Bearer ${authTokens.accessToken}`)
        .send({ claimIds: [claimId] });

      expect(result.statusCode).toEqual(400);
      expect(result.body).toEqual({
        claimed: [],
        invalid: [
          {
            claimId,
            reason: "User doesn't own Claim",
          },
        ],
      });
    };

    const claimBase = {
      status: ClaimStatus.UNCLAIMED,
      gitPOAP: {
        id: gitPOAPId,
        isEnabled: true,
      },
    };

    contextMock.prisma.claim.findUnique.mockResolvedValueOnce({
      ...claimBase,
      githubUser: { githubId: githubId + 1 },
    } as any);
    await runTest();

    contextMock.prisma.claim.findUnique.mockResolvedValueOnce({
      ...claimBase,
      issuedAddressId: addressId + 1,
    } as any);
    await runTest();

    contextMock.prisma.claim.findUnique.mockResolvedValueOnce({
      ...claimBase,
      emailAddress: emailAddress + '1',
    } as any);
    await runTest();

    expectFindUniqueClaims([claimId, claimId, claimId]);
  });

  it('Fails when there are no more RedeemCodes', async () => {
    mockJwtWithAddress();
    const gitPOAP = {
      id: gitPOAPId,
      isEnabled: true,
    };
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      status: ClaimStatus.UNCLAIMED,
      gitPOAP,
      emailAddress: emailAddress + '1',
    } as any);
    mockedChooseUnusedRedeemCode.mockResolvedValue(null);

    const authTokens = genAuthTokens();
    const claimIds = [claimId];
    const result = await request(await setupApp())
      .post(`/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimIds });

    expect(result.statusCode).toEqual(400);
    expect(result.body).toEqual({
      claimed: [],
      invalid: [
        {
          claimId,
          reason: `GitPOAP ID ${gitPOAPId} has no more redeem codes`,
        },
      ],
    });

    expectFindUniqueClaims(claimIds);

    expect(mockedChooseUnusedRedeemCode).toHaveBeenCalledTimes(1);
    expect(mockedChooseUnusedRedeemCode).toHaveBeenCalledWith(gitPOAP);
  });

  it('Fails when POAP API redeem call fails', async () => {
    mockJwtWithAddress();
    const gitPOAP = {
      id: gitPOAPId,
      isEnabled: true,
    };
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      status: ClaimStatus.UNCLAIMED,
      gitPOAP,
      emailAddress: emailAddress + '1',
    } as any);
    mockedChooseUnusedRedeemCode.mockResolvedValue({
      id: redeemCodeId,
      code: redeemCode,
    } as any);
    mockedRedeemPOAP.mockResolvedValue(null);

    const authTokens = genAuthTokens();
    const claimIds = [claimId];
    const result = await request(await setupApp())
      .post(`/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimIds });

    expect(result.statusCode).toEqual(400);
    expect(result.body).toEqual({
      claimed: [],
      invalid: [
        {
          claimId,
          reason: `Failed to claim via POAP API`,
        },
      ],
    });

    expectFindUniqueClaims(claimIds);

    expect(mockedChooseUnusedRedeemCode).toHaveBeenCalledTimes(1);
    expect(mockedChooseUnusedRedeemCode).toHaveBeenCalledWith(gitPOAP);

    expect(mockedDeleteRedeemCode).toHaveBeenCalledTimes(1);
    expect(mockedDeleteRedeemCode).toHaveBeenCalledWith(redeemCodeId);

    expect(mockedUpdateClaimStatusById).toHaveBeenCalledTimes(2);
    expect(mockedUpdateClaimStatusById).toHaveBeenNthCalledWith(
      1,
      claimId,
      ClaimStatus.PENDING,
      addressId,
    );

    expect(mockedRedeemPOAP).toHaveBeenCalledTimes(1);
    expect(mockedRedeemPOAP).toHaveBeenCalledWith(address, redeemCode);

    expect(mockedUpsertRedeemCode).toHaveBeenCalledTimes(1);
    expect(mockedUpsertRedeemCode).toHaveBeenCalledWith(gitPOAPId, redeemCode);

    expect(mockedUpdateClaimStatusById).toHaveBeenNthCalledWith(
      2,
      claimId,
      ClaimStatus.UNCLAIMED,
      null,
    );
  });

  const expectSendInternalClaimMessage = () => {
    expect(mockedSendInternalClaimMessage).toHaveBeenCalledTimes(1);
    expect(mockedSendInternalClaimMessage).toHaveBeenCalledWith(
      [
        {
          claimId,
          gitPOAPId,
          gitPOAPName,
          githubHandle: null,
          emailAddress,
          mintedAddress: address,
          poapEventId,
        },
      ],
      address,
      ensName,
    );
  };

  const expectRunClaimsPostProcessing = () => {
    expect(mockedRunClaimsPostProcessing).toHaveBeenCalledTimes(1);
    expect(mockedRunClaimsPostProcessing).toHaveBeenCalledWith([
      {
        id: claimId,
        qrHash: redeemCode,
        gitPOAP: {
          id: gitPOAPId,
          poapEventId,
        },
        mintedAddress: { ethAddress: address },
      },
    ]);
  };

  it('Succeeds when POAP API redeem call completes', async () => {
    mockJwtWithAddress();
    const gitPOAP = {
      id: gitPOAPId,
      name: gitPOAPName,
      isEnabled: true,
      poapEventId,
    };
    contextMock.prisma.claim.findUnique.mockResolvedValue({
      status: ClaimStatus.UNCLAIMED,
      gitPOAP,
      emailAddress,
    } as any);
    mockedChooseUnusedRedeemCode.mockResolvedValue({
      id: redeemCodeId,
      code: redeemCode,
    } as any);
    mockedRedeemPOAP.mockResolvedValue({ qr_hash: redeemCode } as any);

    const authTokens = genAuthTokens();
    const claimIds = [claimId];
    const result = await request(await setupApp())
      .post(`/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimIds });

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual({ claimed: claimIds, invalid: [] });

    expectFindUniqueClaims(claimIds);

    expect(mockedChooseUnusedRedeemCode).toHaveBeenCalledTimes(1);
    expect(mockedChooseUnusedRedeemCode).toHaveBeenCalledWith(gitPOAP);

    expect(mockedDeleteRedeemCode).toHaveBeenCalledTimes(1);
    expect(mockedDeleteRedeemCode).toHaveBeenCalledWith(redeemCodeId);

    expect(mockedUpdateClaimStatusById).toHaveBeenCalledTimes(1);
    expect(mockedUpdateClaimStatusById).toHaveBeenCalledWith(
      claimId,
      ClaimStatus.PENDING,
      addressId,
    );

    expect(mockedRedeemPOAP).toHaveBeenCalledTimes(1);
    expect(mockedRedeemPOAP).toHaveBeenCalledWith(address, redeemCode);

    expect(contextMock.prisma.claim.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.claim.update).toHaveBeenCalledWith({
      where: {
        id: claimId,
      },
      data: {
        status: ClaimStatus.MINTING,
        qrHash: redeemCode,
      },
    });

    expect(mockedEnsureRedeemCodeThreshold).toHaveBeenCalledTimes(1);
    expect(mockedEnsureRedeemCodeThreshold).toHaveBeenCalledWith(gitPOAP);

    expectSendInternalClaimMessage();

    expectRunClaimsPostProcessing();
  });

  it('Succeeds on multiple claims when one fails', async () => {
    mockJwtWithAddress();
    const gitPOAP = {
      id: gitPOAPId,
      name: gitPOAPName,
      isEnabled: true,
      poapEventId,
    };
    contextMock.prisma.claim.findUnique.mockResolvedValueOnce(null);
    contextMock.prisma.claim.findUnique.mockResolvedValueOnce({
      status: ClaimStatus.UNCLAIMED,
      gitPOAP,
      emailAddress,
    } as any);
    mockedChooseUnusedRedeemCode.mockResolvedValue({
      id: redeemCodeId,
      code: redeemCode,
    } as any);
    mockedRedeemPOAP.mockResolvedValue({ qr_hash: redeemCode } as any);

    const authTokens = genAuthTokens();
    const claimIds = [claimId - 1, claimId];
    const result = await request(await setupApp())
      .post(`/claims`)
      .set('Authorization', `Bearer ${authTokens.accessToken}`)
      .send({ claimIds });

    expect(result.statusCode).toEqual(200);
    expect(result.body).toEqual({
      claimed: [claimId],
      invalid: [
        {
          claimId: claimId - 1,
          reason: "Claim doesn't exist",
        },
      ],
    });

    expectFindUniqueClaims(claimIds);

    expect(mockedChooseUnusedRedeemCode).toHaveBeenCalledTimes(1);
    expect(mockedChooseUnusedRedeemCode).toHaveBeenCalledWith(gitPOAP);

    expect(mockedDeleteRedeemCode).toHaveBeenCalledTimes(1);
    expect(mockedDeleteRedeemCode).toHaveBeenCalledWith(redeemCodeId);

    expect(mockedUpdateClaimStatusById).toHaveBeenCalledTimes(1);
    expect(mockedUpdateClaimStatusById).toHaveBeenCalledWith(
      claimId,
      ClaimStatus.PENDING,
      addressId,
    );

    expect(mockedRedeemPOAP).toHaveBeenCalledTimes(1);
    expect(mockedRedeemPOAP).toHaveBeenCalledWith(address, redeemCode);

    expect(contextMock.prisma.claim.update).toHaveBeenCalledTimes(1);
    expect(contextMock.prisma.claim.update).toHaveBeenCalledWith({
      where: {
        id: claimId,
      },
      data: {
        status: ClaimStatus.MINTING,
        qrHash: redeemCode,
      },
    });

    expect(mockedEnsureRedeemCodeThreshold).toHaveBeenCalledTimes(1);
    expect(mockedEnsureRedeemCodeThreshold).toHaveBeenCalledWith(gitPOAP);

    expectSendInternalClaimMessage();

    expectRunClaimsPostProcessing();
  });
});
