FROM node:18-alpine

ENV CRON_PATH /etc/crontabs
ENV CRON_IN_DOCKER true
ENV PORT 3000
ENV TZ Europe/London

RUN mkdir /data; touch $CRON_PATH/root; chmod +x $CRON_PATH/root; apk add --no-cache wget curl supervisor tini tzdata
LABEL org.opencontainers.image.authors="koeroesi86@gmail.com"

COPY . /data
WORKDIR /data

RUN yarn install && \
    yarn build && \
    yarn install --prod && \
    yarn cache clean

ENTRYPOINT ["/sbin/tini", "--"]

EXPOSE $PORT

CMD ["supervisord", "-c", "/data/supervisord.conf"]
