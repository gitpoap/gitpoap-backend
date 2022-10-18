import { context } from '../context';

export const deleteGitPOAPRequest = async (id: number) => {
  await context.prisma.gitPOAPRequest.delete({
    where: { id },
  });
};
