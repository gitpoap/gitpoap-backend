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
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'path', 'status'],
});
register.registerMetric(httpRequestDurationSeconds);

export const gqlRequestDurationSeconds = new Histogram({
  name: 'gql_request_duration_seconds',
  help: 'Duration of GQL requests in seconds',
  labelNames: ['request', 'success'],
});
register.registerMetric(gqlRequestDurationSeconds);

export const poapRequestDurationSeconds = new Histogram({
  name: 'poap_request_duration_seconds',
  help: 'Duration of POAP API requests in seconds',
  labelNames: ['method', 'path', 'success'],
});
register.registerMetric(poapRequestDurationSeconds);

export const ensRequestDurationSeconds = new Histogram({
  name: 'ens_request_duration_seconds',
  help: 'Duration of ENS requests in seconds',
  labelNames: ['method'],
});
register.registerMetric(ensRequestDurationSeconds);

export const githubRequestDurationSeconds = new Histogram({
  name: 'github_request_duration_seconds',
  help: 'Duration of GitHub API requests in seconds',
  labelNames: ['method', 'path', 'success'],
});
register.registerMetric(githubRequestDurationSeconds);

export const redisRequestDurationSeconds = new Histogram({
  name: 'redis_request_duration_seconds',
  help: 'Duration of redis requests in seconds',
  labelNames: ['method'],
});
register.registerMetric(redisRequestDurationSeconds);
