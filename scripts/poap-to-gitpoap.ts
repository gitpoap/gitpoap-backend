import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createScopedLogger, updateLogLevel } from '../src/logging';
import minimist from 'minimist';
import { context } from '../src/context';
import { retrievePOAPEventInfo, retrievePOAPsForEvent } from '../src/external/poap';
import readline from 'readline';
import { ClaimStatus, GitPOAPStatus, GitPOAPType } from '@prisma/client';
import { ADDRESSES } from '../prisma/constants';
import { upsertAddress } from '../src/lib/addresses';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

const prompt: (q: string) => Promise<string> = (text: string) =>
  new Promise(resolve => {
    rl.question(text, (response: string) => {
      resolve(response);
    });
  });

async function convertPOAPToGitPOAP(poapEventId: number) {
  const logger = createScopedLogger('convertPOAPToGitPOAP');

  logger.info(`Converting POAP Event ID ${poapEventId} to a GitPOAP`);

  const poapEventInfo = await retrievePOAPEventInfo(poapEventId);

  if (poapEventInfo === null) {
    logger.error(`Couldn't find POAP Event ID ${poapEventId} via the POAP API`);
    return;
  }

  const poapSecret = await prompt('\nPlease enter the secret code for this POAP: ');

  console.log('\nWill use:');
  console.log(` * Name: "${poapEventInfo.name}"`);
  console.log(` * Description: "${poapEventInfo.description}"`);
  console.log(` * Image URL: ${poapEventInfo.image_url}`);
  console.log(` * Year: ${poapEventInfo.year}`);
  console.log(` * POAP Secret: "${poapSecret}"`);

  const isCorrect = await prompt('\nIs this correct? [y|N] ');

  console.log('');

  if ('y' !== isCorrect.toLowerCase()) {
    logger.warn('User aborted conversion');
    return;
  }

  logger.info('Looking up current token holders via POAP API');

  const tokens = await retrievePOAPsForEvent(poapEventId);

  if (tokens === null) {
    logger.error(
      `Failed to lookup current token holders for POAP Event ID ${poapEventId} via POAP API`,
    );
    return;
  }

  logger.info(`Found ${tokens.length} token holders`);

  console.log('\nCurrent token holders:');

  for (const token of tokens) {
    console.log(
      ` * POAP Token ID: "${token.id}", Minted: "${token.created}", Owner: ${token.owner.id}`,
    );
  }

  const shouldContinue = await prompt('\nShould we make the conversion? [y|N]');

  console.log('');

  if ('y' !== shouldContinue.toLowerCase()) {
    logger.warn('User aborted conversion');
    return;
  }

  logger.info(`Converting POAP ID ${poapEventId} to a GitPOAP with ${tokens.length} owners`);

  const gitPOAP = await context.prisma.gitPOAP.create({
    data: {
      type: GitPOAPType.CUSTOM,
      name: poapEventInfo.name,
      imageUrl: poapEventInfo.image_url,
      description: poapEventInfo.description,
      year: poapEventInfo.year,
      poapEventId,
      poapSecret,
      poapApprovalStatus: GitPOAPStatus.APPROVED,
      isOngoing: true,
      isPRBased: false,
      isEnabled: true,
      // Temporarily use Kayleen's address
      creatorAddress: {
        connect: { ethAddress: ADDRESSES.kayleen },
      },
    },
  });

  logger.info(`Created GitPOAP ID ${gitPOAP.id}`);

  for (const token of tokens) {
    const address = await upsertAddress(token.owner.id);

    if (address === null) {
      logger.error(`Failed to upsert address ${token.owner.id} for POAP Token ID ${token.id}`);
      continue;
    }

    await context.prisma.claim.create({
      data: {
        mintedAt: new Date(token.created),
        status: ClaimStatus.CLAIMED,
        poapTokenId: token.id,
        mintedAddress: {
          connect: { id: address.id },
        },
        issuedAddress: {
          connect: { id: address.id },
        },
        gitPOAP: {
          connect: { id: gitPOAP.id },
        },
      },
    });
  }

  logger.info(`Created ${tokens.length} CLAIMED Claims for GitPOAP ID ${gitPOAP.id}`);
}

const main = async () => {
  const logger = createScopedLogger('main');

  const argv = minimist(process.argv.slice(2));

  logger.info(`Command line args: ${JSON.stringify(argv)}`);

  updateLogLevel(argv['level']);

  if (!('_' in argv) || argv['_'].length !== 1) {
    logger.error('The POAP Event ID must be supplied as a command line argument');
    process.exit(1);
  }

  const poapEventId = parseInt(argv['_'][0], 10);

  await context.redis.connect();
  logger.info('Connected to redis');

  await convertPOAPToGitPOAP(poapEventId);

  await context.redis.disconnect();

  // Close readline
  await rl.close();
};

void main();
