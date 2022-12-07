import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { retrieveClaimInfo } from '../src/external/poap';

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

  const claimId = parseInt(argv['_'][0], 10);

  logger.info(`Retrieving minting status for Claim ID ${claimId} from POAP API`);

  const claim = await context.prisma.claim.findUnique({
    where: { id: claimId },
    select: {
      status: true,
      qrHash: true,
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
};

void main();
