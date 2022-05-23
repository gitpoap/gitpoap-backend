#!/usr/bin/env node

import { App } from 'aws-cdk-lib';
import { DbMigratorStack } from '../lib/db-migrator-stack';

const stackName =
  process.env.STAGE_TAG === '-staging' ? 'DbMigratorStagingStack' : 'DbMigratorStack';

const app = new App();

new DbMigratorStack(app, stackName, {
  env: {
    account: '510113809275',
    region: 'us-east-2',
  },
});
