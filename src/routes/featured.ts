import { Router } from 'express';
import { AddFeaturedSchema, RemoveFeaturedSchema } from '../schemas/featured';

export const featuredRouter = Router();

featuredRouter.post('/', async function (req, res) {
  const schemaResult = AddFeaturedSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }
});

featuredRouter.delete('/:id', async function (req, res) {
  const schemaResult = RemoveFeaturedSchema.safeParse(req.body);

  if (!schemaResult.success) {
    return res.status(400).send({ issues: schemaResult.error.issues });
  }
});
