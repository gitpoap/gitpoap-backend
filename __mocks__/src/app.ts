import { loggingAndTimingMiddlewareMock } from './middleware/loggingAndTiming';
import { setupAppWithMiddleware } from '../../src/app';

export async function setupApp() {
  return await setupAppWithMiddleware([loggingAndTimingMiddlewareMock]);
}
