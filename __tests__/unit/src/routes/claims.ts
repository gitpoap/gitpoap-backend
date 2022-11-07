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
  ClaimData,
  retrieveClaimsCreatedByPR,
  retrieveClaimsCreatedByMention,
} from '../../../../src/lib/claims';
import { generateAuthTokens } from '../../../../src/lib/authTokens';
import { ADMIN_ADDRESSES } from '../../../../src/constants';
import { ADDRESSES } from '../../../../prisma/constants';
import { ClaimStatus, GitPOAPType } from '@prisma/client';

jest.mock('../../../../src/logging');
jest.mock('../../../../src/external/github');
jest.mock('../../../../src/lib/bot');
jest.mock('../../../../src/lib/claims');

const mockedGetGithubAuthenticatedApp = jest.mocked(getGithubAuthenticatedApp, true);
const mockedCreateClaimsForPR = jest.mocked(createClaimsForPR, true);
const mockedCreateClaimsForIssue = jest.mocked(createClaimsForIssue, true);
const mockedRetrieveClaimsCreatedByPR = jest.mocked(retrieveClaimsCreatedByPR, true);
const mockedRetrieveClaimsCreatedByMention = jest.mocked(retrieveClaimsCreatedByMention, true);

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
const claim: ClaimData = {
  id: claimId,
  githubUser: {
    githubId: contributorId,
    githubHandle: 'batman',
  },
  gitPOAP: {
    id: 234,
    name: 'Wow you arrrrr great',
    imageUrl: 'https://example.com/image.png',
    description: 'You are clearly a rockstar',
    threshold: 1,
  },
};
const addressId = 2342222;
const address = ADDRESSES.vitalik;
const authTokenId = 2;
const authTokenGeneration = 32;
const ensName = null;
const ensAvatarImageUrl = null;

function mockJwtWithAddress() {
  contextMock.prisma.authToken.findUnique.mockResolvedValue({
    id: authTokenId,
    address: { ensName, ensAvatarImageUrl },
  } as any);
}

function genAuthTokens(someAddress?: string) {
  return generateAuthTokens(
    authTokenId,
    authTokenGeneration,
    addressId,
    someAddress ?? address,
    ensName,
    ensAvatarImageUrl,
    null,
    null,
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
    expect(mockedRetrieveClaimsCreatedByPR).toHaveBeenCalledWith(contributionId);

    expect(mockedRetrieveClaimsCreatedByMention).toHaveBeenCalledTimes(1);
    expect(mockedRetrieveClaimsCreatedByMention).toHaveBeenCalledWith(contributionId);
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

  it('Fails if the claim is not CUSTOM and user is not an admin', async () => {
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
      const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);

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
      const authTokens = genAuthTokens(ADMIN_ADDRESSES[0]);
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
