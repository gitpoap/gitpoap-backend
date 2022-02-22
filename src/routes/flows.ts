import { Router } from "express";

export const flowsRouter = Router();

flowsRouter.post("/add-project", async function (req, res) {
  console.log(req.body);

  return res.status(200).send('ADDED');
});
