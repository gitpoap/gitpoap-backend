const MILLISECONDS_PER_SECOND = 1000;

export async function sleep(seconds: number) {
  await new Promise(resolve => setTimeout(resolve, seconds * MILLISECONDS_PER_SECOND));
}
