import fetch from 'cross-fetch';
import { context } from './context';
import { DateTime } from 'luxon';

const POAP_KEY_NAME = 'poap';

export async function retrievePOAPKey(): Promise<string | null> {
  const secret = await context.prisma.secret.findUnique({
    where: {
      name: POAP_KEY_NAME,
    },
  });

  if (secret !== null) {
    const updatedAt = DateTime.fromJSDate(secret.updatedAt);

    // If the key is still valid let's use it
    if (updatedAt.plus({ hours: 10 }) >= DateTime.now()) {
      return secret.key;
    }
  }

  console.log('Retrieving a new POAP API OAuth Token');

  const poapResponse = await fetch(`${process.env.POAP_AUTH_URL}/oauth/token`, {
    method: 'POST',
    body: JSON.stringify({
      audience: 'gitpoap',
      grant_type: 'client_credentials',
      client_id: process.env.POAP_CLIENT_ID,
      client_secret: process.env.POAP_CLIENT_SECRET,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (poapResponse.status >= 400) {
    console.log(await poapResponse.text());
    return null;
  }

  const data = await poapResponse.json();

  await context.prisma.secret.upsert({
    where: {
      name: POAP_KEY_NAME,
    },
    update: {
      key: data.access_token,
    },
    create: {
      name: POAP_KEY_NAME,
      key: data.access_token,
    },
  });

  return data.access_token;
}
