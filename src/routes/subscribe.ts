import { Router } from 'express';
import jwt from 'express-jwt';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import { addListMember } from '../external/mailchimp';

export const subscribeRouter = Router();

subscribeRouter.post(
  '/',
  jwt({ secret: JWT_SECRET as string, algorithms: ['HS256'] }),
  async function (req, res) {
    const logger = createScopedLogger('POST /subscribe');
    logger.debug(`Body: ${JSON.stringify(req.body)}`);
    const endTimer = httpRequestDurationSeconds.startTimer('POST', '/subscribe');

    if (!req.user) {
      endTimer({ status: 401 });
      return res.sendStatus(401);
    } else {
      logger.info(`Request to subscribe ${req.body.email}`);
      const listId = 'cc7ac358ee';
      const mailChimpResponse = await addListMember(req.body.email, listId);

      if (mailChimpResponse === null) {
        const message = `Failed to add email ${req.body.email} to MailChimp list ${listId}`;
        logger.warn(message);
        endTimer({ status: 400 });
        return res.status(400).send({ msg: message });
      }

      logger.debug(`Completed request to subscribe ${req.body.email}`);
      endTimer({ status: 200 });
      res.sendStatus(200);
    }
  },
);
