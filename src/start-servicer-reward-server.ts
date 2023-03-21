import { ServicerRewardServer, ServicerRewardServerParams } from './servicer-reward-server';

const {
  PORT,
  POCKET_ENDPOINT,
  REQUEST_TIMEOUT,
  RETRY_REQUEST_TIMEOUT,
  STATE_CACHE_LENGTH,
  USE_STATE_CACHE,
  TX_PER_PAGE,
} = process.env;

const serverParams: ServicerRewardServerParams = {};
if(PORT)
  serverParams.port = parseInt(PORT);
if(POCKET_ENDPOINT)
  serverParams.pocketEndpoint = POCKET_ENDPOINT;
if(REQUEST_TIMEOUT)
  serverParams.requestTimeout = parseInt(REQUEST_TIMEOUT);
if(RETRY_REQUEST_TIMEOUT)
  serverParams.retryRequestTimeout = parseInt(RETRY_REQUEST_TIMEOUT);
if(STATE_CACHE_LENGTH)
  serverParams.stateCacheLength = parseInt(STATE_CACHE_LENGTH);
if(USE_STATE_CACHE)
  serverParams.useStateCache = USE_STATE_CACHE === 'true';
if(TX_PER_PAGE)
  serverParams.txPerPage = parseInt(TX_PER_PAGE);

const server = new ServicerRewardServer(serverParams);
server.start()
  .catch(console.error);
