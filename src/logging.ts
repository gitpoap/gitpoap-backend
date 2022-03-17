import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    // Pad the levels and uppercase before they are colored
    winston.format((info, opts) => {
      info.level = info.level.toUpperCase().padStart(5);
      return info;
    })(),
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
    debug: (msg: string) => logger.debug(`(${scopeId}) ${scope}: ${msg}`),
    info: (msg: string) => logger.info(`(${scopeId}) ${scope}: ${msg}`),
    warn: (msg: string) => logger.warn(`(${scopeId}) ${scope}: ${msg}`),
    error: (msg: string) => logger.error(`(${scopeId}) ${scope}: ${msg}`),
  };
}

export function updateLogLevel(level: string) {
  const lg = createScopedLogger('updateLogLevel');

  switch (level) {
    case 'debug':
    case 'info':
    case 'warn':
    case 'error':
      logger.level = level;
      lg.info(`Updated log level to ${level}`);
    case undefined:
      break;
    default:
      lg.warn(`Unkown log level "${level}". Defaulting to "info"`);
      break;
  }
}
