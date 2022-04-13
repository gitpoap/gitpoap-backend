import winston from 'winston';
import { NODE_ENV } from './environment';

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  // Pad the levels and uppercase before they are colored
  winston.format((info, opts) => {
    info.level = info.level.toUpperCase().padStart(5);
    return info;
  })(),
);

// We want to make sure we aren't colorizing the logs that will
// be ingested by CloudWatch/etc
let colorFormat;
switch (NODE_ENV) {
  case 'production':
  case 'staging':
    colorFormat = baseFormat;
    break;
  default:
    colorFormat = winston.format.combine(baseFormat, winston.format.colorize());
    break;
}

const format = winston.format.combine(
  colorFormat,
  winston.format.printf(({ level, message, timestamp }) => {
    return `${timestamp} [gitpoap-backend] ${level}: ${message}`;
  }),
);

const logger = winston.createLogger({
  level: 'info',
  format: format,
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

let nextScopeId = 1;

export function createScopedLogger(scope: string) {
  let scopeId = nextScopeId++;

  let format = (msg: string) => `(${scopeId.toString().padStart(7)}) ${scope}: ${msg}`;

  return {
    debug: (msg: string) => logger.debug(format(msg)),
    info: (msg: string) => logger.info(format(msg)),
    warn: (msg: string) => logger.warn(format(msg)),
    error: (msg: string) => logger.error(format(msg)),
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
