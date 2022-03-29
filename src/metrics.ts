import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { createServer, IncomingMessage } from 'http';
import { createScopedLogger } from './logging';
import { parse } from 'url';

const METRICS_PORT = 8080;

const register = new Registry();

register.setDefaultLabels({ app: 'gitpoap-backend' });

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

export const httpRequestDurationSeconds = new Histogram({
  name: 'http_request_duration_microseconds',
  help: 'Duration of HTTP requests in microseconds',
});
register.registerMetric(httpRequestDurationSeconds);

export const gqlRequestDurationSeconds = new Histogram({
  name: 'gql_request_duration_seconds',
  help: 'Duration of GQL requests in seconds',
  labelNames: ['request', 'success'],
});
register.registerMetric(gqlRequestDurationSeconds);
