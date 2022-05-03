import { MILLISECONDS_PER_SECOND } from '../constants';

export async function sleep(seconds: number) {
  await new Promise(resolve => setTimeout(resolve, seconds * MILLISECONDS_PER_SECOND));
}
