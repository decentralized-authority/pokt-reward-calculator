import should from 'should';
import { ServicerRewardCalculator } from './servicer-reward-calculator';
import express from 'express';
import * as bodyParser from 'body-parser';
import { Server } from 'net';
import portUsed from 'tcp-port-used';
import isError from 'lodash/isError';
import { SessionData } from './interfaces';

describe('ServicerRewardCalculator', function() {

  this.timeout(30000);

  const pocketEndpoint = process.env.POCKET_ENDPOINT || '';
  if(!pocketEndpoint)
    throw new Error('POCKET_ENDPOINT env var not set');

  let server: Server
  const correctStrVal = 'testval0';
  const incorrectStrVal = 'testval1';
  const correctObjVal = {testkey: correctStrVal};
  const incorrectObjVal = {testkey: incorrectStrVal};
  let port: number;
  let rewardCalculator: ServicerRewardCalculator;
  const getErrorPath0 = '/geterrorpath0';
  const getNoResPath0 = '/getnorespath0';
  const getObjPath0 = '/getobjpath0';
  const getObjPath1 = '/getobjpath1';
  const getPrimPath0 = '/getprimpath0';
  const getPrimPath1 = '/getprimpath1';
  const postReturnBodyPath0 = '/postreturnbodypath0';
  const multiRequestCount = 3;
  const address = process.env.NODE_ADDRESS || '';

  if(!address)
    throw new Error('NODE_ADDRESS env var not set');

  before(async function() {
    rewardCalculator = new ServicerRewardCalculator({
      pocketEndpoint,
    });
    port = 3000;
    while(await portUsed.check(port)) {
      port++;
    }
    await new Promise<void>((resolve) => {
      let getobjpath1Count = 0;
      let getprimpath1Count = 0;
      server = express()
        .use(bodyParser.json())
        .get(getErrorPath0, (req, res) => {
          res.sendStatus(404);
        })
        .get(getNoResPath0, (req, res) => {
          res.sendStatus(200);
        })
        .get(getPrimPath0, (req, res) => {
          res.type('application/json');
          res.send(JSON.stringify(correctStrVal));
        })
        .get(getObjPath0, (req, res) => {
          res.type('application/json');
          res.send(JSON.stringify(correctObjVal));
        })
        .get(getObjPath1, (req, res) => {
          res.type('application/json');
          res.send(JSON.stringify(
            getobjpath1Count % 2 ? incorrectObjVal : correctObjVal)
          );
          getobjpath1Count++;
        })
        .get(getPrimPath1, (req, res) => {
          res.type('application/json');
          res.send(JSON.stringify(
            getprimpath1Count % 2 ? incorrectStrVal : correctStrVal)
          );
          getprimpath1Count++;
        })
        .post(postReturnBodyPath0, (req, res) => {
          res.type('application/json');
          res.send(JSON.stringify(req.body));
        })
        .listen(port, () => {
          resolve();
        });
    });
  });

  describe('ServiceRewardCalculator._makeRequest', function() {
    it('should make a single request and return the response or an Error', async function() {
      { // test error response
        // @ts-ignore
        const res = await rewardCalculator._makeRequest('GET', `http://localhost:${port}${getErrorPath0}`);
        should(res).be.an.Error();
      }
      { // test string response
        // @ts-ignore
        const res = await rewardCalculator._makeRequest('GET', `http://localhost:${port}${getPrimPath0}`);
        should(res).equal(correctStrVal);
      }
      { // test object response
        // @ts-ignore
        const res = await rewardCalculator._makeRequest('GET', `http://localhost:${port}${getObjPath0}`);
        should(res).be.an.Object();
        JSON.stringify(res).should.equal(JSON.stringify(correctObjVal));
      }
      { // test post response
        const body = {key: 'val'};
        // @ts-ignore
        const res = await rewardCalculator._makeRequest('POST', `http://localhost:${port}${postReturnBodyPath0}`, body);
        should(res).be.an.Object();
        JSON.stringify(res).should.equal(JSON.stringify(body));
      }
    });
  });

  describe('ServiceRewardCalculator._makeMultiRequest', function() {
    it('should make multiple requests and return the most common successful response or an Error', async function() {
      { // test error response
        // @ts-ignore
        const res = await rewardCalculator._makeMultiRequest(multiRequestCount, 'GET', `http://localhost:${port}${getErrorPath0}`);
        should(res).be.an.Error();
      }
      { // test string response
        // @ts-ignore
        const res = await rewardCalculator._makeMultiRequest(multiRequestCount, 'GET', `http://localhost:${port}${getPrimPath1}`);
        JSON.stringify(res).should.equal(JSON.stringify(correctStrVal));
      }
      { // test object response
        // @ts-ignore
        const res = await rewardCalculator._makeMultiRequest(multiRequestCount, 'GET', `http://localhost:${port}${getObjPath1}`);
        JSON.stringify(res).should.equal(JSON.stringify(correctObjVal));
      }
      { // test post response
        const body = {key: 'val'};
        // @ts-ignore
        const res = await rewardCalculator._makeMultiRequest(multiRequestCount, 'POST', `http://localhost:${port}${postReturnBodyPath0}`, body);
        JSON.stringify(res).should.equal(JSON.stringify(body));
      }
    });
  });

  describe('ServiceRewardCalculator._makeRetryRequest', function() {
    it('should make a request and retry if it fails', async function() {
      { // test error response
        // @ts-ignore
        const res = await rewardCalculator._makeRetryRequest(3, 'GET', `http://localhost:${port}${getErrorPath0}`);
        should(res).be.an.Error();
      }
    });
  });

  describe('ServiceRewardCalculator.queryHeight', function() {
    it('should return the current block height', async function() {
      const res = await rewardCalculator.queryHeight();
      should(res).be.a.Number();
      res.should.be.greaterThan(0);
    });
  });

  describe('ServiceRewardCalculator.queryNode', function() {
    it('should return a node\'s data', async function() {
      const res = await rewardCalculator.queryNode(address);
      should(res).be.an.Object();
      res.tokens.should.be.a.String();
      parseInt(res.tokens).should.be.greaterThan(0);
    });
  });

  describe('ServiceRewardCalculator.queryAccountTxsByHeight', function() {
    it('should return the transactions for an account at or above a specified height', async function() {
      const height = await rewardCalculator.queryHeight();
      const startingHeight = height - 100;
      const res = await rewardCalculator.queryAccountTxsByHeight(address, startingHeight);
      res.every((tx: any) => tx.height >= startingHeight).should.be.True();
    });
  });

  let sessions: SessionData[] = [];

  describe('ServiceRewardCalculator.getSessionsByHeight', function() {
    it('should return session datas for an account at or above a specified height', async function() {
      const height = await rewardCalculator.queryHeight();
      const startingHeight = height - 100;
      const res = await rewardCalculator.getSessionsByHeight(address, startingHeight);
      should(res).be.an.Array();
      res.every((pair: any) => pair.claim && pair.proof).should.be.True();
      res.every((pair: any) => pair.sessionHeight >= startingHeight).should.be.True();
      res.every((pair: any) => pair.relays > 0).should.be.True();
      sessions = res;
    });
  });

  let state: any;
  describe('ServiceRewardCalculator.queryState', function() {
    it('should return the state of the blockchain at a specified height', async function() {
      this.timeout(120000);
      const blockHeight = sessions[0].proof.height;
      // Test getting a fresh state
      const res = await rewardCalculator.queryState(blockHeight, 60000);
      state = res;
      should(res).be.an.Object();
      rewardCalculator._stateCache.length.should.be.greaterThan(0);
      rewardCalculator._stateCache.some((s) => s[0] === blockHeight).should.be.True();
      // Test getting a cached state
      const cachedRes = await rewardCalculator.queryState(blockHeight);
      should(cachedRes).be.an.Object();
      cachedRes.should.equal(res);
    });
  });

  describe('ServiceRewardCalculator.getParamsFromState', function() {
    it('should return the reward params from state', async function() {
      const res = await rewardCalculator.getParamsFromState(state);
      should(res).be.an.Object();
      res.dao_allocation.should.be.a.String();
      res.proposer_allocation.should.be.a.String();
      res.relays_to_tokens_multiplier.should.be.a.String();
      res.servicer_stake_floor_multipler.should.be.a.String();
      res.servicer_stake_floor_multiplier_exponent.should.be.a.String();
      res.servicer_stake_weight_ceiling.should.be.a.String();
      res.servicer_stake_weight_multipler.should.be.a.String();
    });
  });

  describe('ServiceRewardCalculator.getRewardFromSession', function() {
    it('should return reward data for a session', async function() {
      const res = await rewardCalculator.getRewardFromSession(sessions[0], 30000);
      should(res).be.an.Object();
      res.sessionHeight.should.be.a.Number();
      res.chain.should.be.a.String();
      res.relays.should.be.a.Number();
      res.claim.should.be.an.Object();
      res.proof.should.be.an.Object();
      res.reward.should.be.a.String();
      res.reward.length.should.be.greaterThan(0);
      res.rewardDenom.should.be.a.String();
    });
  });

  describe('ServiceRewardCalculator.getRewardsFromSessions', function() {
    it('should return an array of reward datas from an array of sessions', async function() {
      this.timeout(300000);
      const resArr = await rewardCalculator.getRewardsFromSessions(sessions.slice(0, 1), 30000);
      should(resArr).be.an.Array();
      resArr.length.should.be.greaterThan(0);
      for(const res of resArr) {
        if(isError(res))
          throw res;
        res.sessionHeight.should.be.a.Number();
        res.chain.should.be.a.String();
        res.relays.should.be.a.Number();
        res.claim.should.be.an.Object();
        res.proof.should.be.an.Object();
        res.reward.should.be.a.String();
        res.reward.length.should.be.greaterThan(0);
        res.rewardDenom.should.be.a.String();
      }
    });
  });

  after(function() {
    server.close();
  });

});
