import { loggingAndTimingMiddlewareMock } from '../middleware/loggingAndTiming';
import { setupAppWithMiddleware } from '../../../src/backend/app';

export async function setupApp() {
  return await setupAppWithMiddleware([loggingAndTimingMiddlewareMock]);
}
