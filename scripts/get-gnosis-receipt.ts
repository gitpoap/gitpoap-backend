import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { getPOAPDataFromTransaction } from '../src/external/gnosis';

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2), { string: ['_'] });

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  if (argv['_'].length !== 1) {
    logger.error('A Gnosis transaction hash must be specified');
    process.exit(1);
    return;
  }

  const data = await getPOAPDataFromTransaction(argv['_'][0]);

  if (data !== null) {
    console.log(`\nMinted at: ${data.mintedAt}`);
    console.log(`POAP Token ID: ${data.poapTokenId}\n`);
  }
};

void main();
