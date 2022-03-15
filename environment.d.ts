declare global {
  namespace NodeJS {
    interface ProcessEnv {
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
    }
  }
}

export {};
