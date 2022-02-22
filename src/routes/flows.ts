import { Router } from "express";
import fetch from "cross-fetch";

export const flowsRouter = Router();

flowsRouter.post("/add-project", async function (req, res) {
  console.log(req.body);

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

  try {
    const gitRes = await fetch(`https://api.github.com/repos/${req.body.organization}/${req.body.repository}`)

    if (gitRes.status >= 400) {
      return res.status(gitRes.status).send({
        message: "Failed to lookup repository on GitHub",
        error: gitRes.body
      });
    }

    const repoInfo = await gitRes.json();

    console.log(`Got Response: ${JSON.stringify(repoInfo)}`);

    return res.status(200).send('ADDED');
  } catch (err) {
    return res.status(500).send({
      message: "Something went wrong!",
      error: err
    });
  }
});
