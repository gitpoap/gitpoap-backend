import setupCors from 'cors';
import { GITPOAP_ROOT_URL, GITPOAP_STAGING_ROOT_URL, PROD_ENV, STAGING_ENV } from '../constants';
import { NODE_ENV } from '../environment';

function initializeCors() {
  switch (NODE_ENV) {
    case PROD_ENV:
      return setupCors({ origin: GITPOAP_ROOT_URL });
      break;
    case STAGING_ENV:
      return setupCors({ origin: GITPOAP_STAGING_ROOT_URL });
      break;
    default:
      // Don't restrict origin on DEV
      return setupCors();
      break;
  }
}

export const cors = initializeCors();
