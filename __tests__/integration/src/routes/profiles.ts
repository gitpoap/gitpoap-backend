import fetch from 'cross-fetch';

const API_URL = 'http://server:3001';

describe('POST /server/profiles', () => {
  it('Fails on bad request', async () => {
    const response = await fetch(`${API_URL}/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        foo: 'bar',
      }),
    });

    expect(response.status).toEqual(400);
  });

  it('Fails on bad address', async () => {
    const response = await fetch(`${API_URL}/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: '0xnope',
        signature: {
          data: 'yeet',
          createdAt: 3424,
        },
        data: {},
      }),
    });

    expect(response.status).toEqual(400);
  });

  it('Fails on bad signature', async () => {
    const response = await fetch(`${API_URL}/profiles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        address: 'burz.eth',
        signature: {
          data: 'yeet',
          createdAt: 3424,
        },
        data: {},
      }),
    });

    expect(response.status).toEqual(401);
  });
});
