import 'reflect-metadata';

jest.mock('@slack/web-api', () => {
  return {
    WebClient: jest.fn().mockImplementation(() => ({
      chat: {
        postMessage: jest.fn(),
      },
    })),
  };
});
