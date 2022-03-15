import { CreateGitPOAPSchema } from '../schemas/gitpoaps';
import { Router } from 'express';
import { context } from '../context';
import { v4 } from 'uuid';
import { createPOAPEvent } from '../external/poap';

export const gitpoapsRouter = Router();

// TODO: who should have access to this?
gitpoapsRouter.post('/', async function (req, res) {
  const schemaResult = CreateGitPOAPSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }

  console.log(`Received request to create a new GitPOAP: ${req.body.name}`);

  // Lookup the stored info about the repo provided
  const repo = await context.prisma.repo.findUnique({
    where: {
      id: req.body.githubRepoId,
    },
    include: {
      organization: true,
    },
  });

  if (!repo) {
    return res.status(404).send({
      message: `There is no repo with id: ${req.body.githubRepoId}`,
    });
  }

  // Create a secret code that will be used to modify the event
  // and allow minting of POAPs
  const secretCode = v4();

  // Call the POAP API to create the event
  const poapInfo = await createPOAPEvent(
    req.body.name,
    req.body.description,
    req.body.startDate,
    req.body.endDate,
    req.body.expiryDate,
    req.body.year,
    req.body.eventUrl,
    req.body.image,
    secretCode,
    req.body.email,
    req.body.requestedCodes,
  );

  console.log(`Created GitPOAP: ${JSON.stringify(poapInfo)}`);

  await context.prisma.gitPOAP.create({
    data: {
      year: poapInfo.year,
      poapEventId: poapInfo.id,
      repo: {
        connect: {
          id: repo.id,
        },
      },
      poapSecret: secretCode,
    },
  });

  return res.status(201).send('CREATED');
});
