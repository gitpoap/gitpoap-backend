import { ServerClient } from 'postmark';
import { POSTMARK_SERVER_TOKEN } from '../environment';
import { IntakeFormReposSchema } from '../schemas/onboarding';
import { z } from 'zod';
import { formatRepos } from '../routes/onboarding/utils';
import { IntakeForm } from '../routes/onboarding/types';
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
    console.error(`Failed to send template email - ${e}`);
    return null;
  }
};

type SendTextEmailArgs = {
  to: string;
  from: string;
  subject: string;
  textBody: string;
};

const sendTextEmailHandler = async ({ to, from, subject, textBody }: SendTextEmailArgs) => {
  const logger = createScopedLogger('sendTextEmailHandler');
  try {
    logger.info(`Sending email to: ${to}, from: ${from}, ${subject}`);
    const response = await postmarkClient.sendEmail({
      From: from,
      To: to,
      Subject: subject,
      TextBody: textBody,
    });

    return response;
  } catch (e) {
    console.error(`Failed to send text email - ${e}`);
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

export const sendConfirmationEmail = async (
  githubHandle: string,
  formData: IntakeForm,
  queueNumber: number | undefined,
) =>
  await sendEmailWithTemplateHandler({
    to: formData.email,
    from: TEAM_EMAIL,
    alias: 'welcome-1',
    templateModel: {
      ...baseTemplate,
      queue_number: queueNumber ?? '',
      name: formData.name,
      email: formData.email,
      githubHandle,
      shouldGitPOAPDesign: formData.shouldGitPOAPDesign === 'true' ? 'GitPOAP' : 'You',
      isOneGitPOAPPerRepo: formData.isOneGitPOAPPerRepo === 'true' ? 'One Per Repo' : 'One For All',
      notes: formData.notes,
      repos: formatRepos(JSON.parse(formData.repos)),
    },
  });

export const sendInternalConfirmationEmail = async (
  githubHandle: string,
  formData: IntakeForm,
  queueNumber: number | undefined,
  urls: string[],
) => {
  await sendTextEmailHandler({
    to: TEAM_EMAIL,
    from: TEAM_EMAIL,
    subject: `New intake form submission from ${githubHandle} / ${formData.email} `,
    textBody: `
    New intake form submission from ${githubHandle} / ${formData.email}
    Queue number: ${queueNumber ?? ''}
    Name: ${formData.name}
    Email: ${formData.email}
    Notes: ${formData.notes}
    Github Handle: ${githubHandle}
    Should GitPOAP Design: ${formData.shouldGitPOAPDesign}
    Is One GitPOAP Per Repo: ${formData.isOneGitPOAPPerRepo}
    \n
    Repos:
    ${JSON.parse(formData.repos).map(
      (repo: z.infer<typeof IntakeFormReposSchema>[number]) => repo.full_name,
    )}
    \n
    Images:
    ${urls.join('\n')}
    `,
  });
};

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
