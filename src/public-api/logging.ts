import winston from 'winston';
import { generateLogger, generateCreateScopedLogger, generateUpdateLogLevel } from '../logging';

const publicAPILogger = generateLogger('gitpoap-public-api');

export const createScopedLogger = generateCreateScopedLogger(publicAPILogger);
export const updateLogLevel = generateUpdateLogLevel(publicAPILogger);
