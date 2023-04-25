import { ethers } from 'ethers';
import XPoap from '../../abis/XPoap.json';
import { DateTime } from 'luxon';
import { GNOSIS_RPC } from '../constants';
import { createScopedLogger } from '../logging';

const MINTING_EVENT = 'EventToken';

function getProvider() {
  return new ethers.providers.JsonRpcProvider(GNOSIS_RPC);
}

function getPOAPInterface() {
  return new ethers.utils.Interface(XPoap);
}

async function getTimestampForBlock(blockNumber: number): Promise<DateTime | null> {
  const logger = createScopedLogger('getTimestampForBlock');

  const blockInfo = await getProvider().getBlock(blockNumber);

  if (blockInfo === null) {
    logger.warn(`Failed to lookup info about Gnosis Block #${blockNumber}`);
    return null;
  }

  return DateTime.fromSeconds(blockInfo.timestamp);
}

export type POAPMintData = {
  mintedAt: DateTime;
  poapTokenId: string;
};

export async function getPOAPDataFromTransaction(txHash: string): Promise<POAPMintData | null> {
  const logger = createScopedLogger('getPOAPDataFromTransaction');

  logger.info(`Checking if '${txHash}' has been mined for a POAP on Gnosis`);

  try {
    const txReceipt = await getProvider().getTransactionReceipt(txHash);
    if (txReceipt === null) {
      logger.warn(`Transaction '${txHash}' hasn't been mined on Gnosis yet`);
      return null;
    }

    const poapInterface = getPOAPInterface();

    for (const log of txReceipt.logs) {
      const logEvent = poapInterface.parseLog(log);

      if (logEvent.name === MINTING_EVENT) {
        const mintedAt = await getTimestampForBlock(txReceipt.blockNumber);
        if (mintedAt === null) {
          logger.warn(`Transaction ${txHash}'s block ${txReceipt.blockNumber} isn't queryable yet`);
          return null;
        }

        logger.info(`Transaction '${txHash}' has been mined!`);

        return {
          mintedAt,
          poapTokenId: logEvent.args.tokenId.toString(),
        };
      }
    }

    logger.error(`Transaction '${txHash}' doesn't have a mint (${MINTING_EVENT}) event`);
    return null;
  } catch (err) {
    logger.error(`Failed to lookup transaction '${txHash}' on Gnosis: ${err}`);
    return null;
  }
}
