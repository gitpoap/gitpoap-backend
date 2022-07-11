import { Router } from 'express';
import jwt from 'express-jwt';
import { JWT_SECRET } from '../environment';
import { createScopedLogger } from '../logging';
import { httpRequestDurationSeconds } from '../metrics';
import mailChimpClient from '@mailchimp/mailchimp_marketing';

mailChimpClient.setConfig({
  apiKey: 'e926f32160593e7dc66f7f632b03113d-us14',
  server: 'us14',
});

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

      try {
        /* Directly add email address to mailchimp list */
        await mailChimpClient.lists.addListMember('cc7ac358ee', {
          email_address: req.body.email,
          status: 'subscribed',
        });
      } catch (err: any) {
        /* On error, just log */
        logger.error(err);
        endTimer({ status: 200 });

        return res.sendStatus(200);
      }

      logger.debug(`Completed request to subscribe ${req.body.email}`);

      endTimer({ status: 200 });

      res.sendStatus(200);
    }
  },
);
