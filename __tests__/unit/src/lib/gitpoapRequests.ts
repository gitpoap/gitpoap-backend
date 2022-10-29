import {
  addGitPOAPRequestContributors,
  removeContributorFromGitPOAPRequest,
} from '../../../../src/lib/gitpoapRequests';
import { GitPOAPRequestContributors } from '../../../../src/types/gitpoapRequest';

const contributor = 'foobar';
const otherContributor = 'yeet';
const contributorsBase = {
  githubHandles: [contributor],
  emails: [contributor],
  ethAddresses: [contributor],
  ensNames: [contributor],
};

const expectToHaveContributors = (
  contributors: GitPOAPRequestContributors,
  expectedContributors: string[],
) => {
  expect(contributors.githubHandles).toHaveLength(expectedContributors.length);
  expect(contributors.emails).toHaveLength(expectedContributors.length);
  expect(contributors.ethAddresses).toHaveLength(expectedContributors.length);
  expect(contributors.ensNames).toHaveLength(expectedContributors.length);

  expectedContributors.forEach((contributor: string) => {
    expect(contributors.githubHandles).toContainEqual(contributor);
    expect(contributors.emails).toContainEqual(contributor);
    expect(contributors.ethAddresses).toContainEqual(contributor);
    expect(contributors.ensNames).toContainEqual(contributor);
  });
};

describe('addGitPOAPRequestContributors', () => {
  it('Adds contributors that are not already in the list', () => {
    const newContributors = {
      githubHandles: [otherContributor],
      emails: [otherContributor],
      ethAddresses: [otherContributor],
      ensNames: [otherContributor],
    };

    const result = addGitPOAPRequestContributors(contributorsBase, newContributors);

    expectToHaveContributors(result, [contributor, otherContributor]);
  });

  it("Doesn't add contributors that are already in the list", () => {
    const result = addGitPOAPRequestContributors(contributorsBase, contributorsBase);

    expectToHaveContributors(result, [contributor]);
  });
});

describe('removeContributorFromGitPOAPRequest', () => {
  it('Removes contributors if they exist', () => {
    const result1 = removeContributorFromGitPOAPRequest(
      contributorsBase,
      'githubHandle',
      contributor,
    );

    expect(result1.githubHandles).toEqual([]);
    expect(result1.emails).toEqual(contributorsBase.emails);
    expect(result1.ethAddresses).toEqual(contributorsBase.ethAddresses);
    expect(result1.ensNames).toEqual(contributorsBase.ensNames);

    const result2 = removeContributorFromGitPOAPRequest(result1, 'email', contributor);

    expect(result2.githubHandles).toEqual([]);
    expect(result2.emails).toEqual([]);
    expect(result2.ethAddresses).toEqual(contributorsBase.ethAddresses);
    expect(result2.ensNames).toEqual(contributorsBase.ensNames);

    const result3 = removeContributorFromGitPOAPRequest(result2, 'ethAddress', contributor);

    expect(result3.githubHandles).toEqual([]);
    expect(result3.emails).toEqual([]);
    expect(result3.ethAddresses).toEqual([]);
    expect(result3.ensNames).toEqual(contributorsBase.ensNames);

    const result4 = removeContributorFromGitPOAPRequest(result3, 'ensName', contributor);

    expectToHaveContributors(result4, []);
  });

  it("Doesn't change lists for nonexistant contributors", () => {
    expectToHaveContributors(
      removeContributorFromGitPOAPRequest(contributorsBase, 'githubHandle', otherContributor),
      [contributor],
    );
    expectToHaveContributors(
      removeContributorFromGitPOAPRequest(contributorsBase, 'email', otherContributor),
      [contributor],
    );
    expectToHaveContributors(
      removeContributorFromGitPOAPRequest(contributorsBase, 'ethAddress', otherContributor),
      [contributor],
    );
    expectToHaveContributors(
      removeContributorFromGitPOAPRequest(contributorsBase, 'ensName', otherContributor),
      [contributor],
    );
  });
});
