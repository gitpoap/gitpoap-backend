export const PORT = 3001;
export const PUBLIC_API_PORT = 3122;

export const ADMIN_GITHUB_IDS = [
  914240, // Colfax
  8076957, // Jay
  1555326, // Anna / burz
  23272494, // Kayleen / nixorokish
  109097759, // Kayla
  19416312, // Aldo
  110413633, // Tyler
];

export const ADMIN_ADDRESSES = [
  '0x56d389c4e07a48d429035532402301310b8143a0', // Colfax
  '0xae32d159bb3abfcadfabe7abb461c2ab4805596d', // Jay
  '0xae95f7e7fb2fcf86148ef832faed2752ae5a358a', // Anna / burz
  '0x04c0cd38b8c203b14ef2b7b8d736d69b938aff71', // Kayleen / nixorokish
  '0xa4c58baf393ebf3a281a4bc6152ae084e63dc28e', // Kayla
  '0x02738d122e0970aaf8deadf0c6a217a1923e1e99', // Aldo
  '0xe078c3bdee620829135e1ab526be860498b06339', // Tyler
];

export const GITPOAP_BOT_APP_ID = 209535;

// The minimum number of redeem codes we need to maintain
// for "ongoing" GitPOAPs. If we reach this threshold after
// a claim, we will request additional codes
export const MINIMUM_REMAINING_REDEEM_CODES = 15;
// The number of new claims to request
export const REDEEM_CODE_STEP_SIZE = 50;

// How often do we check if we can run background processes per instance?
export const ONGOING_ISSUANCE_CHECK_FREQUENCY_MINUTES = 30;
export const CHECK_FOR_CODES_CHECK_FREQUENCY_MINUTES = 5;

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
export const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

export const MILLISECONDS_PER_SECOND = 1000;
export const MILLISECONDS_PER_MINUTE = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

// Limit each IP to 100 requests in a 5 minute window
export const PUBLIC_API_RATE_LIMIT_WINDOW = 1 * MILLISECONDS_PER_MINUTE;
export const PUBLIC_API_RATE_LIMIT_MAX_REQUESTS = 1000;

export const MEGABYTES_TO_BYTES = 1000000;

export const JWT_EXP_TIME_SECONDS = 10 * SECONDS_PER_MINUTE;
export const SIGNATURE_TTL_MINUTES = 1;

export const LOGIN_EXP_TIME_MONTHS = 1;

export const GITPOAP_ISSUER_EMAIL = 'issuer@gitpoap.io';

export const GITPOAP_ROOT_URL = 'https://www.gitpoap.io';
export const GITPOAP_DEV_ROOT_URL = 'http://localhost:3000';

export const TEAM_EMAIL = 'team@gitpoap.io';

export const COMPANY_NAME = 'MetaRep Labs Inc';
export const COMPANY_ADDRESS = 'One Broadway, Cambridge MA 02142';
export const TEAM_NAME = 'GitPOAP Team';
export const PRODUCT_NAME = 'GitPOAP';
export const GITPOAP_DOC_URL = 'https://docs.gitpoap.io';
