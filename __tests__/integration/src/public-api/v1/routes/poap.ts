import fetch from 'cross-fetch';

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

describe('public-api/v1/poap/gitpoap-ids', () => {
  it('Returns all the POAP IDs for claimed GitPOAPs', async () => {
    const response = await fetch(`${PUBLIC_API_URL}/v1/poap/gitpoap-ids`);

    expect(response.status).toBeLessThan(400);

    const data = await response.json();

    expect(data.poapIds).not.toEqual(null);
    expect(data.poapIds.length).toEqual(13);

    // names are from variables in prisma/seed.ts
    expect(data.poapIds).toContainEqual('thunderdome'); // claim1
    expect(data.poapIds).toContainEqual('4068606');     // claim2
    expect(data.poapIds).toContainEqual('ethdenver');   // claim4
    expect(data.poapIds).toContainEqual('4078452');     // claim5
    expect(data.poapIds).toContainEqual('pizza-pie');   // claim8
    expect(data.poapIds).toContainEqual('4082459');     // claim9
    expect(data.poapIds).toContainEqual('3217451');     // claim14
    expect(data.poapIds).toContainEqual('3973554');     // claim16
    expect(data.poapIds).toContainEqual('4126448');     // claim17
    expect(data.poapIds).toContainEqual('123456789');   // claim21
    expect(data.poapIds).toContainEqual('1234567891');  // claim9B
    expect(data.poapIds).toContainEqual('1234567892');  // claim9C
    expect(data.poapIds).toContainEqual('1234567893');  // claim10C
  });
});
