import {
  createClaimForEmail,
  createClaimForEnsName,
  createClaimForEthAddress,
  createClaimForGithubHandle,
} from './claims';
import { GitPOAPRequestContributors } from '../types/gitpoapRequest';
import { z } from 'zod';
import { CustomGitPOAPContributorsSchema } from '../schemas/gitpoaps/custom';

export function convertContributorsFromSchema(
  contributors: z.infer<typeof CustomGitPOAPContributorsSchema>,
): GitPOAPRequestContributors {
  return {
    githubHandles: contributors.githubHandles ?? [],
    emails: contributors.emails ?? [],
    ethAddresses: contributors.ethAddresses ?? [],
    ensNames: contributors.ensNames ?? [],
  };
}

export function createClaimsForContributors(
  gitPOAPId: number,
  contributors: GitPOAPRequestContributors,
) {
  for (const githubHandle of contributors.githubHandles) {
    void createClaimForGithubHandle(githubHandle, gitPOAPId);
  }

  for (const email of contributors.emails) {
    void createClaimForEmail(email, gitPOAPId);
  }

  for (const ethAddress of contributors.ethAddresses) {
    void createClaimForEthAddress(ethAddress, gitPOAPId);
  }

  for (const ensName of contributors.ensNames) {
    void createClaimForEnsName(ensName, gitPOAPId);
  }

  return (
    contributors['githubHandles'].length +
    contributors['emails'].length +
    contributors['ethAddresses'].length +
    contributors['ensNames'].length
  );
}

export function addGitPOAPRequestContributors(
  existingContributors: GitPOAPRequestContributors,
  newContributors: GitPOAPRequestContributors,
): GitPOAPRequestContributors {
  const githubHandleSet = new Set<string>(existingContributors.githubHandles);
  const emailSet = new Set<string>(existingContributors.emails);
  const ethAddressSet = new Set<string>(existingContributors.ethAddresses);
  const ensNameSet = new Set<string>(existingContributors.ensNames);

  newContributors.githubHandles.forEach((githubHandle: string) =>
    githubHandleSet.add(githubHandle),
  );
  newContributors.emails.forEach((email: string) => emailSet.add(email));
  newContributors.ethAddresses.forEach((ethAddress: string) => ethAddressSet.add(ethAddress));
  newContributors.ensNames.forEach((ensName: string) => ensNameSet.add(ensName));

  return {
    githubHandles: Array.from(githubHandleSet),
    emails: Array.from(emailSet),
    ethAddresses: Array.from(ethAddressSet),
    ensNames: Array.from(ensNameSet),
  };
}
