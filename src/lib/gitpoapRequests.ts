import { context } from '../context';
import { AdminApprovalStatus } from '@prisma/client';

export async function deleteGitPOAPRequest(id: number) {
  await context.prisma.gitPOAPRequest.delete({
    where: { id },
  });
}

export async function updateGitPOAPRequestStatus(
  gitPOAPRequestId: number,
  adminApprovalStatus: AdminApprovalStatus,
) {
  return await context.prisma.gitPOAPRequest.update({
    where: { id: gitPOAPRequestId },
    data: { adminApprovalStatus },
  });
}
