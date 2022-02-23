import { Router } from "express";
import fetch from "cross-fetch";
import { context } from "../context";

export const flowsRouter = Router();

flowsRouter.post("/add-project", async function (req, res) {

  if (!req.body?.organization) {
    return res.status(400).send({
      message:
        "The request must specify a GitHub organization" +
        " within the 'organization' key"
    });
  }
  if (!req.body?.repository) {
    return res.status(400).send({
      message:
        "The request must specify a GitHub repository" +
        " within the 'repository' key"
    });
  }

  console.log(`Received request to add ${req.body.organization}/${req.body.repository}`);

  try {
    const gitRes = await fetch(`https://api.github.com/repos/${req.body.organization}/${req.body.repository}`)

    if (gitRes.status >= 400) {
      return res.status(gitRes.status).send({
        message: "Failed to lookup repository on GitHub",
        error: gitRes.body
      });
    }

    const repoInfo = await gitRes.json();

    console.log(`Adding Org with githubId: ${repoInfo.owner.id} and name: ${repoInfo.owner.login}`);

    const org = await context.prisma.organization.upsert({
      where: {
        githubOrgId: repoInfo.owner.id
      },
      update: {},
      create: {
        githubOrgId: repoInfo.owner.id,
        name: repoInfo.owner.login
      }
    });

    const repo = await context.prisma.repo.findUnique({
      where: {
        githubRepoId: repoInfo.id
      }
    });

    if (repo) {
      return res.status(200).send('ALREADY EXISTS');
    }

    console.log(`Creating Repo with githubId: ${repoInfo.id} and name: ${repoInfo.name}`);

    await context.prisma.repo.create({
      data: {
        githubRepoId: repoInfo.id,
        name: repoInfo.name,
        organizationId: org.id
      }
    });

    return res.status(201).send('CREATED');
  } catch (err) {
    console.log(err);

    return res.status(500).send({
      message: "Something went wrong!",
      error: err
    });
  }
});
