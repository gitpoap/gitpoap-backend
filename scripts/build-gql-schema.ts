import { config } from 'dotenv';
config();

import 'reflect-metadata';
import { createAndEmitSchema } from '../src/graphql/schema';

const main = async () => {
  await createAndEmitSchema();
};

void main();
