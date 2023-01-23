import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { retrieveUsersPOAPs } from '../src/external/poap';

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2), { string: '_' });

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  if (!('_' in argv) || argv['_'].length !== 1) {
    logger.error('Expected one address to be provided as an argument');
    process.exit(1);
    return;
  }

  await context.redis.connect();
  logger.info('Connected to redis');

  console.log(await retrieveUsersPOAPs(argv['_'][0]));

  await context.redis.disconnect();
};

void main();
