import { GitPOAPRequest, GitPOAP } from '@prisma/client';
import { WebClient } from '@slack/web-api';
import { SLACK_TOKEN } from '../environment';
import { createScopedLogger } from '../logging';
import { FoundClaim } from '../types/claims';
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
  },
};

const GITPPOAP_URL = IS_PROD ? GITPOAP_ROOT_URL : GITPOAP_DEV_ROOT_URL;

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

/** -- Use-case specific slack messages -- **/
export const sendInternalClaimMessage = async (
  claims: FoundClaim[],
  githubHandle: string,
  address: string,
) => {
  const profileLink = `<${GITPPOAP_URL}/p/${address}|GitPOAP Profile>`;
  const etherscanLink = `<https://etherscan.io/address/${address}|${shortenAddress(address)}>`;
  const githubLink = `<https://github.com/${githubHandle}|${githubHandle}>`;
  const topMsg = `💸 [${profileLink}]: GitHub user ${githubLink} with address ${etherscanLink} claimed new GitPOAP(s)! 🥳`;
  let list = '';
  for (const claim of claims) {
    list += `\n* <${GITPPOAP_URL}/gp/${claim.gitPOAPId}|[GitPOAP ID ${claim.gitPOAPId}]: ${claim.gitPOAPName}>`;
  }

  await sendInternalMessage(topMsg + list);
};

export const sentInternalGitPOAPRequestMessage = async ({
  id,
  name,
  description,
}: GitPOAPRequest) => {
  const gitPOAPRequestLink = GITPPOAP_URL + `/admin/gitpoap/requests?search=${id}`;
  const msg = `📬 Received request to create GitPOAP - Request ID: ${id}, Name: ${name} Description:${description}. View ${gitPOAPRequestLink} to view more information`;

  await sendGitPOAPRequestMessage(msg);
};

export const sentInternalOnboardingMessage = async ({ id, name, description }: GitPOAP) => {
  const gitPOAPRequestLink = GITPPOAP_URL + `/gp/${id}`;
  const msg = `📬 Received to create GitPOAP - GitPOAP ID: ${id}, Name: ${name} Description:${description}. View ${gitPOAPRequestLink} to view more information`;

  await sendOnboardingMessage(msg);
};
