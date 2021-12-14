import { Router } from "express";
import { sign } from "jsonwebtoken";
import bodyParser from "body-parser";
import {
  GH_APP_CLIENT_ID,
  GH_APP_CLIENT_SECRET,
  GH_APP_REDIRECT_URL,
} from "../constants";
import fetch from "cross-fetch";

export const githubRouter = Router();

githubRouter.post("/", async function (req, res) {
  const { code } = req.body;

  console.log("GitHub code: ", code);
  let access_token = null;

  // Request to GitHub -> exchange code (from request body) for a GitHub access token
  try {
    const body = {
      client_id: GH_APP_CLIENT_ID,
      client_secret: GH_APP_CLIENT_SECRET,
      code,
      redirect_uri: GH_APP_REDIRECT_URL,
    };

    const tokenRes = await fetch(
      `https://github.com/login/oauth/access_token`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const tokenJson = await tokenRes.json();
    console.log("Token JSON: ", tokenJson);
    if (tokenJson?.error) {
      /* don't use JSON.stringify long term here */
      throw JSON.stringify(tokenJson);
    }

    // const tokenText = await tokenRes.text();
    // console.log("Token Text: ", tokenText);
    // let params = new URLSearchParams(tokenText);
    access_token = tokenJson.access_token;
    console.log("Access token: ", tokenJson.access_token);
  } catch (error) {
    console.error("An error has occurred", error);
    return res.status(400).send({
      message: "A server error has occurred - GitHub access token exchange",
      error: JSON.parse(error as string),
    });
  }

  try {
    // Request to return data of a user that has been authenticated
    const userRes = await fetch(`https://api.github.com/user`, {
      headers: {
        Authorization: `token ${access_token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const userData = await userRes.json();

    return res.status(200).json(userData);
    // return res.status(200).json({});
  } catch (err) {
    console.error("An error has occurred - github user data fetch", err);
    return res.status(400).send({ message: "A server error has occurred" });
  }
});
