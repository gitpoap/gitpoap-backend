FROM redis

COPY redis.conf /usr/local/etc/redis/redis.conf

ARG REDIS_USER
RUN sed -i "s/REDIS_USER/${REDIS_USER}/g" \
      /usr/local/etc/redis/redis.conf

ARG REDIS_PASSWORD
RUN sed -i "s/REDIS_PASSWORD/${REDIS_PASSWORD}/g" \
      /usr/local/etc/redis/redis.conf

CMD [ "redis-server", "/usr/local/etc/redis/redis.conf"]
