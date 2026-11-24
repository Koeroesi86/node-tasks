FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build

RUN mkdir -p /data && chown node:node /data
COPY --chown=node:node . /data
WORKDIR /data
USER node

RUN npm ci --ignore-scripts && \
    npm run build && \
    npm prune --omit=dev && \
    npm cache clean --force

FROM node:24-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5

ENV PORT 3000
ENV CRON_PATH /etc/crontabs
ENV TZ Europe/London

# uid/gid of the unprivileged user that runs the tasks. Match the owner of the
# mounted ssh directory and backup location (see README). Changed at build time
# because the container never runs as root, so it cannot switch users itself.
ARG PUID=1000
ARG PGID=1000

LABEL org.opencontainers.image.authors="koeroesi86@gmail.com"

# npm is only needed to build, so it is removed from the runtime image (its
# bundled dependencies otherwise show up in vulnerability scans).
# The base image ships an unprivileged `node` user, recreated above with the
# requested uid/gid. BusyBox crond and
# crontab need root, so supercronic runs the schedule instead and a small
# `crontab` shim lets crontab-ui save to the file supercronic watches.
RUN deluser node && (delgroup node || true) && \
    addgroup -g "${PGID}" node && \
    adduser -D -u "${PUID}" -G node -h /home/node -s /bin/sh node && \
    apk add --no-cache wget curl supervisor supercronic tini tzdata openssh-client && \
    rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx && \
    mkdir -p /data /backups /var/lib/crontab-ui /etc/crontabs && \
    echo '# managed by crontab-ui' > /etc/crontabs/crontab && \
    chown -R node:node /data /backups /var/lib/crontab-ui /etc/crontabs

COPY --chmod=755 docker/crontab /usr/local/bin/crontab

WORKDIR /data
COPY --from=build --chown=node:node /data /data
USER node

ENTRYPOINT ["/sbin/tini", "--"]

EXPOSE $PORT

CMD ["supervisord", "-c", "/data/supervisord.conf"]
