FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8 AS build

RUN mkdir -p /data && chown node:node /data
COPY --chown=node:node . /data
WORKDIR /data
USER node

RUN npm ci --ignore-scripts && \
    npm run build && \
    npm prune --omit=dev && \
    npm cache clean --force

FROM node:24-alpine@sha256:a34ab6d7f6f4813f4d0c5469d74685604b962fbdbf5793a7bc7b4998ecb867c8

ENV PORT 3000
ENV TZ Europe/London

LABEL org.opencontainers.image.authors="koeroesi86@gmail.com"

# npm is only needed to build, so it is removed from the runtime image (its
# bundled dependencies otherwise show up in vulnerability scans).
# The base image ships an unprivileged `node` user (uid 1000). The crontab and
# crontab-ui DB directories must be writable by it, because crontab-ui installs
# the schedule with `crontab`, and crond runs as the same user.
RUN apk add --no-cache wget curl supervisor tini tzdata && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx && \
    mkdir -p /data /var/lib/crontab-ui /etc/crontabs && \
    chown node:node /data /var/lib/crontab-ui /etc/crontabs

WORKDIR /data
COPY --from=build --chown=node:node /data /data
USER node

ENTRYPOINT ["/sbin/tini", "--"]

EXPOSE $PORT

CMD ["supervisord", "-c", "/data/supervisord.conf"]
