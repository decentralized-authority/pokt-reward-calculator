# POKT Reward Calculator
Module written in TypeScript for easily calculating Pocket Servicer Node rewards post PIP-22.

## Getting Started

### Clone the repository
```bash
$ git clone https://github.com/decentralized-authority/pokt-reward-calculator.git
$ cd pokt-reward-calculator
```

### Build the library
```bash
$ pnpm install
$ pnpm run build
```

## Using the library directly:
```ts
import { ServiceRewardCalculator } from '[path-to-pokt-reward-calculator]/lib';

(async function() {

  const rewardCalculator = new ServicerRewardCalculator({
    pocketEndpoint: 'https://myexamplepocketendpoint.com:12345', // Optional: Pocket RPC endpoint (required for methods that make Pocket RPC calls)
    requestTimeout: 20000,       // Optional: Individual HTTP request timeout. default: 20000
    retryRequestTimeout: 20000,  // Optional: Timeout for retry requests after a failed request. default: 20000
    multiRequestCount: 3,        // Optional: Number of requests to make in case of bad responses. default: 3
    stateCacheLength: 10,        // Optional: Number of blocks to cache state for. default: 10
    useStateCache: true,         // Optional: Whether or not to use the state cache. default: true 
    txPerPage: 10,               // Optional: Number of transactions to request per page. default: 10
    
    getParamsFromState: true,    // Optional: Whether or not to get the session parameters from /v1/query/state. default: true
    // NOTE: Getting params from state rather than /v1/query/allParams is more accurate but takes significantly longer

  });

  /***************************************************************
   * Calculate rewards by providing values directly              *
   ***************************************************************/

  const params = {
    dao_allocation: '10',
    proposer_allocation: '5',
    relays_to_tokens_multiplier: '562',
    servicer_stake_floor_multipler: '15000000000',
    servicer_stake_floor_multiplier_exponent: '1',
    servicer_stake_weight_ceiling: '60000000000',
    servicer_stake_weight_multipler: '2.585',
  };
  const relayCount = 12345;
  const staked = '60010000000'; // in upokt
  const reward = await rewardCalculator.calculateReward(relayCount, staked, params);
  
  /***************************************************************
   * Methods that require a Pocket RPC endpoint                  *
   ***************************************************************/

    // A Pocket Servicer Address
  const address = '4828816c3eb20a189aefac9f9bb2f46d6adda82b';

  // Get the latest block height
  const blockHeight = await rewardCalculator.queryHeight();
 
  // Get all sessions the node took part in over the last 100 blocks
  const sessions = await rewardCalculator.getSessionsByHeight(address, blockHeight - 100);
  
  // Get all sessions with rewards that the node took part in over the last 100 blocks
  const rewards = await rewardCalculator.getSessionsRewardsFromHeight(address, blockHeight - 100);

  for(const rewardData of rewards) {
      console.log(`${reward.account} earned ${rewardData.reward} ${rewardData.denom} for ${rewardData.relays} relays in an ${rewardData.chain} session starting at block ${rewardData.sessionHeight}.`);
  }

})();
```

## Using the server:
```ts
import { ServiceRewardServer } from '[path-to-pokt-reward-calculator]/lib';
import request from 'superagent'; // using superagent as an example

(async function() {
    
  const port = 3300;

  const rewardsServer = new ServicerRewardServer({
    port, // Optional: Port to run the server on. default: 3300
    pocketEndpoint: 'https://myexamplepocketendpoint.com:12345',
    stateCacheLength: 100,
    useStateCache: true,
    getParamsFromState: false,
  });
  await rewardsServer.start();

  const address = '4828816c3eb20a189aefac9f9bb2f46d6adda82b'; // A Pocket Servicer Address

  
  // Get the latest block height
  const { body: blockHeightRes } = await request()
    .post(`http://localhost:${port}`)
    .type('application/json')
    .send({
      jsonrpc: '2.0',
      id: 1,
      method: 'queryHeight', // method corresponds directly to the method name in the library
      params: [], // params are passed directly into the method
    })
    .timeout(30000);
  if(blockHeightRes.error)
    throw new Error(blockHeightRes.error.message);
  const blockHeight = blockHeightRes.result;

  
  // Get all session with rewards that the node took part in over the last 100 blocks
  const { body: rewardsRes } = await request()
    .post(`http://localhost:${port}`)
    .type('application/json')
    .send({
      jsonrpc: '2.0',
      id: 1,
      method: 'getSessionsRewardsFromHeight',
      params: [address, blockHeight - 100], // the same as calling rewardCalculator.getSessionsFromHeight(address, blockHeight - 100)
    })
    .timeout(30000);
  if(rewardsRes.error)
    throw new Error(rewardsRes.error.message);
  const rewards = rewardsRes.result;
  
  for(const rewardData of rewards) {
    console.log(`${reward.account} earned ${rewardData.reward} ${rewardData.denom} for ${rewardData.relays} relays in an ${rewardData.chain} session starting at block ${rewardData.sessionHeight}.`);
  }

})();
```

## Using Docker:
Server parameters can be entered as environment variables and correspond directly to the ServicerRewardServerParams interface. The following environment variables are available:
* `PRC_PORT`
* `PRC_POCKET_ENDPOINT`
* `PRC_REQUEST_TIMEOUT`
* `PRC_RETRY_REQUEST_TIMEOUT`
* `PRC_STATE_CACHE_LENGTH`
* `PRC_USE_STATE_CACHE`
* `PRC_TX_PER_PAGE`
* `PRC_GET_PARAMS_FROM_STATE`

```bash
$ docker run -d --restart=always \
 -p 3300:3300/tcp --name pokt-reward-server \
 --env PRC_PORT=3300 \
 --env PRC_POCKET_ENDPOINT=https://myexamplepocketendpoint.com:12345 \
 --env PRC_STATE_CACHE_LENGTH=100 \
 --env PRC_USE_STATE_CACHE=true \
 --env PRC_GET_PARAMS_FROM_STATE=false \
 decentralizedauthority/pokt-reward-calculator:0.2.0
```

## Contributions
Contributions are welcome! If you have any issues and/or contributions you would like to make, feel free to file an issue and/or issue a pull request.

## License
Apache License Version 2.0

Copyright (c) 2023 by Ryan Burgett.
