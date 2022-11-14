import { GitPOAPRequest } from '@prisma/client';
import { WebClient } from '@slack/web-api';
import { SLACK_TOKEN } from '../environment';
import { createScopedLogger } from '../logging';
import { ClaimData, FoundClaim } from '../types/claims';
import { IntakeForm } from '../routes/onboarding/types';
import { shortenAddress } from '../lib/addresses';
import { GITPOAP_ROOT_URL, GITPOAP_DEV_ROOT_URL, IS_PROD } from '../constants';

const slackClient = new WebClient(SLACK_TOKEN);

type SlackOrgs = 'gitpoap';

type SlackChannels = {
  [org in SlackOrgs]: Record<string, string>;
};

const CHANNELS: SlackChannels = {
  gitpoap: {
    alerts: 'C049AGT4BHN',
    onboardingAlerts: 'C049ZSP3TC2',
    gitpoapRequestAlerts: 'C04APHZME3A',
    devAlerts: 'C049XUFTQ5B',
    claimByMentionAlerts: 'C04AXTTRZ9N',
  },
};

const GITPOAP_URL = IS_PROD ? GITPOAP_ROOT_URL : GITPOAP_DEV_ROOT_URL;

const sendSlackMessage = async (message: string, channelId: string) => {
  const logger = createScopedLogger('sendSlackMessage');
  try {
    logger.debug(`Sending slack message to channel: ${channelId}`);
    await slackClient.chat.postMessage({
      channel: IS_PROD ? channelId : CHANNELS.gitpoap.devAlerts,
      text: message,
    });
  } catch (e) {
    logger.error(`${e}`);
  }
};

const sendInternalMessage = async (message: string) =>
  await sendSlackMessage(message, CHANNELS.gitpoap.alerts);

const sendOnboardingMessage = async (message: string) =>
  await sendSlackMessage(message, CHANNELS.gitpoap.onboardingAlerts);

const sendGitPOAPRequestMessage = async (message: string) =>
  await sendSlackMessage(message, CHANNELS.gitpoap.gitpoapRequestAlerts);

function createGithubUserLink(githubHandle: string) {
  return `<https://github.com/${githubHandle}|${githubHandle}>`;
}

function createGitPOAPLinkForClaim(gitPOAPId: number, gitPOAPName: string) {
  return `<${GITPOAP_URL}/gp/${gitPOAPId}|[GitPOAP ID ${gitPOAPId}]: ${gitPOAPName}>`;
}

/** -- Use-case specific slack messages -- **/
export const sendInternalClaimMessage = async (
  claims: FoundClaim[],
  githubHandle: string,
  address: string,
) => {
  const profileLink = `<${GITPOAP_URL}/p/${address}|GitPOAP Profile>`;
  const etherscanLink = `<https://etherscan.io/address/${address}|${shortenAddress(address)}>`;
  const githubLink = createGithubUserLink(githubHandle);
  let msg = `💸 [${profileLink}]: GitHub user ${githubLink} with address ${etherscanLink} claimed new GitPOAP(s)! 🥳`;
  for (const claim of claims) {
    msg += `\n* ${createGitPOAPLinkForClaim(claim.gitPOAPId, claim.gitPOAPName)}`;
  }
  await sendInternalMessage(msg);
};

export const sendInternalGitPOAPRequestMessage = async ({
  id,
  name,
  description,
}: GitPOAPRequest) => {
  const gitPOAPRequestLink = `${GITPOAP_URL}/admin/gitpoap/requests?search=${id}`;
  const msg = `📬 Received request to create a Custom GitPOAP! View ${gitPOAPRequestLink} to view more information.
* Request ID: ${id}
* Name: ${name}
* Description: ${description}`;

  await sendGitPOAPRequestMessage(msg);
};

function getGithubRepoLink(fullRepoName: string) {
  return `<https://github.com/${fullRepoName}|${fullRepoName}>`;
}

export const sendInternalOnboardingMessage = async (
  githubHandle: string,
  formData: IntakeForm,
  fullRepoNames: string[],
) => {
  let msg = `📬 Received request to onboard a new project to GitPOAP! Use DynaList for additional details.
* GitHub handle: ${githubHandle}
* Name: ${formData.name}
* Email: ${formData.email}
* Requested repos:`;

  for (const fullRepoName of fullRepoNames) {
    msg += `\n  * ${getGithubRepoLink(fullRepoName)}`;
  }

  await sendOnboardingMessage(msg);
};

type MentionNumber = { pullRequestNumber: number } | { issueNumber: number };

export async function sendInternalClaimByMentionMessage(
  organization: string,
  repo: string,
  mentionNumber: MentionNumber,
  claims: ClaimData[],
) {
  const logger = createScopedLogger('sendInternalClaimByMentionMessage');

  const repoUrl = `https://github.com/${organization}/${repo}`;
  let mentionUrl;
  if ('pullRequestNumber' in mentionNumber) {
    mentionUrl = `${repoUrl}/pull/${mentionNumber.pullRequestNumber}`;
  } else {
    // 'issueNumber' in mentionNumber
    mentionUrl = `${repoUrl}/issue/${mentionNumber.issueNumber}`;
  }

  const mentionLink = `<${mentionUrl}|Comment Link>`;
  let msg = `📲 [${mentionLink}]: Created ${claims.length} Claim(s) by mention(s)! 🗣`;

  for (const claim of claims) {
    if (claim.githubUser === null) {
      logger.error(
        `Claim (ID: ${claim.id}) created by mention does not have an associated GithubUser`,
      );
      continue;
    }

    const earnerLink = createGithubUserLink(claim.githubUser.githubHandle);
    const gitPOAPLink = createGitPOAPLinkForClaim(claim.id, claim.gitPOAP.name);
    msg += `\n* GitHub User: ${earnerLink} earned ${gitPOAPLink}`;
  }

  await sendSlackMessage(msg, CHANNELS.gitpoap.claimByMentionsAlerts);
}
