import mailChimpClient, { MemberErrorResponse } from '@mailchimp/mailchimp_marketing';
import { MAILCHIMP_API_KEY } from '../environment';
import { createScopedLogger } from '../logging';
import { mailChimpRequestDurationSeconds } from '../metrics';

type MailChimpError = {
  status: number;
  response: {
    body: MemberErrorResponse;
  };
};

/* Type guard to check if the error is a MailChimp error */
const isMailChimpError = (error: unknown): error is MailChimpError => {
  return (
    (error as MailChimpError).status !== undefined &&
    (error as MailChimpError).response.body !== undefined &&
    (error as MailChimpError).response.body.title !== undefined &&
    (error as MailChimpError).response.body.status !== undefined &&
    (error as MailChimpError).response.body.detail !== undefined &&
    (error as MailChimpError).response.body.instance !== undefined
  );
};

mailChimpClient.setConfig({
  apiKey: MAILCHIMP_API_KEY,
  /* server is everything after the "-" in the API key. Ex: "us14" */
  server: MAILCHIMP_API_KEY.split('-')[1],
});

export const addListMember = async (email: string, listId: string) => {
  const logger = createScopedLogger('MailChimp: Add List Member');
  logger.debug(`Params: email: ${email}, listId: ${listId}`);
  const endTimer = mailChimpRequestDurationSeconds.startTimer('POST', '/lists/{listId}/members');

  try {
    /* Directly add email address to mailchimp list */
    const res = await mailChimpClient.lists.addListMember(listId, {
      email_address: email,
      status: 'subscribed',
    });

    endTimer({ success: 1 });
    return res;
  } catch (error: unknown) {
    if (isMailChimpError(error)) {
      logger.warn(
        `Bad response from MailChimp API (${error.response.body.status}): ${error.response.body.title} - ${error.response.body.detail}`,
      );
    } else {
      logger.warn(`Error while calling MailChimp API: ${error}`);
    }

    endTimer({ success: 0 });
    return null;
  }
};
