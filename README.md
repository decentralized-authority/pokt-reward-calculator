# pokt-reward-calculator
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

### Try it ou!

```ts
import { ServiceRewardCalculator } from '[path-to-pokt-reward-calculator]/lib';

(async function() {

  const rewardCalculator = new ServicerRewardCalculator({
    pocketEndpoint: 'https://myexamplepocketendpoint.com:12345', // Pocket RPC endpoint
    requestTimeout: 20000,       // Optional: Individual HTTP request timeout. default: 20000
    retryRequestTimeout: 20000,  // Optional: Timeout for retry requests after a failed request. default: 20000
    multiRequestCount: 3,        // Optional: Number of requests to make in case of bad responses. default: 3
    stateCacheLength: 10,        // Optional: Number of blocks to cache state for. default: 10
    useStateCache: true,         // Optional: Whether or not to use the state cache. default: true 
    txPerPage: 10,               // Optional: Number of transactions to request per page. default: 10
  });
  
  const address = '4828816c3eb20a189aefac9f9bb2f46d6adda82b'; // A Pocket Servicer Address

  // Get the latest block height
  const blockHeight = await rewardCalculator.queryHeight();
 
  // Get all sessions the node took part in over the last 100 blocks
  const sessions = await rewardCalculator.getSessionsByHeight(address, blockHeight - 100);
  
  // Get reward informaiton for a single session
  const reward = await rewardCalculator.getRewardsFromSession(sessions[0]);

  // Get reward data for an array of sessions
  const rewards = await rewardCalculator.getRewardsFromSessions(sessions);
  
  for(const rewardData of rewards) {
      console.log(`${reward.account} earned ${rewardData.reward} ${rewardData.denom} for ${rewardData.relays} relays in an ${rewardData.chain} session starting at block ${rewardData.sessionHeight}.`);
  }

})();
```

## Contributions
Contributions are welcome! If you have any issues and/or contributions you would like to make, feel free to file an issue and/or issue a pull request.

## License
Apache License Version 2.0

Copyright (c) 2023 by Ryan Burgett.
