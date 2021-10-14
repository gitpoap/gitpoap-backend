import { Router } from "express";
import jwt from "express-jwt";

var router = Router();

router.post('/', jwt({ secret: process.env.JWT_SECRET as string, algorithms: ['HS256'] }),
  function(req, res) {
    if (!req.user) {
      // Not authenticated

      return res.sendStatus(401);
    } else {
      // Authenticated

      console.log(req.user);
      console.log(req.body.email);
  
      res.sendStatus(200);
    }
  });

export default router;
