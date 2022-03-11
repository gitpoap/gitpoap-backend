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

export async function generatePOAPHeaders() {
  // Remove the https:// from the url for the host header
  const lastIndex = process.env.POAP_API_URL.lastIndexOf('/');
  const host = process.env.POAP_API_URL.substr(lastIndex + 1);
  console.log(host);

  return {
    Authorization: `Bearer ${retrievePOAPKey()}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
    Host: host,
  };
}

export async function claimPOAPQR(address: string, qrHash: string, secret: string) {
  let poapData;
  try {
    const poapResponse = await fetch(`${process.env.POAP_API_URL}/actions/claim-qr`, {
      method: 'POST',
      body: JSON.stringify({
        address: address,
        qr_hash: qrHash,
        secret: secret,
      }),
      headers: await generatePOAPHeaders(),
    });

    if (poapResponse.status >= 400) {
      console.log(await poapResponse.text());
      return null;
    }

    poapData = await poapResponse.json();
  } catch (err) {
    console.log(err);
    return null;
  }

  return poapData;
}

export async function retrievePOAPEventInfo(eventId: number) {
  let eventData;
  try {
    const poapResponse = await fetch(`${process.env.POAP_API_URL}/events/id/${eventId}`, {
      method: 'GET',
      headers: await generatePOAPHeaders(),
    });

    if (poapResponse.status >= 400) {
      console.log(await poapResponse.text());
      return null;
    }

    eventData = await poapResponse.json();
  } catch (err) {
    console.log(err);
    return null;
  }

  return eventData;
}

export async function retrieveUsersPOAPs(address: string) {
  let poaps;
  try {
    const poapResponse = await fetch(`${process.env.POAP_API_URL}/actions/scan/${address}`, {
      method: 'GET',
      headers: await generatePOAPHeaders(),
    });

    if (poapResponse.status >= 400) {
      console.log(await poapResponse.text());
      return null;
    }

    poaps = await poapResponse.json();
  } catch (err) {
    console.log(err);
    return null;
  }

  return poaps;
}

export async function retrievePOAPInfo(poapTokenId: string) {
  try {
    const poapResponse = await fetch(`${process.env.POAP_API_URL}/token/${poapTokenId}`, {
      method: 'GET',
      headers: await generatePOAPHeaders(),
    });

    if (poapResponse.status >= 400) {
      console.log(await poapResponse.text());
      return null;
    }

    return await poapResponse.json();
  } catch (err) {
    console.log(err);
    return null;
  }
}
