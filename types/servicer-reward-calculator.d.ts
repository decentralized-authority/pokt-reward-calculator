import { PocketNode, RewardData, RewardParams, SessionData } from './interfaces';
export interface ServicerRewardCalculatorParams {
    pocketEndpoint?: string;
    requestTimeout?: number;
    retryRequestTimeout?: number;
    multiRequestCount?: number;
    stateCacheLength?: number;
    useStateCache?: boolean;
    txPerPage?: number;
}
export declare class ServicerRewardCalculator {
    _pocketEndpoint: string;
    _requestTimeout: number;
    _retryRequestTimeout: number;
    _multiRequestCount: number;
    _txPerPage: number;
    _stateCacheLength: number;
    _useStateCache: boolean;
    _stateCache: [number, any][];
    constructor(params?: ServicerRewardCalculatorParams);
    private _makeRequest;
    private _makeMultiRequest;
    private _makeRetryRequest;
    _checkPocketEndpoint(): void;
    queryHeight(timeout?: number): Promise<number>;
    queryNode(address: string, height?: number, timeout?: number): Promise<PocketNode>;
    queryState(height: number, retryTimeout?: number): Promise<any>;
    queryAccountTxsByHeight(address: string, startingHeight: number, retryTimeout?: number): Promise<any>;
    getSessionsByHeight(address: string, startingHeight: number, retryTimeout?: number): Promise<SessionData[]>;
    getParamsFromState(state: any): RewardParams;
    _calculateReward(session: SessionData, state: any, node: PocketNode): Promise<string>;
    getRewardsFromSessions(sessions: SessionData[], retryTimeout?: number): Promise<(RewardData | Error)[]>;
    getRewardFromSession(session: SessionData, retryTimeout?: number): Promise<RewardData>;
}
