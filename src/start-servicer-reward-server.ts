import { ServicerRewardServer, ServicerRewardServerParams } from './servicer-reward-server';

const {
  PRC_PORT,
  PRC_POCKET_ENDPOINT,
  PRC_REQUEST_TIMEOUT,
  PRC_RETRY_REQUEST_TIMEOUT,
  PRC_STATE_CACHE_LENGTH,
  PRC_USE_STATE_CACHE,
  PRC_TX_PER_PAGE,
  PRC_GET_PARAMS_FROM_STATE,
} = process.env;

const serverParams: ServicerRewardServerParams = {};
if(PRC_PORT)
  serverParams.port = parseInt(PRC_PORT);
if(PRC_POCKET_ENDPOINT)
  serverParams.pocketEndpoint = PRC_POCKET_ENDPOINT;
if(PRC_REQUEST_TIMEOUT)
  serverParams.requestTimeout = parseInt(PRC_REQUEST_TIMEOUT);
if(PRC_RETRY_REQUEST_TIMEOUT)
  serverParams.retryRequestTimeout = parseInt(PRC_RETRY_REQUEST_TIMEOUT);
if(PRC_STATE_CACHE_LENGTH)
  serverParams.stateCacheLength = parseInt(PRC_STATE_CACHE_LENGTH);
if(PRC_USE_STATE_CACHE)
  serverParams.useStateCache = PRC_USE_STATE_CACHE === 'true';
if(PRC_TX_PER_PAGE)
  serverParams.txPerPage = parseInt(PRC_TX_PER_PAGE);
if(PRC_GET_PARAMS_FROM_STATE)
  serverParams.getParamsFromState = PRC_GET_PARAMS_FROM_STATE === 'true';

const server = new ServicerRewardServer(serverParams);
server.start()
  .catch(console.error);
