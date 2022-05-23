import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { createServer, IncomingMessage } from 'http';
import { createScopedLogger } from './logging';
import { parse } from 'url';
import { NODE_ENV } from '../environment';

const METRICS_PORT = 8080;

const register = new Registry();

register.setDefaultLabels({ app: 'gitpoap-public-api' });

collectDefaultMetrics({ register });

const server = createServer(async (req: IncomingMessage, res) => {
  if (req.url) {
    const route = parse(req.url).pathname;

    if (route == '/metrics') {
      res.setHeader('Content-Type', register.contentType);

      res.end(await register.metrics());
    }
  }
});

export function startMetricsServer() {
  const logger = createScopedLogger('startMetricsServer');

  logger.debug('Starting metrics server');

  server.listen(METRICS_PORT, () => {
    logger.info(`Metrics server listening on port ${METRICS_PORT}`);
  });
}

const _httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_microseconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['stage', 'method', 'path', 'status'],
});
register.registerMetric(_httpRequestDurationSeconds);
export const httpRequestDurationSeconds = {
  startTimer: (method: string, path: string) => {
    const endTimer = _httpRequestDurationSeconds.startTimer();

    return (values: { status: number }) => {
      endTimer({ stage: NODE_ENV, method, path, ...values });
    };
  },
};
