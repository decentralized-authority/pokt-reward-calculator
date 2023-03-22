import request from 'superagent';
import isError from 'lodash/isError';
import isBoolean from 'lodash/isBoolean';
import * as math from 'mathjs';
import { PocketNode, RewardData, RewardDataCondensed, RewardParams, SessionData } from './interfaces';
import { txType } from './constants';

export interface ServicerRewardCalculatorParams {
  pocketEndpoint?: string
  requestTimeout?: number
  retryRequestTimeout?: number
  multiRequestCount?: number
  stateCacheLength?: number
  useStateCache?: boolean
  txPerPage?: number
  getParamsFromState?: boolean
}
export class ServicerRewardCalculator {

  _pocketEndpoint = '';
  _requestTimeout = 20000;
  _retryRequestTimeout = 20000;
  _multiRequestCount = 3;
  _txPerPage = 10;
  _stateCacheLength = 10;
  _useStateCache = true;
  _stateCache: [number, any][] = [];
  _paramsCache: [number, RewardParams][] = [];
  _getParamsFromState = true;

  constructor(params: ServicerRewardCalculatorParams = {}) {
    this._pocketEndpoint = params.pocketEndpoint || this._pocketEndpoint;
    this._requestTimeout = params.requestTimeout || this._requestTimeout;
    this._retryRequestTimeout = params.retryRequestTimeout || this._retryRequestTimeout;
    this._multiRequestCount = params.multiRequestCount || this._multiRequestCount;
    this._stateCacheLength = params.stateCacheLength || this._stateCacheLength;
    this._useStateCache = isBoolean(params.useStateCache) ? params.useStateCache : this._useStateCache;
    this._txPerPage = params.txPerPage || this._txPerPage;
    this._getParamsFromState = isBoolean(params.getParamsFromState) ? params.getParamsFromState : this._getParamsFromState;
  }

  private async _makeRequest(method: string, endpoint: string, body: any = undefined, timeout = this._requestTimeout): Promise<any> {
    let res: request.Response;
    try {
      if(body) {
        res = await request(method, endpoint)
          .send(body)
          .timeout(timeout);
      } else {
        res = await request(method, endpoint)
          .timeout(timeout);
      }
      return res.body;
    } catch(err: any) {
      return err;
    }
  }

  private async _makeMultiRequest(count: number, method: string, endpoint: string, body: any = undefined, timeout = this._requestTimeout): Promise<any> {
    const resArr = await Promise.all(Array(count)
      .fill(0)
      .map(() => this._makeRequest(method, endpoint, body, timeout)));
    const { responses, errorResponses }: {responses: any[], errorResponses: Error[]} = resArr.reduce((obj, res) => {
      if(isError(res)) {
        return {
          ...obj,
          errorResponses: [...obj.errorResponses, res],
        };
      } else {
        return {
          ...obj,
          responses: [...obj.responses, res],
        };
      }
    }, {responses: [], errorResponses: []});
    const responseCounts: {[key: string]: number} = {};
    for(const response of responses) {
      try {
        const encoded = JSON.stringify(response);
        const prevCount = responseCounts[encoded] || 0;
        responseCounts[encoded] = prevCount + 1;
      } catch(err) {
        // ignore error
      }
    }
    const sortedResponseCounts = Object.entries(responseCounts)
      .sort((a, b) => b[1] - a[1]);
    if(sortedResponseCounts.length > 0) {
      return JSON.parse(sortedResponseCounts[0][0]);
    } else if(errorResponses.length > 0) {
      return errorResponses[0];
    } else {
      return new Error('No valid responses');
    }
  }

  private async _makeRetryRequest(count: number, method: string, endpoint: string, body: any = undefined, retryTimeout = this._retryRequestTimeout): Promise<any> {
    for(let i = 0; i < count; i++) {
      const res = await this._makeRequest(method, endpoint, body, retryTimeout);
      if(!isError(res)) {
        return res;
      } else if(i === count - 1) {
        return res;
      }
    }
  }

  private _checkPocketEndpoint(): void {
    if(!this._pocketEndpoint)
      throw new Error('Pocket endpoint not set');
  }

  async queryHeight(timeout = this._requestTimeout): Promise<number> {
    this._checkPocketEndpoint();
    const res = await this._makeMultiRequest(
      this._multiRequestCount,
      'POST',
      `${this._pocketEndpoint}/v1/query/height`,
      undefined,
      timeout,
    );
    if(isError(res))
      throw res;
    else if(res.error)
      throw new Error(res.error.message);
    return res.height;
  }

