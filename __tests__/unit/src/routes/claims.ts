import { setupApp } from '../../../../src/app';
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

jest.mock('../../../../src/external/github');
jest.mock('../../../../src/lib/bot');
jest.mock('../../../../src/lib/claims');

const mockedGetGithubAuthenticatedApp = jest.mocked(getGithubAuthenticatedApp, true);
const mockedCreateClaimsForPR = jest.mocked(createClaimsForPR, true);
const mockedCreateClaimsForIssue = jest.mocked(createClaimsForIssue, true);
const mockedRetrieveClaimsCreatedByPR = jest.mocked(retrieveClaimsCreatedByPR, true);
const mockedRetrieveClaimsCreatedByMention = jest.mocked(retrieveClaimsCreatedByMention, true);

const authToken = 'foobar2';
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
const claim: ClaimData = {
  id: 234,
  user: {
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
      .set('Authorization', `Bearer ${authToken}`)
      .send();

    expect(result.statusCode).toEqual(400);

    expect(mockedGetGithubAuthenticatedApp).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubAuthenticatedApp).toHaveBeenCalledWith(authToken);
  });

  it("Fails when app isn't gitpoap-bot", async () => {
    const appId = 23423423;

    mockedGetGithubAuthenticatedApp.mockResolvedValue(appId);

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${authToken}`)
      .send();

    expect(result.statusCode).toEqual(401);

    expect(mockedGetGithubAuthenticatedApp).toHaveBeenCalledTimes(1);
    expect(mockedGetGithubAuthenticatedApp).toHaveBeenCalledWith(authToken);
  });

  it('Fails on invalid request bodies', async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID });

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ bad: 'body' });

      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pullRequest: [] });

      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ issue: [] });

      expect(result.statusCode).toEqual(400);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
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
        .set('Authorization', `Bearer ${authToken}`)
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
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID });

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...pullRequest, contributorGithubIds: [4, 5] });

    expect(result.statusCode).toEqual(400);

    expect(mockedCreateClaimsForPR).toHaveBeenCalledTimes(0);
  });

  it("Fails for issues that aren't from mentions", async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID });

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ ...issue, wasEarnedByMention: false });

    expect(result.statusCode).toEqual(400);

    expect(mockedCreateClaimsForIssue).toHaveBeenCalledTimes(0);
  });

  it('Fails when repository is not in DB', async () => {
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID });
    mockedCreateClaimsForPR.mockResolvedValue(BotCreateClaimsErrorType.RepoNotFound);
    mockedCreateClaimsForIssue.mockResolvedValue(BotCreateClaimsErrorType.GithubRecordNotFound);

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pullRequest });

      expect(result.statusCode).toEqual(404);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
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
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID });
    mockedCreateClaimsForPR.mockResolvedValue(BotCreateClaimsErrorType.GithubRecordNotFound);
    mockedCreateClaimsForIssue.mockResolvedValue(BotCreateClaimsErrorType.GithubRecordNotFound);

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pullRequest });

      expect(result.statusCode).toEqual(404);
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
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
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID });
    mockedCreateClaimsForIssue.mockResolvedValue({ pullRequest: { id: 3 } });

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${authToken}`)
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
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID });
    mockedCreateClaimsForPR.mockResolvedValue(BotCreateClaimsErrorType.BotUser);
    mockedCreateClaimsForIssue.mockResolvedValue(BotCreateClaimsErrorType.BotUser);

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pullRequest });

      expect(result.statusCode).toEqual(200);
      expect(JSON.parse(result.text)).toEqual({ newClaims: [] });
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
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
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID });

    const contributionId = 324;

    mockedCreateClaimsForPR.mockResolvedValue({ pullRequest: { id: contributionId } } as any);
    mockedCreateClaimsForIssue.mockResolvedValue({ mention: { id: contributionId } } as any);

    mockedRetrieveClaimsCreatedByPR.mockResolvedValue([claim]);
    mockedRetrieveClaimsCreatedByMention.mockResolvedValue([claim]);

    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ pullRequest });

      expect(result.statusCode).toEqual(200);
      expect(JSON.parse(result.text)).toEqual({ newClaims: [claim] });
    }
    {
      const result = await request(await setupApp())
        .post('/claims/gitpoap-bot/create')
        .set('Authorization', `Bearer ${authToken}`)
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
    mockedGetGithubAuthenticatedApp.mockResolvedValue({ id: GITPOAP_BOT_APP_ID });

    const contributionId = 324;

    mockedCreateClaimsForIssue.mockResolvedValue({ mention: { id: contributionId } } as any);

    mockedRetrieveClaimsCreatedByMention.mockResolvedValue([claim]);

    const result = await request(await setupApp())
      .post('/claims/gitpoap-bot/create')
      .set('Authorization', `Bearer ${authToken}`)
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
