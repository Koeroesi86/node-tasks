FROM node:18-alpine

ENV CRON_PATH /etc/crontabs
RUN mkdir /data; touch $CRON_PATH/root; chmod +x $CRON_PATH/root

COPY . /data
WORKDIR /data

LABEL org.opencontainers.image.authors="koeroesi86@gmail.com"

RUN apk add --no-cache wget curl supervisor tini tzdata && \
    yarn install && yarn build && \
    yarn install --prod && \
    yarn cache clean

ENTRYPOINT ["/sbin/tini", "--"]

ENV CRON_IN_DOCKER true

EXPOSE $PORT

CMD ["supervisord", "-c", "/data/supervisord.conf"]
