import { collectDefaultMetrics, Histogram, Registry } from 'prom-client';
import { createServer, IncomingMessage } from 'http';
import { createScopedLogger } from './logging';
import { parse } from 'url';
import { NODE_ENV } from './environment';

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

const _gqlRequestDurationSeconds = new Histogram({
  name: 'gql_request_duration_seconds',
  help: 'Duration of GQL requests in seconds',
  labelNames: ['stage', 'request', 'success'],
});
register.registerMetric(_gqlRequestDurationSeconds);
export const gqlRequestDurationSeconds = {
  startTimer: (request: string) => {
    const endTimer = _gqlRequestDurationSeconds.startTimer();

    return (values: { success: number }) => {
      endTimer({ stage: NODE_ENV, request, ...values });
    };
  },
};

const _poapRequestDurationSeconds = new Histogram({
  name: 'poap_request_duration_seconds',
  help: 'Duration of POAP API requests in seconds',
  labelNames: ['stage', 'method', 'path', 'success'],
});
register.registerMetric(_poapRequestDurationSeconds);
export const poapRequestDurationSeconds = {
  startTimer: (method: string, path: string) => {
    const endTimer = _poapRequestDurationSeconds.startTimer();

    return (values: { success: number }) => {
      endTimer({ stage: NODE_ENV, method, path, ...values });
    };
  },
};

const _ensRequestDurationSeconds = new Histogram({
  name: 'ens_request_duration_seconds',
  help: 'Duration of ENS requests in seconds',
  labelNames: ['stage', 'method'],
});
register.registerMetric(_ensRequestDurationSeconds);
export const ensRequestDurationSeconds = {
  startTimer: (method: string) => {
    const endTimer = _ensRequestDurationSeconds.startTimer();

    return () => {
      endTimer({ stage: NODE_ENV, method });
    };
  },
};

const _githubRequestDurationSeconds = new Histogram({
  name: 'github_request_duration_seconds',
  help: 'Duration of GitHub API requests in seconds',
  labelNames: ['stage', 'method', 'path', 'success'],
});
register.registerMetric(_githubRequestDurationSeconds);
export const githubRequestDurationSeconds = {
  startTimer: (method: string, path: string) => {
    const endTimer = _githubRequestDurationSeconds.startTimer();

    return (values: { success: number }) => {
      endTimer({ stage: NODE_ENV, method, path, ...values });
    };
  },
};

export const _redisRequestDurationSeconds = new Histogram({
  name: 'redis_request_duration_seconds',
  help: 'Duration of redis requests in seconds',
  labelNames: ['stage', 'method'],
});
register.registerMetric(_redisRequestDurationSeconds);
export const redisRequestDurationSeconds = {
  startTimer: (method: string) => {
    const endTimer = _redisRequestDurationSeconds.startTimer();

    return () => {
      endTimer({ stage: NODE_ENV, method });
    };
  },
};
