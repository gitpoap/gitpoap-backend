declare global {
  namespace NodeJS {
    interface ProcessEnv {
      JWT_SECRET: string;
      NODE_ENV: string;
      AWS_PROFILE?: string;
      DATABASE_URL: string;
    }
  }
}

export {};
