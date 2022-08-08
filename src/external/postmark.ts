import { ServerClient } from 'postmark';
import { POSTMARK_SERVER_TOKEN } from '../environment';

export const postmarkClient = new ServerClient(POSTMARK_SERVER_TOKEN);
