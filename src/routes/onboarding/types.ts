import { z } from 'zod';
import { IntakeFormSchema } from '../../schemas/onboarding';

export type IntakeForm = z.infer<typeof IntakeFormSchema>;

export type Repo = {
  name: string;
  full_name: string;
  githubRepoId: number;
  description: string | null;
  url: string;
  owner: {
    id: number | string;
    type: string;
    name: string;
    avatar_url: string;
    url: string;
  };
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
};

export type PullRequestsRes = {
  search: {
    issueCount: number;
    edges: {
      node: {
        number: number;
        title: string;
        repository: {
          name: string;
          nameWithOwner: string;
          viewerPermission: string;
          databaseId: number;
          description: string;
          url: string;
          isFork: boolean;
          stargazerCount: number;
          owner: {
            id: string;
            __typename: string;
            avatarUrl: string;
            login: string;
            resourcePath: string;
          };
        };
      };
    }[];
  };
};

export type ErrorMessage = {
  message: string;
};

export type APIResponseData<T> = T | ErrorMessage;
