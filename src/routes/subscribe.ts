import { Router } from 'express';
import { addListMember } from '../external/mailchimp';
import { jwtMiddleware } from '../middleware/auth';
import { getRequestLogger } from '../middleware/loggingAndTiming';

export const subscribeRouter = Router();

subscribeRouter.post('/', jwtMiddleware, async function (req, res) {
  const logger = getRequestLogger(req);

  if (!req.user) {
    return res.sendStatus(401);
  } else {
    logger.info(`Request to subscribe ${req.body.email}`);
    const listId = 'cc7ac358ee';
    const mailChimpResponse = await addListMember(req.body.email, listId);

    if (mailChimpResponse === null) {
      const message = `Failed to add email ${req.body.email} to MailChimp list ${listId}`;
      logger.warn(message);
      return res.status(400).send({ msg: message });
    }

    logger.debug(`Completed request to subscribe ${req.body.email}`);
    res.sendStatus(200);
  }
});
