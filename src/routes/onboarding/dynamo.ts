import { PutItemCommandInput, UpdateItemCommandInput } from '@aws-sdk/client-dynamodb';
import { z } from 'zod';
import { configProfile } from '../../external/dynamo';
import { IntakeFormReposSchema } from '../../schemas/onboarding';
import { IntakeForm } from './types';

export const createIntakeFormDocForDynamo = (
  githubHandle: string,
  formData: IntakeForm,
  timestamp: number,
): PutItemCommandInput => ({
  TableName: configProfile.tables.intakeForm,
  Item: {
    'email-githubHandle': {
      S: `${formData.email}-${githubHandle}`,
    },
    timestamp: {
      N: timestamp.toString(),
    },
    name: { S: formData.name ?? '' },
    email: { S: formData.email },
    notes: { S: formData.notes ?? '' },
    githubHandle: { S: githubHandle },
    shouldGitPOAPDesign: { BOOL: Boolean(formData.shouldGitPOAPDesign) },
    isOneGitPOAPPerRepo: { BOOL: Boolean(formData.isOneGitPOAPPerRepo) },
    repos: {
      L: JSON.parse(formData.repos).map((repo: z.infer<typeof IntakeFormReposSchema>[number]) => ({
        M: {
          full_name: { S: repo.full_name },
          githubRepoId: { S: repo.githubRepoId },
          permissions: {
            M: {
              admin: { BOOL: repo.permissions.admin },
              maintain: { BOOL: repo.permissions.maintain ?? false },
              push: { BOOL: repo.permissions.push },
              triage: { BOOL: repo.permissions.triage ?? false },
              pull: { BOOL: repo.permissions.pull },
            },
          },
        },
      })),
    },
    isComplete: { BOOL: false },
  },
});

export const createUpdateItemParamsForImages = (
  key: string,
  githubHandle: string,
  timestamp: number,
  imageUrls: string[],
): UpdateItemCommandInput => {
  return {
    TableName: configProfile.tables.intakeForm,
    Key: {
      'email-githubHandle': { S: key },
      timestamp: { N: timestamp.toString() },
    },
    UpdateExpression: 'set images = :images',
    ExpressionAttributeValues: {
      ':images': {
        L: imageUrls.map(url => ({ S: url })),
      },
    },
    ReturnValues: 'UPDATED_NEW',
  };
};
