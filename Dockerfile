FROM node:18-alpine

ARG ROOT_DIR=/pokt-reward-calculator

RUN mkdir  $ROOT_DIR
ADD . $ROOT_DIR/
WORKDIR $ROOT_DIR

RUN npm install
RUN npm run build

ENV NODE_ENV="production"
RUN npm prune --omit=dev

ENV PRC_PORT="3300"
ENV PRC_POCKET_ENDPOINT=""
ENV PRC_REQUEST_TIMEOUT=""
ENV PRC_RETRY_REQUEST_TIMEOUT=""
ENV PRC_STATE_CACHE_LENGTH=""
ENV PRC_USE_STATE_CACHE=""
ENV PRC_TX_PER_PAGE=""
ENV PRC_GET_PARAMS_FROM_STATE=""

EXPOSE 3300/tcp

ENTRYPOINT ["/usr/local/bin/node", "./lib/start-servicer-reward-server.js"]
