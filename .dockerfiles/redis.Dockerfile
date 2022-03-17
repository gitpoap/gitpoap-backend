FROM redis

COPY redis.conf /usr/local/etc/redis/redis.conf

ARG GITPOAP_REDIS_USER
RUN sed -i "s/GITPOAP_REDIS_USER/${GITPOAP_REDIS_USER}/g" \
      /usr/local/etc/redis/redis.conf

ARG GITPOAP_REDIS_PASSWORD
RUN sed -i "s/GITPOAP_REDIS_PASSWORD/${GITPOAP_REDIS_PASSWORD}/g" \
      /usr/local/etc/redis/redis.conf

CMD [ "redis-server", "/usr/local/etc/redis/redis.conf"]