  async queryNode(address: string, height = 0, timeout = this._requestTimeout): Promise<PocketNode> {
    this._checkPocketEndpoint();
    const res = await this._makeMultiRequest(
      this._multiRequestCount,
      'POST',
      `${this._pocketEndpoint}/v1/query/node`,
      {
        address,
        height,
      },
      timeout,
    );
    if(isError(res))
      throw res;
    else if(res.error)
      throw new Error(res.error.message);
    return res;
  }

  async queryState(height: number, retryTimeout = this._retryRequestTimeout): Promise<any> {
    this._checkPocketEndpoint();
    if(this._useStateCache) {
      const cachedState = this._stateCache.find((s) => s[0] === height);
      if(cachedState)
        return cachedState[1];
    }
    for(let i = 0; i < this._multiRequestCount; i++) {
      try {
        const res = await this._makeRequest(
          'POST',
          `${this._pocketEndpoint}/v1/query/state`,
          {
            height,
          },
          retryTimeout,
        );
        if(res.app_state) {
          if(this._useStateCache)
            this._stateCache = [
              [height, res.app_state],
              ...this._stateCache.slice(0, this._stateCacheLength - 1),
            ];
          return res.app_state;
        } else if(i === this._multiRequestCount - 1 && res.error) {
          throw new Error(res.error.message);
        }
      } catch(err) {
        if(i === this._multiRequestCount - 1)
          throw err;
      }
    }
  }

  async queryAccountTxsByHeight(address: string, startingHeight: number, retryTimeout = this._retryRequestTimeout): Promise<any> {
    this._checkPocketEndpoint();
    const filtered: any[] = [];
    let totalPages = 1;
    let totalPagesSet = false;
    for(let page = 1; page < totalPages + 1; page++) {
      for(let i = 0; i < this._multiRequestCount; i++) {
        try {
          const res = await this._makeRequest(
            'POST',
            `${this._pocketEndpoint}/v1/query/accounttxs`,
            {
              address,
              page,
              per_page: this._txPerPage,
              received: false,
              prove: false,
              order: 'asc',
            },
            retryTimeout,
          );
          if (i === this._multiRequestCount - 1 && res.error) {
            throw new Error(res.error.message);
          } else if(res.txs) {
            const txs = res.txs
            if(!totalPagesSet) {
              totalPages = Math.ceil(res.total_txs / res.page_count);
              totalPagesSet = true;
            }
            for(let ii = 0; ii < txs.length; ii++) {
              const tx = txs[ii];
              if(tx.height >= startingHeight) {
                filtered.push(tx);
              } else if(tx.height < startingHeight) {
                return filtered
              }
            }
          }
        } catch(err) {
          if(i === this._multiRequestCount - 1)
            throw err;
        }
      }
    }
    return filtered
  }

  async getSessionsByHeight(address: string, startingHeight: number, retryTimeout = this._retryRequestTimeout): Promise<SessionData[]> {
    this._checkPocketEndpoint();
    const txs = await this.queryAccountTxsByHeight(address, startingHeight - 6, retryTimeout);
    const filtered = txs
      .filter((tx: any) => {
        const type = tx?.stdTx?.msg?.type;
        const resultCode =  tx?.tx_result?.code;
        if(type === txType.PROOF && resultCode === 0) {
          return true;
        } else if(type === txType.CLAIM && resultCode === 0) {
          return true;
        }
        return false;
      });
    const pairs: SessionData[] = [];
    for(const tx of filtered) {
      const type = tx.stdTx.msg.type;
      let sessionHeight: number;
      let blockchain: string;
      if(type === txType.PROOF) {
        sessionHeight = parseInt(tx.stdTx.msg.value.leaf.value.session_block_height);
        blockchain = tx.stdTx.msg.value.leaf.value.blockchain;
      } else if(type === txType.CLAIM) {
        sessionHeight = parseInt(tx.stdTx.msg.value.header.session_height);
        blockchain = tx.stdTx.msg.value.header.chain;
      } else {
        continue;
      }
      const item = pairs.find((pair) => pair.sessionHeight === sessionHeight && pair.chain === blockchain);
      if(item) {
        if(type === txType.PROOF) {
          item.proof = tx;
        } else if(type === txType.CLAIM) {
          item.account = tx.stdTx.msg.value.from_address;
          item.claim = tx;
          item.relays = parseInt(tx.stdTx.msg.value.total_proofs);
        }
      } else {
        if(type === txType.PROOF) {
          pairs.push({
            account: '',
            sessionHeight,
            chain: blockchain,
            relays: 0,
            proof: tx,
            claim: undefined,
          });
        } else if(type === txType.CLAIM) {
          pairs.push({
            account: tx.stdTx.msg.value.from_address,
            sessionHeight,
            chain: blockchain,
            relays: parseInt(tx.stdTx.msg.value.total_proofs),
            proof: undefined,
            claim: tx,
          });
        }
      }
    }
    return pairs
      .filter((pair) => pair.proof && pair.claim)
      .filter((pair) => pair.sessionHeight >= startingHeight);
  }

