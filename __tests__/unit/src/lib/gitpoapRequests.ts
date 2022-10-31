import {
  addGitPOAPContributors,
  removeContributorFromGitPOAP,
} from '../../../../src/lib/gitpoapRequests';
import { GitPOAPContributors } from '../../../../src/types/gitpoaps';

const contributor = 'foobar';
const otherContributor = 'yeet';
const contributorsBase = {
  githubHandles: [contributor],
  emails: [contributor],
  ethAddresses: [contributor],
  ensNames: [contributor],
};

const expectToHaveContributors = (
  contributors: GitPOAPContributors,
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

describe('addGitPOAPContributors', () => {
  it('Adds contributors that are not already in the list', () => {
    const newContributors = {
      githubHandles: [otherContributor],
      emails: [otherContributor],
      ethAddresses: [otherContributor],
      ensNames: [otherContributor],
    };

    const result = addGitPOAPContributors(contributorsBase, newContributors);

    expectToHaveContributors(result, [contributor, otherContributor]);
  });

  it("Doesn't add contributors that are already in the list", () => {
    const result = addGitPOAPContributors(contributorsBase, contributorsBase);

    expectToHaveContributors(result, [contributor]);
  });
});

describe('removeContributorFromGitPOAP', () => {
  it('Removes contributors if they exist', () => {
    const result1 = removeContributorFromGitPOAP(contributorsBase, 'githubHandle', contributor);

    expect(result1.githubHandles).toEqual([]);
    expect(result1.emails).toEqual(contributorsBase.emails);
    expect(result1.ethAddresses).toEqual(contributorsBase.ethAddresses);
    expect(result1.ensNames).toEqual(contributorsBase.ensNames);

    const result2 = removeContributorFromGitPOAP(result1, 'email', contributor);

    expect(result2.githubHandles).toEqual([]);
    expect(result2.emails).toEqual([]);
    expect(result2.ethAddresses).toEqual(contributorsBase.ethAddresses);
    expect(result2.ensNames).toEqual(contributorsBase.ensNames);

    const result3 = removeContributorFromGitPOAP(result2, 'ethAddress', contributor);

    expect(result3.githubHandles).toEqual([]);
    expect(result3.emails).toEqual([]);
    expect(result3.ethAddresses).toEqual([]);
    expect(result3.ensNames).toEqual(contributorsBase.ensNames);

    const result4 = removeContributorFromGitPOAP(result3, 'ensName', contributor);

    expectToHaveContributors(result4, []);
  });

  it("Doesn't change lists for nonexistant contributors", () => {
    expectToHaveContributors(
      removeContributorFromGitPOAP(contributorsBase, 'githubHandle', otherContributor),
      [contributor],
    );
    expectToHaveContributors(
      removeContributorFromGitPOAP(contributorsBase, 'email', otherContributor),
      [contributor],
    );
    expectToHaveContributors(
      removeContributorFromGitPOAP(contributorsBase, 'ethAddress', otherContributor),
      [contributor],
    );
    expectToHaveContributors(
      removeContributorFromGitPOAP(contributorsBase, 'ensName', otherContributor),
      [contributor],
    );
  });
});
