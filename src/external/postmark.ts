import { ServerClient } from 'postmark';
import { POSTMARK_SERVER_TOKEN } from '../environment';
import { IntakeFormReposSchema } from '../schemas/onboarding';
import { z } from 'zod';
import { formatRepos } from '../routes/onboarding/utils';
import { IntakeForm } from '../routes/onboarding/types';
import { createScopedLogger } from '../logging';

export const postmarkClient = new ServerClient(POSTMARK_SERVER_TOKEN);

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
    from: 'team@gitpoap.io',
    alias: 'verify-email',
    templateModel: {
      product_url: 'gitpoap.io',
      product_name: 'GitPOAP',
      token: activeToken,
      support_email: 'team@gitpoap.io',
      company_name: 'MetaRep Labs Inc',
      company_address: 'One Broadway, Cambridge MA 02142',
    },
  });

export const sendConfirmationEmail = async (
  githubHandle: string,
  formData: IntakeForm,
  queueNumber: number | undefined,
) =>
  await sendEmailWithTemplateHandler({
    to: formData.email,
    from: 'team@gitpoap.io',
    alias: 'welcome-1',
    templateModel: {
      product_url: 'gitpoap.io',
      product_name: 'GitPOAP',
      queue_number: queueNumber ?? '',
      name: formData.name,
      email: formData.email,
      githubHandle,
      shouldGitPOAPDesign: formData.shouldGitPOAPDesign === 'true' ? 'GitPOAP' : 'You',
      isOneGitPOAPPerRepo: formData.isOneGitPOAPPerRepo === 'true' ? 'One Per Repo' : 'One For All',
      notes: formData.notes,
      repos: formatRepos(JSON.parse(formData.repos)),
      support_email: 'team@gitpoap.io',
      company_name: 'MetaRep Labs Inc',
      company_address: 'One Broadway, Cambridge MA 02142',
      sender_name: 'GitPOAP Team',
      help_url: 'https://docs.gitpoap.io',
    },
  });

export const sendInternalConfirmationEmail = async (
  githubHandle: string,
  formData: IntakeForm,
  queueNumber: number | undefined,
  urls: string[],
) => {
  await sendTextEmailHandler({
    to: 'team@gitpoap.io',
    from: 'team@gitpoap.io',
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
