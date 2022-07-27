import {
  MILLISECONDS_PER_MINUTE,
  ONGOING_ISSUANCE_CHECK_FREQUENCY_MINUTES,
  CHECK_FOR_CODES_CHECK_FREQUENCY_MINUTES,
} from './constants';
import { tryToRunOngoingIssuanceUpdater } from './lib/ongoing';
import { tryToCheckForNewPOAPCodes } from './lib/codes';

async function startBatchProcess(processFunction: () => void, frequencyInMinutes: number) {
  // Try to run immediately
  await processFunction();

  setInterval(processFunction, frequencyInMinutes * MILLISECONDS_PER_MINUTE);
}

export async function startBatchProcesses() {
  startBatchProcess(tryToRunOngoingIssuanceUpdater, ONGOING_ISSUANCE_CHECK_FREQUENCY_MINUTES);

  startBatchProcess(tryToCheckForNewPOAPCodes, CHECK_FOR_CODES_CHECK_FREQUENCY_MINUTES);
}