  getParamsFromState(state: any): RewardParams {
    return  state.pos.params as RewardParams;
  }

  async getParamsFromHeight(height: number, timeout = this._requestTimeout): Promise<RewardParams> {
    this._checkPocketEndpoint();
    if(this._useStateCache) {
      const cachedParams = this._paramsCache.find((p) => p[0] === height);
      if(cachedParams)
        return cachedParams[1];
    }
    const res = await this._makeMultiRequest(
      this._multiRequestCount,
      'POST',
      `${this._pocketEndpoint}/v1/query/allParams`,
      {
        height,
      },
      timeout,
    );
    if(isError(res))
      throw res;
    else if(res.error)
      throw new Error(res.error.message);
    const nodeParams: {param_key: string, param_value: any}[] = res.node_params;
    const params = {
      dao_allocation: nodeParams.find((param) => param.param_key === 'pos/DAOAllocation')?.param_value,
      proposer_allocation: nodeParams.find((param) => param.param_key === 'pos/ProposerPercentage')?.param_value,
      relays_to_tokens_multiplier: nodeParams.find((param) => param.param_key === 'pos/RelaysToTokensMultiplier')?.param_value,
      servicer_stake_floor_multipler: nodeParams.find((param) => param.param_key === 'pos/ServicerStakeFloorMultiplier')?.param_value,
      servicer_stake_floor_multiplier_exponent: nodeParams.find((param) => param.param_key === 'pos/ServicerStakeFloorMultiplierExponent')?.param_value,
      servicer_stake_weight_ceiling: nodeParams.find((param) => param.param_key === 'pos/ServicerStakeWeightCeiling')?.param_value,
      servicer_stake_weight_multipler: nodeParams.find((param) => param.param_key === 'pos/ServicerStakeWeightMultiplier')?.param_value,
    };
    if(this._useStateCache)
      this._paramsCache = [
        [height, params],
        ...this._paramsCache.slice(0, this._stateCacheLength - 1),
      ];
    return params;
  }

  async calculateReward(relayCount: number, stakedTokens: string, params: RewardParams): Promise<string> {

    const {
      relays_to_tokens_multiplier,
      servicer_stake_floor_multipler,
      servicer_stake_floor_multiplier_exponent,
      servicer_stake_weight_ceiling,
      servicer_stake_weight_multipler,
      dao_allocation,
      proposer_allocation,
    } = params;
    const stake = math.bignumber(stakedTokens);

    const relaysToTokensMultiplier = math.bignumber(relays_to_tokens_multiplier);
    const servicerStakeFloorMultipler = math.bignumber(servicer_stake_floor_multipler);
    const servicerStakeFloorMultiplierExponent = math.bignumber(servicer_stake_floor_multiplier_exponent);
    const servicerStakeWeightCeiling = math.bignumber(servicer_stake_weight_ceiling);
    const servicerStakeWeightMultipler = math.bignumber(servicer_stake_weight_multipler);
    const daoAllocation = math.bignumber(dao_allocation);
    const proposerAllocation = math.bignumber(proposer_allocation);

    const flooredStake = math.min(
      math.subtract(stake, math.mod(stake, servicerStakeFloorMultipler)),
      math.subtract(servicerStakeWeightCeiling, math.mod(servicerStakeWeightCeiling, servicerStakeFloorMultipler)),
    );

    const bin = math.divide(flooredStake, servicerStakeFloorMultipler) as math.BigNumber;

    const power = servicerStakeFloorMultiplierExponent;
    const denominator = math.bignumber(100);
    // @ts-ignore
    const b = math.round(math.multiply(power, denominator));
    const r = math.nthRoot(bin, denominator);
    // @ts-ignore
    const preweight = math.pow(r, b);

    const weight = math.divide(preweight, servicerStakeWeightMultipler);

    // @ts-ignore
    const coins = math.floor(math.multiply(math.multiply(relaysToTokensMultiplier, math.bignumber(relayCount)), weight));

    const daoAllocationPercentage = math.divide(daoAllocation, math.bignumber(100));
    const daoAllocationCoins = math.multiply(coins, daoAllocationPercentage);

    const proposerAllocationPercentage = math.divide(proposerAllocation, math.bignumber(100));
    const proposerAllocationCoins = math.multiply(coins, proposerAllocationPercentage);

    // @ts-ignore
    const feesCollected = math.floor(math.add(daoAllocationCoins, proposerAllocationCoins));

    const reward = math.subtract(coins, feesCollected);

    return reward.toString();

  }

