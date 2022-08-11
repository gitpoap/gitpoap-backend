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

    expect(data.length).toEqual(13);

    // names are from variables in prisma/seed.ts
    expect(data).toContainEqual('thunderdome'); // claim1
    expect(data).toContainEqual('4068606');     // claim2
    expect(data).toContainEqual('ethdenver');   // claim4
    expect(data).toContainEqual('4078452');     // claim5
    expect(data).toContainEqual('pizza-pie');   // claim8
    expect(data).toContainEqual('4082459');     // claim9
    expect(data).toContainEqual('3217451');     // claim14
    expect(data).toContainEqual('3973554');     // claim16
    expect(data).toContainEqual('4126448');     // claim17
    expect(data).toContainEqual('123456789');   // claim21
    expect(data).toContainEqual('1234567891');  // claim9B
    expect(data).toContainEqual('1234567892');  // claim9C
    expect(data).toContainEqual('1234567893');  // claim10C
  });
});
