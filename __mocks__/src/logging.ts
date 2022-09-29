import 'reflect-metadata';

export const mockedLogger = {
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
};

jest.mock('../../src/logging', () => ({
  __esModule: true,
  createScopedLogger: () => mockedLogger,
}));
