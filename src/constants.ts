export const PORT = 3001;
export const JWT_EXP_TIME = 60 * 10;
export const SIGNATURE_TTL_MINUTES = 1;

export const ADMIN_GITHUB_IDS = [
  914240, // colfax23
  8076957, // jaypb1
  1555326, // burz
];

// The minimum number of redeem codes we need to maintain
// for "ongoing" GitPOAPs. If we reach this threshold after
// a claim, we will request additional codes
export const MINIMUM_REMAINING_REDEEM_CODES = 15;
// The number of new claims to request
export const REDEEM_CODE_STEP_SIZE = 50;
