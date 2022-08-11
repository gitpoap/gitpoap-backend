import fetch from 'cross-fetch';

const PUBLIC_API_URL = 'http://public-api-server:3122';

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

