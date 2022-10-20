import * as Sentry from '@sentry/node';

export const captureException = (
  exception: unknown,
  tags: Record<string, string | null> = {},
  extra?: Record<string, any>,
) => {
  Sentry.captureException(exception, {
    level: 'error',
    tags,
    extra,
  });
};
