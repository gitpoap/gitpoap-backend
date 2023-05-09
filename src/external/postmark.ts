import { Errors, ServerClient } from 'postmark';
import { POSTMARK_SERVER_TOKEN } from '../environment';
import { GitPOAPRequestEmailForm, GitPOAPRequestEmailAlias } from '../types/gitpoaps';
import { generateGitPOAPRequestLink, generateGitPOAPLink } from '../routes/gitpoaps/utils';
import { createScopedLogger } from '../logging';
import {
  GITPOAP_ROOT_URL,
  TEAM_EMAIL,
  COMPANY_NAME,
  COMPANY_ADDRESS,
  PRODUCT_NAME,
  TEAM_NAME,
  GITPOAP_DOC_URL,
} from '../constants';

export const postmarkClient = new ServerClient(POSTMARK_SERVER_TOKEN);

const baseTemplate = {
  product_url: GITPOAP_ROOT_URL,
  product_name: PRODUCT_NAME,
  support_email: TEAM_EMAIL,
  company_name: COMPANY_NAME,
  company_address: COMPANY_ADDRESS,
  sender_name: TEAM_NAME,
  help_url: GITPOAP_DOC_URL,
};

/* -- Email Dispatch Handlers -- */
type SendEmailWithTemplateArgs<T> = {
  to: string;
  from: string;
  alias: string;
  templateModel: T;
};
const sendEmailWithTemplateHandler = async <T extends Record<string, string | number | undefined>>({
  to,
  from,
  alias,
  templateModel,
}: SendEmailWithTemplateArgs<T>) => {
  const logger = createScopedLogger('sendEmailWithTemplateHandler');
  try {
    logger.info(`Sending email template ${alias} to: ${to}, from: ${alias}`);
    const response = await postmarkClient.sendEmailWithTemplate({
      From: from,
      To: to,
      TemplateAlias: alias,
      TemplateModel: templateModel,
    });

    return response;
  } catch (e) {
    if (e instanceof Errors.InactiveRecipientsError) {
      logger.warn(`Email "${to}" is no longer an active recipient: ${e}`);
      return null;
    }

    logger.error(`Failed to send template email - ${e}`);
    return null;
  }
};

/* -- Specific Email Dispatch Functions -- */
export const sendVerificationEmail = async (email: string, activeToken: string) =>
  await sendEmailWithTemplateHandler({
    to: email,
    from: TEAM_EMAIL,
    alias: 'verify-email',
    templateModel: {
      ...baseTemplate,
      token: activeToken,
    },
  });

export const sendGitPOAPRequestConfirmationEmail = async (formData: GitPOAPRequestEmailForm) =>
  await sendGitPOAPRequestEmail(
    GitPOAPRequestEmailAlias.RECEIVED,
    formData,
    generateGitPOAPRequestLink(formData.id),
  );

export const sendGitPOAPRequestRejectionEmail = async (formData: GitPOAPRequestEmailForm) =>
  await sendGitPOAPRequestEmail(
    GitPOAPRequestEmailAlias.REJECTED,
    formData,
    generateGitPOAPRequestLink(formData.id),
  );

export const sendGitPOAPRequestLiveEmail = async (formData: GitPOAPRequestEmailForm) =>
  await sendGitPOAPRequestEmail(
    GitPOAPRequestEmailAlias.LIVE,
    formData,
    generateGitPOAPLink(formData.id),
  );

export const sendGitPOAPRequestEmail = async (
  alias: GitPOAPRequestEmailAlias,
  formData: GitPOAPRequestEmailForm,
  link: string,
) =>
  await sendEmailWithTemplateHandler({
    to: formData.email,
    from: TEAM_EMAIL,
    alias,
    templateModel: {
      ...baseTemplate,
      gitpoap_name: formData.name,
      gitpoap_image: formData.imageUrl,
      gitpoap_description: formData.description,
      gitpoap_rejection_reason: formData.rejectionReason,
      gitpoap_link: link,
      gitpoap_start_date: formData.startDate,
      gitpoap_end_date: formData.startDate,
    },
  });
