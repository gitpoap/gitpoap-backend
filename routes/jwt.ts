import { Router } from "express";
import { sign } from "jsonwebtoken";

const JWT_EXP_TIME = 60 * 10;

var router = Router();

router.post('/', function (req, res) {
  const token = sign({}, process.env.JWT_SECRET as string, { expiresIn: JWT_EXP_TIME });

  console.log(token);

  res.send(token);
})

export default router;
