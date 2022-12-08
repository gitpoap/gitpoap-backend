import fetch from 'cross-fetch';
import { ADDRESSES, GH_HANDLES } from '../../../../../prisma/constants';
import cheerio from 'cheerio';
import { event2, event3, event29009, event36571, event36576 } from '../../../../../prisma/data';
import { GitPOAPStatus, GitPOAPType } from '@prisma/client';
import { context } from '../../../../../src/context';

const PUBLIC_API_URL = 'http://public-api-server:3122';

describe('public-api/v1/address/:address/gitpoaps', () => {
  it('Returns 400 when address is invalid', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/address/0x342341234123412341234/gitpoaps`);

    expect(response.status).toEqual(400);
  });

  it('Returns 400 when ENS is invalid', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/address/iamsomeinvalidens.eth/gitpoaps`);

    expect(response.status).toEqual(400);
  });

  it('Returns empty list when address is not in GitPOAP', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/address/poap.eth/gitpoaps`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data).toHaveLength(0);
  });

  it("Returns known user's GitPOAPs", async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/address/${ADDRESSES.burz2}/gitpoaps`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data).toHaveLength(1);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    expect(data[0].gitPoapId).toEqual(21);
    expect(data[0].gitPoapEventId).toEqual(5);
    expect(data[0].poapTokenId).toEqual('123456789');
    expect(data[0].poapEventId).toEqual(event29009.id);
    expect(data[0].poapEventFancyId).toEqual(event29009.fancy_id);
    expect(data[0].name).toEqual(event29009.name);
    expect(data[0].year).toEqual(event29009.year);
    expect(data[0].description).toEqual(event29009.description);
    expect(data[0].imageUrl).toEqual(event29009.image_url);
    expect(data[0].repositories).toHaveLength(1);
    expect(data[0].repositories[0]).toEqual('gitpoap/gitpoap-backend');
    expect(new Date(data[0].earnedAt)).toEqual(todayStart);
    expect(data[0].mintedAt).toEqual('2020-01-09');
    expect(data[0].needsRevalidation).toEqual(false);
  });

  it('Returns DEPRECATED GitPOAPs', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/address/${ADDRESSES.kayleen}/gitpoaps`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data).toHaveLength(1);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    expect(data[0].gitPoapId).toEqual(43);
    expect(data[0].gitPoapEventId).toEqual(18);
    expect(data[0].poapTokenId).toEqual('77778');
    expect(data[0].poapEventId).toEqual(event36576.id);
    expect(data[0].poapEventFancyId).toEqual(event36576.fancy_id);
    expect(data[0].name).toEqual(event36576.name);
    expect(data[0].year).toEqual(event36576.year);
    expect(data[0].description).toEqual(event36576.description);
    expect(data[0].imageUrl).toEqual(event36576.image_url);
    expect(data[0].repositories).toHaveLength(1);
    expect(data[0].repositories[0]).toEqual('gitpoap/gitpoap-bot-test-repo2');
    expect(new Date(data[0].earnedAt)).toEqual(todayStart);
    expect(data[0].mintedAt).toEqual('2019-12-11');
    expect(data[0].needsRevalidation).toEqual(false);
  });
});

describe('public-api/v1/github/user/:githubHandle/gitpoaps', () => {
  it('Returns 400 when status is invalid', async () => {
    const response = await fetch(
      `${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps?status=fake_status`,
    );

    expect(response.status).toEqual(400);
  });

  it('Returns empty list when githubHandle has no GitPOAPs', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/github/user/peebeejay1/gitpoaps`);
    expect(response.status).toBeLessThan(400);
    const data = await response.json();
    expect(data).toHaveLength(0);
  });

  describe('when a status query string parameter is provided', () => {
    it("Returns all minted gitpoaps when status equals 'claimed'", async () => {
      const response = await fetch(
        `${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps?status=claimed`,
      );
      expect(response.status).toBeLessThan(400);
      const data = await response.json();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      expect(data).toHaveLength(4);
      expect(data).toContainEqual({
        gitPoapId: 8,
        gitPoapEventId: 3,
        gitPoapType: GitPOAPType.ANNUAL,
        poapTokenId: 'pizza-pie',
        poapEventId: event3.id,
        poapEventFancyId: event3.fancy_id,
        name: event3.name,
        year: event3.year,
        description: event3.description,
        imageUrl: event3.image_url,
        repositories: ['some-other-org/repo568'],
        earnedAt: todayStart.toISOString().split('T')[0],
        mintedAt: '2022-04-05',
        isDeprecated: false,
        needsRevalidation: false,
      });
    });

    it("Returns all minted gitpoaps when status equals 'unclaimed'", async () => {
      const response = await fetch(
        `${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps?status=unclaimed`,
      );
      expect(response.status).toBeLessThan(400);
      const data = await response.json();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      expect(data).toHaveLength(6);
      expect(data).toContainEqual(
        expect.objectContaining({
          gitPoapId: 6,
          gitPoapEventId: 2,
          poapTokenId: null,
          poapEventId: event2.id,
          poapEventFancyId: event2.fancy_id,
          mintedAt: null,
        }),
      );
    });

    it("Returns all minted gitpoaps when status equals 'pending'", async () => {
      const response = await fetch(
        `${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps?status=pending`,
      );
      expect(response.status).toBeLessThan(400);
      const data = await response.json();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      expect(data).toHaveLength(0);
    });

    it("Returns all minted gitpoaps when status equals 'minting'", async () => {
      const response = await fetch(
        `${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps?status=minting`,
      );
      expect(response.status).toBeLessThan(400);
      const data = await response.json();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      expect(data).toHaveLength(0);
    });

    it("Doesn't return UNAPPROVED GitPOAP Claims when status equals 'unclaimed'", async () => {
      // Temporarily mark GitPOAP ID 18 as UNAPPROVED
      await context.prisma.gitPOAP.update({
        where: { id: 18 },
        data: { poapApprovalStatus: GitPOAPStatus.UNAPPROVED },
      });

      const response = await fetch(
        `${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.kayleen}/gitpoaps?status=unclaimed`,
      );

      await context.prisma.gitPOAP.update({
        where: { id: 18 },
        data: { poapApprovalStatus: GitPOAPStatus.DEPRECATED },
      });

      expect(response.status).toBeLessThan(400);

      const data = await response.json();

      expect(data).toHaveLength(0);
    });
  });

  it("Returns all known user's GitPOAPs when no status parameter is provided", async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps`);
    expect(response.status).toBeLessThan(400);
    const data = await response.json();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    expect(data).toHaveLength(10);
    expect(data).toContainEqual(
      expect.objectContaining({
        gitPoapId: 35,
        gitPoapEventId: 10,
        poapTokenId: null,
        poapEventId: event36571.id,
        poapEventFancyId: event36571.fancy_id,
        name: event36571.name,
        year: event36571.year,
        description: event36571.description,
        imageUrl: event36571.image_url,
        repositories: ['gitpoap/gitpoap-backend'],
        earnedAt: todayStart.toISOString().split('T')[0],
        mintedAt: null,
      }),
    );
  });

  it('Returns DEPRECATED GitPOAPs', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.kayleen}/gitpoaps`);
    expect(response.status).toBeLessThan(400);
    const data = await response.json();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    expect(data).toHaveLength(1);
    expect(data[0].gitPoapId).toEqual(43);
    expect(data[0].gitPoapEventId).toEqual(18);
    expect(data[0].poapTokenId).toEqual('77778');
    expect(data[0].poapEventId).toEqual(event36576.id);
    expect(data[0].poapEventFancyId).toEqual(event36576.fancy_id);
    expect(data[0].name).toEqual(event36576.name);
    expect(data[0].year).toEqual(event36576.year);
    expect(data[0].description).toEqual(event36576.description);
    expect(data[0].imageUrl).toEqual(event36576.image_url);
    expect(data[0].repositories).toHaveLength(1);
    expect(data[0].repositories[0]).toEqual('gitpoap/gitpoap-bot-test-repo2');
    expect(new Date(data[0].earnedAt)).toEqual(todayStart);
    expect(data[0].mintedAt).toEqual('2019-12-11');
    expect(data[0].needsRevalidation).toEqual(false);
  });
});

describe('public-api/v1/repo/:owner/:name/badge', () => {
  const validateSVG = async (response: any, expectedCount: number) => {
    expect(response.headers.has('Content-Type')).toEqual(true);
    expect(response.headers.get('Content-Type')).toEqual('image/svg+xml; charset=utf-8');
    expect(response.headers.has('Cache-Control')).toEqual(true);
    expect(response.headers.get('Cache-Control')).toEqual(
      'max-age=0, no-cache, no-store, must-revalidate',
    );

    const svgText = await response.text();

    const svg = cheerio.load(svgText);

    expect(svg('title').text()).toEqual(`GitPOAPs: ${expectedCount}`);
  };

  it("Returns a badge with zero when the repo doesn't exist", async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/repo/foo/bar/badge`);

    expect(response.status).toBeLessThan(400);

    await validateSVG(response, 0);
  });

  it('Returns a badge with contributor count when repo exists', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/repo/org43/repo34/badge`);

    expect(response.status).toBeLessThan(400);

    await validateSVG(response, 2);
  });
});
