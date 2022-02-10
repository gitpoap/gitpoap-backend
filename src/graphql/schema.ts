import { buildSchema } from 'type-graphql';
import { resolvers } from '@generated/type-graphql';

export const getSchema = buildSchema({
  resolvers,
  emitSchemaFile: true,
  validate: false,
});
