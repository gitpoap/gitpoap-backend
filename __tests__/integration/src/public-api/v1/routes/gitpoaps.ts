import fetch from 'cross-fetch';
import { ADDRESSES } from '../../../../../../prisma/constants';

const PUBLIC_API_URL = 'http://public-api-server:3122';

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
