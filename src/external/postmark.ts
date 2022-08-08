import { Message, ServerClient } from 'postmark';
import { NODE_ENV, POSTMARK_SERVER_TOKEN } from '../environment';

const postmarkClient = new ServerClient(POSTMARK_SERVER_TOKEN);

/**
 * This function wraps the Postmark sendEmail function to send an email. It will
 * replace the To email address with an internal developer email address if the
 * environment is set to anything other than "production".

 * @param email The email object to send - see Postmark API for details
 */
export const sendEmail = async (email: Message) => {
  const params = { ...email };
  if (NODE_ENV !== 'production') {
    params.To = 'test@gitpoap.io';
  }

  return await postmarkClient.sendEmail(email);
};
