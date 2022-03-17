import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.colorize(),
    winston.format.printf(({ level, message, timestamp }) => {
      return `${timestamp} [gitpoap-backend] ${level}: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

let nextScopeId = 1;

export function createScopedLogger(scope: string) {
  let scopeId = nextScopeId++;

  return {
    debug: (msg: string) => logger.debug(`${scope} (${scopeId}): ${msg}`),
    info: (msg: string) => logger.info(`${scope} (${scopeId}): ${msg}`),
    warn: (msg: string) => logger.warn(`${scope} (${scopeId}): ${msg}`),
    error: (msg: string) => logger.error(`${scope} (${scopeId}): ${msg}`),
  };
}
