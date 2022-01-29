import { objectType, queryType } from 'nexus';

export const User = objectType({
  name: 'User',
  definition(t) {
    t.nonNull.int('id');
    t.int('githubId');
    t.string('oauthToken');
    t.string('githubHandle');
  },
});

export const Query = queryType({
  definition(t) {
    t.list.field('allUsers', {
      type: 'User',
      resolve: (_parent, _args, context) => context.prisma.user.findMany(),
    });
  },
});
