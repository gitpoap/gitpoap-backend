import fetch from 'cross-fetch';
import { ADDRESSES } from '../../../../prisma/constants';
import cheerio from 'cheerio';
import { event29009 } from '../../../../.dockerfiles/fake-poap-api/data';

const PUBLIC_API_URL = 'http://public-api-server:3122';

describe('public-api/v1/poap/:poapTokenId/is-gitpoap', () => {
  it('Returns false for a non-GitPOAP POAP ID', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/poap/32423423/is-gitpoap`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.isGitPOAP).toEqual(false);
  });

  it('Returns true and the GitPOAP ID for a GitPOAP POAP ID', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/poap/thunderdome/is-gitpoap`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.isGitPOAP).toEqual(true);
    expect(data.gitPOAPId).toEqual(1);
  });
});

describe('public-api/v1/poap-event/:poapEventId/is-gitpoap', () => {
  it('Returns false for a non-GitPOAP POAP Event ID', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/poap-event/2344444/is-gitpoap`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.isGitPOAP).toEqual(false);
  });

  it('Returns true and the GitPOAP Event ID for a GitPOAP POAP Event ID', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/poap-event/1/is-gitpoap`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.isGitPOAP).toEqual(true);
    expect(data.gitPOAPId).toEqual(1);
  });
});

describe('public-api/v1/gitpoaps/:gitpoapId/addresses', () => {
  it('Returns a 404 when the GitPOAP ID is not valid', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/gitpoaps/990930423/addresses`);

    expect(response.status).toEqual(404);
  });

  it('Returns the addresses of the owners when the GitPOAP ID is valid', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/gitpoaps/1/addresses`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.addresses).not.toEqual(null);
    expect(data.addresses.length).toEqual(2);
    expect(data.addresses).toContain(ADDRESSES.test1);
    expect(data.addresses).toContain(ADDRESSES.jay);
  });
});

describe('public-api/v1/gitpoaps/addresses', () => {
  it('Returns all addresses that have claimed GitPOAPs', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/gitpoaps/addresses`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.addresses).not.toEqual(null);
    expect(data.addresses.length).toEqual(4);
    expect(data.addresses).toContain(ADDRESSES.test1);
    expect(data.addresses).toContain(ADDRESSES.jay);
    expect(data.addresses).toContain(ADDRESSES.colfax);
    expect(data.addresses).toContain(ADDRESSES.anthony2);
  });
});

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
    const response = await fetch(`${PUBLIC_API_URL}/v1/address/${ADDRESSES.anthony2}/gitpoaps`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.length).toEqual(1);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    expect(data[0].gitPoapId).toEqual(21);
    expect(data[0].gitPoapEventId).toEqual(5);
    expect(data[0].poapTokenId).toEqual('123456789');
    expect(data[0].poapEventId).toEqual(29009);
    expect(data[0].name).toEqual(event29009.name);
    expect(data[0].year).toEqual(2020);
    expect(data[0].description).toEqual(event29009.description);
    expect(data[0].imageUrl).toEqual(event29009.image_url);
    expect(data[0].repositories.length).toEqual(1);
    expect(data[0].repositories[0]).toEqual('gitpoap/gitpoap-backend');
    expect(new Date(data[0].earnedAt)).toEqual(todayStart);
    expect(new Date(data[0].mintedAt)).toEqual(new Date(2020, 1, 9));
  });
});

describe('public-api/v1/repo/:owner/:name/badge', () => {
  const validateSVG = async (response: any, expectedCount: number) => {
    expect(response.headers.has('Content-Type')).toEqual(true);
    expect(response.headers.get('Content-Type')).toEqual('image/svg+xml; charset=utf-8');
    expect(response.headers.has('Cache-Control')).toEqual(true);
    expect(response.headers.get('Cache-Control')).toEqual('max-age=0, no-cache, no-store, must-revalidate');

    const svgText = await response.text();

    const svg = cheerio.load(svgText);

    expect(svg('title').text()).toEqual(`GitPOAPs: ${expectedCount}`);
  };

  it("Returns a badge with zero when the repo doesn't exist", async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/repo/foo/bar/badge`);

    expect(response.status).toBeLessThan(400);

    await validateSVG(response, 0);
  });

  it("Returns a badge with contributor count when repo exists", async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/repo/org43/repo34/badge`);

    expect(response.status).toBeLessThan(400);

    await validateSVG(response, 2);
  });
});
