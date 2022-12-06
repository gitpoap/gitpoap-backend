import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { ethers } from 'ethers';
import XPoap from '../abis/XPoap.json';
import { DateTime } from 'luxon';

const GNOSIS_RPC = 'https://rpc.gnosischain.com/';
//const GNOSIS_RPC = 'https://rpc.ankr.com/gnosis';

async function lookupGnosisTransaction(txHash: string) {
  const gnosisProvider = new ethers.providers.JsonRpcProvider(GNOSIS_RPC);
  const xPoapInterface = new ethers.utils.Interface(XPoap);

  const receipt = await gnosisProvider.getTransactionReceipt(txHash);

  const timestampSeconds = (await gnosisProvider.getBlock(receipt.blockNumber)).timestamp;
  const timestamp = DateTime.fromSeconds(timestampSeconds).toJSDate();

  console.log(`Timestamp: ${timestamp}`);

  for (const log of receipt.logs) {
    const event = xPoapInterface.parseLog(log);

    if (event.name === 'EventToken') {
      console.log(`Token ID: ${event.args.tokenId}`);
    }
  }
}

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

  await lookupGnosisTransaction(argv['_'][0]);
};

void main();
