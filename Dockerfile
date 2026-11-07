FROM node:25-alpine

ENV CRON_PATH /etc/crontabs
ENV CRON_IN_DOCKER true
ENV PORT 3000
ENV TZ Europe/London

RUN mkdir /data; touch $CRON_PATH/root; chmod +x $CRON_PATH/root; apk add --no-cache wget curl supervisor tini tzdata
LABEL org.opencontainers.image.authors="koeroesi86@gmail.com"

COPY . /data
WORKDIR /data

RUN npm ci && \
    npm run build && \
    npm prune --omit=dev && \
    npm cache clean --force

ENTRYPOINT ["/sbin/tini", "--"]

EXPOSE $PORT

CMD ["supervisord", "-c", "/data/supervisord.conf"]
