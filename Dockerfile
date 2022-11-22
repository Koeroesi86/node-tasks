FROM node:18-alpine

COPY . /data
WORKDIR /data

LABEL org.opencontainers.image.authors="koeroesi86@gmail.com"

RUN yarn install && yarn build && yarn install --prod && yarn cache clean

CMD ["yarn", "crontab-ui"]
