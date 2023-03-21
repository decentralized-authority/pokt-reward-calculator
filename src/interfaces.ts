export interface SessionData {
  account: string
  sessionHeight: number
  chain: string
  relays: number
  proof: any
  claim: any
}

export interface RewardData extends SessionData {
  reward: string
  rewardDenom: 'upokt'
}

export interface RewardDataCondensed extends SessionData {
  reward: string
  rewardDenom: 'upokt'
  proof: string
  claim: string
}

export interface RewardParams {
  dao_allocation: string
  proposer_allocation: string
  relays_to_tokens_multiplier: string
  servicer_stake_floor_multipler: string
  servicer_stake_floor_multiplier_exponent: string
  servicer_stake_weight_ceiling: string
  servicer_stake_weight_multipler: string
}

export interface PocketNode {
  address: string
  chains: string[]
  jailed: boolean
  output_address: string
  public_key: string
  service_url: string
  status: number
  tokens: string
  unstaking_time: string
}