  async getRewardsFromSessions(sessions: SessionData[], retryTimeout = this._retryRequestTimeout): Promise<(RewardData|Error)[]> {
    this._checkPocketEndpoint();
    const { _getParamsFromState: getParamsFromState } = this;
    const rewards: (RewardData|Error)[] = [];
    const stateCache: Map<number, any> = new Map();
    const nodeCache: Map<number, {[account: string]: PocketNode}> = new Map();
    const paramsCache: Map<number, RewardParams> = new Map();
    for(const session of sessions) {
      const proofHeight = session.proof.height;
      let params: RewardParams;
      if(getParamsFromState) {
        let state: any;
        let stateError = '';
        try {
          if(stateCache.has(proofHeight)) {
            state = stateCache.get(proofHeight);
          } else {
            state = await this.queryState(proofHeight, retryTimeout);
            stateCache.set(proofHeight, state);
          }
          if(!state)
            stateError = `Unable to get state at height ${proofHeight}`;
        } catch(err: any) {
          stateError = `Error getting state at height ${proofHeight} - ` + err.message;
        }
        if(stateError) {
          rewards.push(new Error(stateError));
          continue;
        }
        params = this.getParamsFromState(state);
      } else {
        params = await this.getParamsFromHeight(proofHeight, retryTimeout);
      }
      let node: PocketNode|null = null;
      let nodeError = '';
      try {
        // @ts-ignore
        if(nodeCache.has(proofHeight) && nodeCache.get(proofHeight)[session.account]) {
          // @ts-ignore
          node = nodeCache.get(proofHeight)[session.account];
        } else {
          node = await this.queryNode(session.account);
          if(nodeCache.has(proofHeight)) {
            // @ts-ignore
            nodeCache.get(proofHeight)[session.account] = node;
          } else {
            nodeCache.set(proofHeight, {[session.account]: node});
          }
        }
        if(!node)
          nodeError = `Unable to get node at height ${proofHeight} with account ${session.account}`;
      } catch(err: any) {
        nodeError = `Error getting node data for ${session.account} at height ${proofHeight} - ` + err.message;
      }
      if(nodeError) {
        rewards.push(new Error(nodeError));
        continue;
      }
      if(node) {
        let reward: string = '';
        let rewardError = '';
        try {
          reward = await this.calculateReward(session.relays, node.tokens, params);
        } catch(err: any) {
          rewardError = `Error calculating reward for session at height ${session?.sessionHeight} with proof ${session?.proof?.hash} - ` + err.message;
        }
        if(rewardError) {
          rewards.push(new Error(rewardError));
          continue;
        }
        rewards.push({
          ...session,
          reward,
          rewardDenom: 'upokt',
        });
      }
    }
    return rewards;
  }

  async getRewardFromSession(session: SessionData, retryTimeout = this._retryRequestTimeout): Promise<RewardData> {
    this._checkPocketEndpoint();
    const [ reward ] = await this.getRewardsFromSessions([session], retryTimeout);
    if(isError(reward))
      throw reward;
    return reward;
  }

  async getSessionsRewardsFromHeight(address: string, startingHeight: number, includeTransactions = false, retryTimeout = this._retryRequestTimeout): Promise<(RewardDataCondensed|RewardData|Error)[]> {
    this._checkPocketEndpoint();
    const sessions = await this.getSessionsByHeight(address, startingHeight, retryTimeout);
    const rewards = await this.getRewardsFromSessions(sessions, retryTimeout);
    // if includeTransactions is true, send the reward data including the full proof and claim transactions
    if(includeTransactions)
      return rewards;
    // otherwise, return the condensed version of the reward data which only includes the hashes of the proof and claim transactions
    return rewards
      .map((rewardData) => {
        if(isError(rewardData))
          return rewardData;
        return {
          ...rewardData,
          proof: rewardData.proof.hash,
          claim: rewardData.claim.hash,
        };
      });
  }

}
