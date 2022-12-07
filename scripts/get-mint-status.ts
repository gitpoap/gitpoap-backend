import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { retrieveClaimInfo, retrieveUsersPOAPs } from '../src/external/poap';
import { getPOAPDataFromTransaction } from '../src/external/gnosis';
import { DateTime } from 'luxon';

async function getMintStatus(claimId: number) {
  const logger = createScopedLogger('getMintStatus');

  logger.info(`Retrieving minting status for Claim ID ${claimId} from POAP API`);

  const claim = await context.prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      status: true,
      qrHash: true,
      gitPOAP: {
        select: {
          poapEventId: true,
        },
      },
    },
  });
  if (claim === null) {
    logger.error(`Failed to lookup Claim ID ${claimId}`);
    process.exit(1);
    return;
  }

  logger.info(`Claim ID ${claimId} has status ${claim.status}`);

  if (claim.qrHash === null) {
    return;
  }

  const poapResponse = await retrieveClaimInfo(claim.qrHash);
  if (poapResponse === null) {
    logger.error(`Failed to lookup minting status via POAP API`);
    process.exit(2);
    return;
  }

  console.log(poapResponse);

  if (poapResponse.tx_hash === '') {
    logger.warn('The transaction to mint has not been submitted!');
    return;
  } else if (poapResponse.tx_status !== 'passed' && poapResponse.tx_status !== 'bumped') {
    logger.warn('The transaction has not been mined yet');
    return;
  }

  const gnosisData = await getPOAPDataFromTransaction(poapResponse.tx_hash);
  if (gnosisData !== null) {
    logger.info('Found mint via Gnosis transaction');
    console.log(`\nMinted at: ${gnosisData.mintedAt}`);
    console.log(`POAP Token ID: ${gnosisData.poapTokenId}\n`);
    return;
  }

  logger.info(`Checking if POAP Event ID ${claim.gitPOAP.poapEventId} is in user's list of POAPs`);

  const poapListResponse = await retrieveUsersPOAPs(poapResponse.beneficiary);
  if (poapListResponse === null) {
    logger.error(`Failed to lookup POAPs for address ${poapResponse.beneficiary}`);
    process.exit(3);
    return;
  }

  let candidateCount = 0;
  for (const poap of poapListResponse) {
    if (poap.event.id === claim.gitPOAP.poapEventId) {
      console.log(`\nFound candidate #${++candidateCount}:`);
      console.log(poap);
      console.log(`\n * Minted at: ${DateTime.fromISO(poap.created.replace(' ', 'T'))}`);
      console.log(` * POAP Token ID: ${poap.tokenId}\n`);
    }
  }

  if (candidateCount === 0) {
    logger.warn(`Found no candidates for POAP Event ID ${claim.gitPOAP.poapEventId}`);
  }
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  if (argv['_'].length !== 1) {
    logger.error('A Claim ID must be specified');
    process.exit(1);
    return;
  }

  await context.redis.connect();
  logger.info('Connected to redis');

  await getMintStatus(parseInt(argv['_'][0], 10));

  await context.redis.disconnect();
};

void main();
