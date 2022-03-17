import fetch from 'cross-fetch';
import { context } from '../context';
import { DateTime } from 'luxon';
import { POAP_AUTH_URL, POAP_API_URL, POAP_CLIENT_ID, POAP_CLIENT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';

const POAP_KEY_NAME = 'poap';

async function retrievePOAPToken(): Promise<string | null> {
  const logger = createScopedLogger('retrievePOAPToken');

  const secret = await context.prisma.secret.findUnique({
    where: {
      name: POAP_KEY_NAME,
    },
  });

  if (secret !== null) {
    const updatedAt = DateTime.fromJSDate(secret.updatedAt);

    // If the key is still valid let's use it
    if (updatedAt.plus({ hours: 10 }) >= DateTime.now()) {
      logger.debug('Using saved POAP API Token');

      return secret.key;
    }
  }

  logger.info('Retrieving a new POAP API Token');

  const poapResponse = await fetch(`${POAP_AUTH_URL}/oauth/token`, {
    method: 'POST',
    body: JSON.stringify({
      audience: 'gitpoap',
      grant_type: 'client_credentials',
      client_id: POAP_CLIENT_ID,
      client_secret: POAP_CLIENT_SECRET,
    }),
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (poapResponse.status >= 400) {
    logger.warn(`Bad response from POAP Auth: ${await poapResponse.text()}`);
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

  logger.debug('Completed retrieving a new POAP API Token');

  return data.access_token;
}

async function generatePOAPHeaders(hasBody: boolean) {
  // Remove the https:// from the url for the host header
  const lastIndex = POAP_API_URL.lastIndexOf('/');
  const host = POAP_API_URL.substr(lastIndex + 1);

  let base = {
    Authorization: `Bearer ${await retrievePOAPToken()}`,
    Accept: 'application/json',
    Host: host,
  };

  if (hasBody) {
    return { ...base, 'Content-Type': 'application/json' };
  }

  return base;
}

async function makePOAPRequest(url: string, method: string, body: string | null) {
  const logger = createScopedLogger('makePOAPRequest');

  let requestOptions;
  if (body !== null) {
    requestOptions = {
      method,
      body: body,
      headers: await generatePOAPHeaders(true),
    };
  } else {
    requestOptions = {
      method,
      headers: await generatePOAPHeaders(false),
    };
  }

  try {
    const poapResponse = await fetch(url, requestOptions);

    if (poapResponse.status >= 400) {
      logger.warn(`Bad response from POAP API: ${await poapResponse.text()}`);
      return null;
    }

    return await poapResponse.json();
  } catch (err) {
    logger.warn(`Error while calling POAP API: ${err}`);
    return null;
  }
}

async function createPOAPQR(eventId: number, secret: string) {
  return await makePOAPRequest(
    `${POAP_API_URL}/redeem-requests`,
    'POST',
    JSON.stringify({
      event_id: eventId,
      requested_codes: 1,
      secret_code: secret,
      redeem_type: 'qr_code',
    }),
  );
}

async function claimPOAPQR(address: string, qrHash: string, secret: string) {
  return await makePOAPRequest(
    `${POAP_API_URL}/actions/claim-qr`,
    'POST',
    JSON.stringify({
      address,
      qr_hash: qrHash,
      secret,
    }),
  );
}

export async function claimPOAP(eventId: number, address: string, secret: string) {
  const logger = createScopedLogger('claimPOAP');

  const qrHash = await createPOAPQR(eventId, secret);

  if (qrHash === null) {
    logger.warn('Failed to create a POAP QR hash');
    return null;
  }

  return await claimPOAPQR(address, qrHash.toString(), secret);
}

export async function retrievePOAPEventInfo(eventId: number) {
  return await makePOAPRequest(`${POAP_API_URL}/events/id/${eventId}`, 'GET', null);
}

export async function retrieveUsersPOAPs(address: string) {
  return await makePOAPRequest(`${POAP_API_URL}/actions/scan/${address}`, 'GET', null);
}

export async function retrievePOAPInfo(poapTokenId: string) {
  return await makePOAPRequest(`${POAP_API_URL}/token/${poapTokenId}`, 'GET', null);
}

export async function createPOAPEvent(
  name: string,
  description: string,
  start_date: string,
  end_date: string,
  expiry_date: string,
  year: number,
  event_url: string,
  image: string,
  secret_code: string,
  email: string,
  requested_codes: number,
) {
  return await makePOAPRequest(
    `${POAP_API_URL}/events`,
    'POST',
    JSON.stringify({
      name,
      description,
      city: '',
      country: '',
      start_date,
      end_date,
      expiry_date,
      year,
      event_url,
      virtual_event: true,
      image,
      secret_code,
      event_template_id: 0,
      email,
      requested_codes,
      private_event: false,
    }),
  );
}
