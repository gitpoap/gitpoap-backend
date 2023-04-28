import env from 'env-var';

export const APP_NAME = env.get('APP_NAME').required().asString();

export const JWT_SECRET = env.get('JWT_SECRET').required().asString();

export const NODE_ENV = env.get('NODE_ENV').required().asString();

export const AWS_PROFILE = env.get('AWS_PROFILE').asString();

export const DATABASE_URL = env.get('DATABASE_URL').required().asString();

export const POAP_API_URL = env.get('POAP_API_URL').required().asString();
export const POAP_AUTH_URL = env.get('POAP_AUTH_URL').required().asString();
export const POAP_CLIENT_ID = env.get('POAP_CLIENT_ID').required().asString();
export const POAP_CLIENT_SECRET = env.get('POAP_CLIENT_SECRET').required().asString();
export const POAP_API_KEY = env.get('POAP_API_KEY').required().asString();

export const INFURA_API_KEY = env.get('INFURA_API_KEY').asString();

export const GITHUB_URL = env.get('GITHUB_URL').required().asString();
export const GITHUB_API_URL = env.get('GITHUB_API_URL').required().asString();
export const GITHUB_APP_CLIENT_ID = env.get('GITHUB_APP_CLIENT_ID').required().asString();
export const GITHUB_APP_CLIENT_SECRET = env.get('GITHUB_APP_CLIENT_SECRET').required().asString();
export const GITHUB_APP_REDIRECT_URL = env.get('GITHUB_APP_REDIRECT_URL').required().asString();

export const REDIS_URL = env.get('REDIS_URL').required().asString();

export const MAILCHIMP_API_KEY = env.get('MAILCHIMP_API_KEY').required().asString();

export const SENTRY_DSN = env.get('SENTRY_DSN').asString();

export const POSTMARK_SERVER_TOKEN = env.get('POSTMARK_SERVER_TOKEN').required().asString();
export const SLACK_TOKEN = env.get('SLACK_TOKEN').required().asString();

export const GRAPHIQL_PASSWORD = env.get('GRAPHIQL_PASSWORD').required().asString();

export const PRIVY_APP_ID = env.get('PRIVY_APP_ID').required().asString();
export const PRIVY_APP_SECRET = env.get('PRIVY_APP_SECRET').required().asString();

// See https://stackoverflow.com/a/74858179/18750275
process.env.PRIVY_APP_PUBLIC_KEY.replace(/\\n/gm, '\n');
export const PRIVY_APP_PUBLIC_KEY = env.get('PRIVY_APP_PUBLIC_KEY').required().asString();
