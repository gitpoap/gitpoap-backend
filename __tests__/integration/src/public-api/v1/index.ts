import fetch from 'cross-fetch';
import { ADDRESSES, GH_HANDLES } from '../../../../../prisma/constants';
import cheerio from 'cheerio';
import {
  event2,
  event3,
  event29009,
  event36571,
} from '../../../../../prisma/data';

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

    expect(data.length).toEqual(0);
  });

  it("Returns known user's GitPOAPs", async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/address/${ADDRESSES.burz2}/gitpoaps`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.length).toEqual(1);

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
    expect(data[0].repositories.length).toEqual(1);
    expect(data[0].repositories[0]).toEqual('gitpoap/gitpoap-backend');
    expect(new Date(data[0].earnedAt)).toEqual(todayStart);
    expect(data[0].mintedAt).toEqual('2020-01-09');
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
    expect(data.length).toEqual(0);
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

      expect(data.length).toEqual(3);
      expect(data[0].gitPoapId).toEqual(8);
      expect(data[0].gitPoapEventId).toEqual(3);
      expect(data[0].poapTokenId).toEqual('pizza-pie');
      expect(data[0].poapEventId).toEqual(event3.id);
      expect(data[0].poapEventFancyId).toEqual(event3.fancy_id);
      expect(data[0].name).toEqual(event3.name);
      expect(data[0].year).toEqual(event3.year);
      expect(data[0].description).toEqual(event3.description);
      expect(data[0].imageUrl).toEqual(event3.image_url);
      expect(data[0].repositories.length).toEqual(1);
      expect(data[0].repositories[0]).toEqual('some-other-org/repo568');
      expect(new Date(data[0].earnedAt)).toEqual(todayStart);
      expect(data[0].mintedAt).toEqual('2022-04-05');
      expect(data[0].needsRevalidation).toEqual(false);
    });

    it("Returns all minted gitpoaps when status equals 'unclaimed'", async () => {
      const response = await fetch(
        `${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps?status=unclaimed`,
      );
      expect(response.status).toBeLessThan(400);
      const data = await response.json();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      expect(data.length).toEqual(6);
      expect(data[0].gitPoapId).toEqual(6);
      expect(data[0].gitPoapEventId).toEqual(2);
      expect(data[0].poapTokenId).toEqual(null);
      expect(data[0].poapEventId).toEqual(event2.id);
      expect(data[0].poapEventFancyId).toEqual(event2.fancy_id);
      expect(data[0].mintedAt).toBeNull();
    });

    it("Returns all minted gitpoaps when status equals 'pending'", async () => {
      const response = await fetch(
        `${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps?status=pending`,
      );
      expect(response.status).toBeLessThan(400);
      const data = await response.json();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      expect(data.length).toEqual(0);
    });

    it("Returns all minted gitpoaps when status equals 'minting'", async () => {
      const response = await fetch(
        `${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps?status=minting`,
      );
      expect(response.status).toBeLessThan(400);
      const data = await response.json();
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      expect(data.length).toEqual(0);
    });
  });

  it("Returns all known user's GitPOAPs when no status parameter is provided", async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/github/user/${GH_HANDLES.burz}/gitpoaps`);
    expect(response.status).toBeLessThan(400);
    const data = await response.json();

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    expect(data.length).toEqual(9);
    expect(data[0].gitPoapId).toEqual(35);
    expect(data[0].gitPoapEventId).toEqual(10);
    expect(data[0].poapTokenId).toBeNull();
    expect(data[0].poapEventId).toEqual(event36571.id);
    expect(data[0].poapEventFancyId).toEqual(event36571.fancy_id);
    expect(data[0].name).toEqual(event36571.name);
    expect(data[0].year).toEqual(event36571.year);
    expect(data[0].description).toEqual(event36571.description);
    expect(data[0].imageUrl).toEqual(event36571.image_url);
    expect(data[0].repositories.length).toEqual(1);
    expect(data[0].repositories[0]).toEqual('gitpoap/gitpoap-backend');
    expect(new Date(data[0].earnedAt)).toEqual(todayStart);
    expect(data[0].mintedAt).toBeNull();
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
