import { NODE_ENV } from './environment';

export const PORT = 3001;
export const PUBLIC_API_PORT = 3122;

export const STAFF_GITHUB_IDS = [
  914240, // Colfax
  8076957, // Jay
  1555326, // Anna / burz
  19416312, // Aldo
];

export const STAFF_ADDRESSES = [
  '0x56d389c4e07a48d429035532402301310b8143a0', // Colfax
  '0xae32d159bb3abfcadfabe7abb461c2ab4805596d', // Jay
  '0xae95f7e7fb2fcf86148ef832faed2752ae5a358a', // Anna / burz
  '0x02738d122e0970aaf8deadf0c6a217a1923e1e99', // Aldo
  '0x9b6e1a427be7a9456f4af18eeaa354ccabf3980a', // gitpoap.eth
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
export const SIGNATURE_TTL_DAYS = 30;

export const LOGIN_EXP_TIME_MONTHS = 1;

export const GITPOAP_ISSUER_EMAIL = 'issuer@gitpoap.io';

export const GITPOAP_ROOT_URL = 'https://www.gitpoap.io';
export const GITPOAP_DEV_ROOT_URL = 'http://localhost:3000';

export const GITPOAP_API_URL = 'https://api.gitpoap.io';
export const GITPOAP_STAGING_API_URL = 'https://brisket-api.gitpoap.io';
export const GITPOAP_DEV_API_URL = 'http://localhost:3001';

export const TEAM_EMAIL = 'team@gitpoap.io';

export const COMPANY_NAME = 'MetaRep Labs Inc';
export const COMPANY_ADDRESS = 'One Broadway, Cambridge MA 02142';
export const TEAM_NAME = 'GitPOAP Team';
export const PRODUCT_NAME = 'GitPOAP';
export const GITPOAP_DOC_URL = 'https://docs.gitpoap.io';

export const PROD_ENV = 'production';
export const STAGING_ENV = 'staging';

export const IS_PROD = NODE_ENV === PROD_ENV;

// The absolute minimum codes we will request for a Custom GitPOAP
export const CUSTOM_GITPOAP_MINIMUM_CODES = 20;
// The buffer of codes we will add to the count of
// contributors for a Custom GitPOAP
export const CUSTOM_GITPOAP_CODE_BUFFER = 5;
// The maximum number of codes we will request to start
// out with from POAP for a Custom GitPOAP
export const CUSTOM_GITPOAP_MAX_STARTING_CODES = 100;

export const DISCORD_URL = 'https://discord.com';
export const DISCORD_AUTH_GRANT_TYPE = 'authorization_code';
export const DISCORD_AUTH_SCOPE = 'identify';

export const GNOSIS_RPC = 'https://rpc.gnosischain.com/';

export const POAP_DATE_FORMAT = 'yyyy-MM-dd';

// Maximum size of Team logos sides
export const MAX_LOGO_IMAGE_SIZE = 500;

export const CGsWhitelist = new Set([
  '0x304cf9a8b0856f47ccf9cfd5a5bad1d67b0576a7',
  '0x7ebff2517fc905736464996c6ba5d4e04ee5ee78',
  '0x4dd05e12d0244575c77c31c24f0e273610c085d9',
  '0x259539048aa803d8728c2d1b8f942a2dd02deb45',
  '0xd240bc7905f8d32320937cd9acc3e69084ec4658',
  '0x85a6a7d5f7f5dd61cad9a7a23572b6d5a8ff85f9',
  '0x9a6185cdb0d83ed8319b6e01f791b8dfcb9425df',
  '0x89f709deb04ccb0981c438d34073bbb0b710bbd2',
  '0x158d6919f02657c2d19041693cb58daaa201f367',
  '0xd2a2b709af3b6d0bba1ccbd1edd65f353aa42c66',
  '0xa4e5fcc5d6ba73175e47db5655acd0020fdabd87',
  '0x90c0ce9666d6bb3612eb2c2ce82b14a884b1a648',
  '0xdf76ed6ddce8c825e9f5a749355a2e54b9cd6302',
  '0x40f3f0b5342bad298cc9fecd0d639205487036a9',
  '0x7e0305db11088ec12ab00b7d68f26ab31f722027',
  '0xab4ee3e9a48057bcfb2fbc8872dcf0273c115e49',
  '0xa4c58baf393ebf3a281a4bc6152ae084e63dc28e',
  '0x046f1453ff5b4dbbd951b6d49713d06f9a700e23',
  '0x810168d1f6c642176db5de37cdf07c2c1cdbcadb',
  '0x8d0755c830f466c1a19c5705bd603c38c0a18e6e',
  '0x5e666460e5bb4a8bb14e805478176c36f3b293ab',
  '0x4e3072f7b5c075ea5fdeb423da95312c4b99dc22',
  '0x04bbb7ea18ea570ae47d4489991645e4e49bbf37',
  '0x984886312107a9ae23b8290d6c1d519a737283a2',
  '0xa92a340b21b2a913d5d47b651b45560f9d954eb4',
  '0xa77c72924929c34291ba9491db7cb569afb7b648',
  '0xb9e27d21a3321309ba9097220607edaab06eecf8',
  '0x03cf46893855084cb75aed3c782088bbe1bac5f3',
  '0x599abe13e88f1045e3aefe02a07f7bafc0c76b76',
  '0x0f831a90fd7cd559404b77d4b42aa3ef4cc28a63',
  '0xfe67d1249e2555a051069ce6cd46021b7fd63f82',
  '0x31d4dcc55abf901ace6e18188151113b9971740c',
  '0x2397ec83a8beaecc7a7272faeba85d11ee17e8cb',
  '0x881a01bba8182e14624c046fd5880c84d14a1507',
  '0x77b3a164412616656c995ea54464c030f9fe0489',
  '0x183199269307bee7e47bb6727e1b68997b058a62',
  '0xc587892692e71836c35ff914703be3e53d298f80',
  '0xc7054d9500e9ee1ad7bf245bbdb5eaa112a81737', // Luka Ethereum.org
  '0xd33f6e443d5277e7a0040672885358e22e1e7356', // Josh from Ethereum.org
  '0x2606cb984b962ad4aa1ef00f9af9b654b435ad44', // Derrek from EthDenver
  '0xe00adfc5fdab3a4d32baeb4a21b430eec0c8c774', // Brett from Obol
  '0xc25e4dc9901291be3d40a22afd7663e1afe343d3', // Frangio from OZ
  '0x4dd05e12d0244575c77c31c24f0e273610c085d9', // armagan.eth
]);
// NOTE: When adding new addresses to the list, make sure the are all *lowercase*
