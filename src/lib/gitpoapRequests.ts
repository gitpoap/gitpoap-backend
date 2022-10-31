import { context } from '../context';
import { z } from 'zod';
import { DeleteGitPOAPRequestClaimSchema } from '../schemas/gitpoaps/custom';
import { GitPOAPContributors } from '../types/gitpoaps';

export async function deleteGitPOAPRequest(id: number) {
  await context.prisma.gitPOAPRequest.delete({
    where: { id },
  });
}

export function addGitPOAPContributors(
  existingContributors: GitPOAPContributors,
  newContributors: GitPOAPContributors,
): GitPOAPContributors {
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

export function removeContributorFromGitPOAP(
  existingContributors: GitPOAPContributors,
  claimType: z.infer<typeof DeleteGitPOAPRequestClaimSchema>['claimType'],
  claimData: string,
): GitPOAPContributors {
  if (claimType === 'githubHandle') {
    const githubHandleSet = new Set<string>(existingContributors.githubHandles);

    githubHandleSet.delete(claimData);

    return {
      ...existingContributors,
      githubHandles: Array.from(githubHandleSet),
    };
  } else if (claimType === 'email') {
    const emailSet = new Set<string>(existingContributors.emails);

    emailSet.delete(claimData);

    return {
      ...existingContributors,
      emails: Array.from(emailSet),
    };
  } else if (claimType === 'ethAddress') {
    const ethAddressSet = new Set<string>(existingContributors.ethAddresses);

    ethAddressSet.delete(claimData);

    return {
      ...existingContributors,
      ethAddresses: Array.from(ethAddressSet),
    };
  } else {
    // claimType === 'ensName'
    const ensNameSet = new Set<string>(existingContributors.ensNames);

    ensNameSet.delete(claimData);

    return {
      ...existingContributors,
      ensNames: Array.from(ensNameSet),
    };
  }
}
