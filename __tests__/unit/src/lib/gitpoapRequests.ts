import '../../../../__mocks__/src/logging';
import { dedupeContributors } from '../../../../src/lib/gitpoapRequests';
import { ADDRESSES } from '../../../../prisma/constants';

jest.mock('../../../../src/logging');

const burzWithSumCase = '0xAe95f7e7fb2FCF86148ef832FAeD2752Ae5A358a';

describe('dedupeContributors', () => {
  it('Dedupes githubHandles', () => {
    const contributors = { githubHandles: ['hi', 'hi'] };

    const result = dedupeContributors(contributors);

    expect(result).toEqual({ githubHandles: ['hi'] });
  });

  it('Dedupes ethAddresses', () => {
    const contributors = {
      ethAddresses: [ADDRESSES.burz, burzWithSumCase],
    };

    const result = dedupeContributors(contributors);

    expect(result).toEqual({ ethAddresses: [ADDRESSES.burz] });
  });

  it('Dedupes ensNames', () => {
    const contributors = { ensNames: ['burz.eth', 'BuRz.EtH'] };

    const result = dedupeContributors(contributors);

    expect(result).toEqual({ ensNames: ['burz.eth'] });
  });

  it('Dedupes emails', () => {
    const contributors = { ensNames: ['burz@gitpoap.io', 'BuRz@GiTpOaP.iO'] };

    const result = dedupeContributors(contributors);

    expect(result).toEqual({ ensNames: ['burz@gitpoap.io'] });
  });

  const baseContributors = {
    githubHandles: ['hi'],
    ethAddresses: [ADDRESSES.burz],
    ensNames: ['burz.eth'],
    emails: ['burz@gitpoap.io', 'engineers@gitpoap.io'],
  };

  it('Ignores things with no dupes', () => {
    const result = dedupeContributors(baseContributors);

    expect(result).toEqual(baseContributors);
  });

  it('Removes dupes everywhere, all at once', () => {
    const contributors = {
      githubHandles: Array.from(baseContributors.githubHandles),
      ethAddresses: Array.from(baseContributors.ethAddresses),
      ensNames: Array.from(baseContributors.ensNames),
      emails: Array.from(baseContributors.emails),
    };
    contributors.githubHandles.push('hi');
    contributors.ethAddresses.push(burzWithSumCase);
    contributors.ensNames.push('burz.ETH');
    contributors.emails.push('ENGINEERS@gitpoap.io');

    const result = dedupeContributors(contributors);

    expect(result).toEqual(baseContributors);
  });
});
