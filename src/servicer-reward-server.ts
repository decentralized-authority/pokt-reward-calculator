import { ServicerRewardCalculator, ServicerRewardCalculatorParams } from './servicer-reward-calculator';
import express from 'express';
import bindAll from 'lodash/bindAll';
import cors from 'cors';
import bodyParser from 'body-parser';
import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import isPlainObject from 'lodash/isPlainObject';
import isArray from 'lodash/isArray';

export interface ServicerRewardServerParams extends ServicerRewardCalculatorParams {
  port?: number;
}
export class ServicerRewardServer {

  _port = 3300;
  _rewardCalculator: ServicerRewardCalculator;

  constructor(params: ServicerRewardServerParams) {
    this._port = params.port || this._port;
    this._rewardCalculator = new ServicerRewardCalculator(params);
    bindAll(this, [
      'handleRequest',
    ]);
  }

  start(): Promise<void> {
    const port = this._port;
    return new Promise((resolve) => {
      express()
        .use(cors())
        .use(bodyParser.json({
          limit: '10mb',
        }))
        .post('/', this.handleRequest)
        .listen(port, () => {
          console.log(`Servicer Reward Server listening on port ${port}`);
          resolve();
        });
    });
  }

  async handleRequest(req: express.Request, res: express.Response): Promise<any> {
    if(req.headers['content-type'] !== 'application/json')
      return res.status(400).send('Content-Type must be application/json');
    if(!isPlainObject(req.body))
      return res.status(400).send('request body must be a json object');
    const {
      jsonrpc,
      id,
      method,
      params
    } = req.body as {jsonrpc: string, id: number|string, method: string, params: any[]};
    if(jsonrpc !== '2.0')
      return res.status(400).send('jsonrpc version must be 2.0');
    if(!isNumber(id) && !isString(id))
      return res.status(400).send('id must be a number or string');
    if(!isString(method))
      return res.status(400).send('method must be a string');
    if(params && !isArray(params))
      return res.status(400).send('params must be an array');
    try {
      // @ts-ignore
      const result = await this._rewardCalculator[method](...(params || []));
      res
        .status(200)
        .type('application/json')
        .send(JSON.stringify({
          jsonrpc,
          id,
          result,
        }));
    } catch(err: any) {
      res
        .status(200)
        .type('application/json')
        .send(JSON.stringify({
          jsonrpc,
          id,
          error: {message: err.message},
        }));
    }
  }

}
