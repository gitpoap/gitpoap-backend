export const PORT = 3001;
export const PUBLIC_API_PORT = 3122;

export const JWT_EXP_TIME = 60 * 10;
export const SIGNATURE_TTL_MINUTES = 1;

export const ADMIN_GITHUB_IDS = [
  914240, // colfax23
  8076957, // jaypb1
  1555326, // burz
  23272494, // kayleen / nixorokish
];

// The minimum number of redeem codes we need to maintain
// for "ongoing" GitPOAPs. If we reach this threshold after
// a claim, we will request additional codes
export const MINIMUM_REMAINING_REDEEM_CODES = 15;
// The number of new claims to request
export const REDEEM_CODE_STEP_SIZE = 50;

// How often do we check if we can run the ongoing issuance background
// process per instance?
export const ONGOING_ISSUANCE_CHECK_FREQUENCY_MINUTES = 30;

export const SECONDS_PER_MINUTE = 60;
export const SECONDS_PER_HOUR = 60 * SECONDS_PER_MINUTE;
export const SECONDS_PER_DAY = 24 * SECONDS_PER_HOUR;

export const MILLISECONDS_PER_SECOND = 1000;
export const MILLISECONDS_PER_MINUTE = SECONDS_PER_MINUTE * MILLISECONDS_PER_SECOND;

// Limit each IP to 100 requests in a 5 minute window
export const PUBLIC_API_RATE_LIMIT_WINDOW = 5 * MILLISECONDS_PER_MINUTE;
export const PUBLIC_API_RATE_LIMIT_MAX_REQUESTS = 100;
