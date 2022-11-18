import { loggingAndTimingMiddlewareMock } from '../middleware/loggingAndTiming';
import { setupAppWithMiddleware } from '../../../src/public-api/app';

export function setupApp() {
  return setupAppWithMiddleware([loggingAndTimingMiddlewareMock]);
}
