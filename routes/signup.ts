import { Router } from "express";
import jwt from "express-jwt";

var router = Router();

router.post('/', jwt({ secret: process.env.JWT_SECRET as string, algorithms: ['HS256'] }),
  function(req, res) {
    if (!req.user) {
      // Not authenticated

      console.log("Signup requested from unauthenticated user.");

      return res.sendStatus(401);
    } else {
      // Authenticated
      console.log("Signing up user with email: " + req.body.email);

      //do the stuff
  
      res.sendStatus(200);
    }
  });

export default router;
