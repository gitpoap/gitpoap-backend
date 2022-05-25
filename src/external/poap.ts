import fetch from 'cross-fetch';
import { context } from '../context';
import { DateTime } from 'luxon';
import {
  POAP_AUTH_URL,
  POAP_API_URL,
  POAP_CLIENT_ID,
  POAP_CLIENT_SECRET,
  POAP_API_KEY,
} from '../environment';
import { createScopedLogger } from '../logging';
import { createReadStream } from 'fs';
import FormData from 'form-data';
import { poapRequestDurationSeconds } from '../metrics';
import { URL } from 'url';

// DB keys
const POAP_DB_KEY_NAME = 'poap';

// Cache prefixes
const POAP_EVENT_CACHE_PREFIX = 'poap#event';
const POAP_TOKEN_CACHE_PREFIX = 'poap#token';
const POAP_USER_TOKENS_CACHE_PREFIX = 'poap#user-tokens';

async function retrievePOAPToken(): Promise<string | null> {
  const logger = createScopedLogger('retrievePOAPToken');

  const secret = await context.prisma.secret.findUnique({
    where: {
      name: POAP_DB_KEY_NAME,
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
      name: POAP_DB_KEY_NAME,
    },
    update: {
      key: data.access_token,
    },
    create: {
      name: POAP_DB_KEY_NAME,
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
    'X-API-Key': POAP_API_KEY,
    Accept: 'application/json',
    Host: host,
  };

  if (hasBody) {
    return { ...base, 'Content-Type': 'application/json' };
  }

  return base;
}

async function makeGenericPOAPRequest(
  path: string,
  method: string,
  headers: Record<string, string>,
  body: string | FormData | null,
) {
  const logger = createScopedLogger('makeGenericPOAPRequest');

  const endTimer = poapRequestDurationSeconds.startTimer(method, path);

  let requestOptions;
  if (body !== null) {
    requestOptions = {
      method,
      body: body as any,
      headers: headers,
    };
  } else {
    requestOptions = {
      method,
      headers: headers,
    };
  }

  try {
    const poapResponse = await fetch(new URL(path, POAP_API_URL).href, requestOptions);

    if (poapResponse.status >= 400) {
      logger.warn(
        `Bad response (${poapResponse.status}) from POAP API: ${await poapResponse.text()}`,
      );
      endTimer({ success: 0 });
      return null;
    }

    endTimer({ success: 1 });

    return await poapResponse.json();
  } catch (err) {
    logger.warn(`Error while calling POAP API: ${err}`);
    endTimer({ success: 0 });
    return null;
  }
}

async function makePOAPRequest(url: string, method: string, body: string | null) {
  const headers = await generatePOAPHeaders(body !== null);

  return makeGenericPOAPRequest(url, method, headers, body);
}

// Note that this function does not return any codes.
// Instead we need to wait for them to be sent to our email.
export async function requestPOAPCodes(
  event_id: number,
  secret_code: string,
  num_requested_codes: number,
) {
  return await makePOAPRequest(
    `${POAP_API_URL}/redeem-requests`,
    'POST',
    JSON.stringify({
      event_id,
      requested_codes: num_requested_codes,
      secret_code,
      redeem_type: 'qr_code',
    }),
  );
}

export async function retrieveClaimInfo(qr_hash: string) {
  return await makePOAPRequest(`${POAP_API_URL}/actions/claim-qr?qr_hash=${qr_hash}`, 'GET', null);
}

export async function redeemPOAP(address: string, qr_hash: string) {
  const logger = createScopedLogger('redeemPOAP');

  const claimInfo = await retrieveClaimInfo(qr_hash);
  if (claimInfo === null) {
    logger.error(`Failed to retrieve minting secret for qr_hash: ${qr_hash}`);
    return null;
  }

  return await makePOAPRequest(
    `${POAP_API_URL}/actions/claim-qr`,
    'POST',
    JSON.stringify({
      address,
      qr_hash,
      secret: claimInfo.secret,
    }),
  );
}

export async function retrievePOAPEventInfo(eventId: number) {
  const logger = createScopedLogger('retrievePOAPEventInfo');

  const cacheResponse = await context.redis.getValue(POAP_EVENT_CACHE_PREFIX, eventId.toString());

  if (cacheResponse !== null) {
    logger.debug(`Found POAP event ${eventId} info in cache`);

    return JSON.parse(cacheResponse);
  }

  logger.debug(`POAP event ${eventId} info not in cache`);

  const poapResponse = await makePOAPRequest(`${POAP_API_URL}/events/id/${eventId}`, 'GET', null);

  if (poapResponse !== null) {
    // Set no TTL since we assume events don't change
    context.redis.setValue(
      POAP_EVENT_CACHE_PREFIX,
      eventId.toString(),
      JSON.stringify(poapResponse),
    );
  }

  return poapResponse;
}

export async function retrieveUsersPOAPs(address: string) {
  const logger = createScopedLogger('retrieveUsersPOAPs');

  const cacheResponse = await context.redis.getValue(POAP_USER_TOKENS_CACHE_PREFIX, address);

  if (cacheResponse !== null) {
    logger.debug(`Found User ${address}'s POAPs in cache`);

    return JSON.parse(cacheResponse);
  }

  logger.debug(`User ${address}'s POAPs not in cache`);

  const poapResponse = await makePOAPRequest(
    `${POAP_API_URL}/actions/scan/${address}`,
    'GET',
    null,
  );

  if (poapResponse !== null) {
    // Cache for 1 minute
    context.redis.setValue(
      POAP_USER_TOKENS_CACHE_PREFIX,
      address,
      JSON.stringify(poapResponse),
      60,
    );
  }

  return poapResponse;
}

export async function retrievePOAPInfo(poapTokenId: string) {
  const logger = createScopedLogger('retrievePOAPInfo');

  const cacheResponse = await context.redis.getValue(
    POAP_TOKEN_CACHE_PREFIX,
    poapTokenId.toString(),
  );

  if (cacheResponse !== null) {
    logger.debug(`Found POAP token ${poapTokenId} info in cache`);

    return JSON.parse(cacheResponse);
  }

  logger.debug(`POAP token ${poapTokenId} info not in cache`);

  const poapResponse = await makePOAPRequest(`${POAP_API_URL}/token/${poapTokenId}`, 'GET', null);

  if (poapResponse !== null) {
    // Set no TTL since we assume tokens don't change (e.g. they won't be transferred)
    context.redis.setValue(
      POAP_TOKEN_CACHE_PREFIX,
      poapTokenId.toString(),
      JSON.stringify(poapResponse),
    );
  }

  return poapResponse;
}

export async function createPOAPEvent(
  name: string,
  description: string,
  start_date: string,
  end_date: string,
  expiry_date: string,
  year: number,
  event_url: string,
  imageName: string,
  imageBuffer: Buffer,
  secret_code: string,
  email: string,
  num_requested_codes: number,
  city?: string,
  country?: string,
) {
  let form = new FormData();

  form.append('name', name);
  form.append('description', description);
  form.append('city', city ?? '');
  form.append('country', country ?? '');
  form.append('start_date', start_date);
  form.append('end_date', end_date);
  form.append('expiry_date', expiry_date);
  form.append('year', year);
  form.append('event_url', event_url);
  form.append('virtual_event', 'true');
  form.append('image', imageBuffer, { filename: imageName });
  form.append('secret_code', secret_code);
  form.append('event_template_id', 0);
  form.append('email', email);
  form.append('requested_codes', num_requested_codes);
  form.append('private_event', 'false');
  let headers = { ...form.getHeaders(), ...(await generatePOAPHeaders(false)) };

  return await makeGenericPOAPRequest(`${POAP_API_URL}/events`, 'POST', headers, form);
}
