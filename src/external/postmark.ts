import { ServerClient } from 'postmark';
import { POSTMARK_SERVER_TOKEN } from '../environment';

export const postmarkClient = new ServerClient(POSTMARK_SERVER_TOKEN);

export const sendVerificationEmail = async (email: string, activeToken: string) => {
  postmarkClient.sendEmailWithTemplate({
    From: 'team@gitpoap.io',
    To: email,
    TemplateAlias: 'verify-email',
    TemplateModel: {
      product_url: 'gitpoap.io',
      product_name: 'GitPOAP',
      token: activeToken,
      support_email: 'team@gitpoap.io',
      company_name: 'MetaRep Labs Inc',
      company_address: 'One Broadway, Cambridge MA 02142',
    },
  });
};
