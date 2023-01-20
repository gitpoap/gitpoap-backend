declare global {
  namespace NodeJS {
    interface ProcessEnv {
      APP_NAME: string;

      JWT_SECRET: string;

      NODE_ENV: string;

      AWS_PROFILE?: string;

      DATABASE_URL: string;

      POAP_API_URL: string;
      POAP_AUTH_URL: string;
      POAP_CLIENT_ID: string;
      POAP_CLIENT_SECRET: string;

      INFURA_API_KEY?: string;

      GITHUB_API_URL: string;
      GITHUB_APP_URL: string;
      GITHUB_APP_CLIENT_ID: string;
      GITHUB_APP_CLIENT_SECRET: string;
      GITHUB_APP_REDIRECT_URL: string;

      REDIS_URL: string;

      MAILCHIMP_API_KEY: string;

      SENTRY_DSN: string;

      POSTMARK_SERVER_TOKEN: string;

      SLACK_TOKEN: string;

      GRAPHIQL_PASSWORD: string;

      PRIVY_APP_ID: string;
      PRIVY_APP_SECRET: string;
    }
  }
}

export {};
