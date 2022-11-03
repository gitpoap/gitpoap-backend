import { GitPOAPRequest } from '@prisma/client';
import { WebClient } from '@slack/web-api';
import { SLACK_TOKEN } from '../environment';
import { createScopedLogger } from '../logging';

const slackClient = new WebClient(SLACK_TOKEN);

type SlackOrgs = 'gitpoap';

type SlackChannels = {
  [org in SlackOrgs]: Record<string, string>;
};

const CHANNELS: SlackChannels = {
  gitpoap: {
    alerts: 'C049AGT4BHN',
  },
};

const sendSlackMessage = async (message: string, channelId: string) => {
  const logger = createScopedLogger('sendSlackMessage');
  try {
    logger.debug(`Sending slack message to channel: ${channelId}`);
    await slackClient.chat.postMessage({
      channel: channelId,
      text: message,
    });
  } catch (e) {
    logger.error(`${e}`);
  }
};

const sendInternalMessage = async (message: string) =>
  await sendSlackMessage(message, CHANNELS.gitpoap.alerts);

/** -- Use-case specific slack messages -- **/
export const sendInternalClaimMessage = async (
  claims: number[],
  githubHandle: string,
  address: string,
) => {
  const profileLink = `<https://www.gitpoap.io/p/${address}|GitPOAP Profile>`;
  const etherscanLink = `<https://etherscan.io/address/${address}|${address}>`;
  const githubLink = `<https://github.com/${githubHandle}|${githubHandle}>`;
  const topMsg = `💸 GitHub user ${githubLink} with address ${etherscanLink} (${profileLink}) Claimed new GitPOAP(s)! 🥳`;
  let list = '';
  for (const claim of claims) {
    list += `\n* <https://www.gitpoap.io/gp/${claim}|GitPOAP ID ${claim}>`
  }
  await sendInternalMessage(topMsg + list);
};

export const sentInternalGitPOAPRequestMessage = async ({ id, name }: GitPOAPRequest) => {
  const msg = `📬 Received request to create GitPOAP - Request ID: ${id}, Name: ${name}. View https://gitpoap.io/admin/gitpoaps/requests to view more information`;
  await sendInternalMessage(msg);
};
