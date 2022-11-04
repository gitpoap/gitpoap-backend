import winston from 'winston';
import { APP_NAME, NODE_ENV } from './environment';

const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  // Pad the levels and uppercase before they are colored
  winston.format(info => {
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
    return `${timestamp} [${APP_NAME}] ${level}: ${message}`;
  }),
);

const logger = winston.createLogger({
  level: 'info',
  format,
  transports: [new winston.transports.Console()],
  exceptionHandlers: [new winston.transports.Console()],
  rejectionHandlers: [new winston.transports.Console()],
});

let nextScopeId = 1;

export type Logger = {
  debug: (msg: string) => void;
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

export function isLogger(obj: any): obj is Logger {
  return (
    'debug' in obj &&
    typeof obj.debug === 'function' &&
    'info' in obj &&
    typeof obj.info === 'function' &&
    'warn' in obj &&
    typeof obj.warn === 'function' &&
    'error' in obj &&
    typeof obj.error === 'function'
  );
}

export function createScopedLogger(scope: string): Logger {
  const scopeId = nextScopeId++;

  const format = (msg: string) => `(${scopeId.toString().padStart(7)}) ${scope}: ${msg}`;

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
      lg.warn(`Unknown log level "${level}". Defaulting to "info"`);
      break;
  }
}
