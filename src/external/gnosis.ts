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

async function getTimestampForBlock(blockNumber: number) {
  const blockInfo = await getProvider().getBlock(blockNumber);

  return DateTime.fromSeconds(blockInfo.timestamp);
}

type GnosisPOAPMintData = {
  minedAt: DateTime;
  poapTokenId: string;
};

export async function getPOAPDataFromTransaction(
  txHash: string,
): Promise<GnosisPOAPMintData | null> {
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
        logger.info(`Transaction '${txHash}' has been mined!`);

        return {
          minedAt: await getTimestampForBlock(txReceipt.blockNumber),
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
