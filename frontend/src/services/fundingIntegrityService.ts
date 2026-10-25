import { api } from "./api";

export interface NetworkStatus {
  network: string;
  chainId: number;
  escrowAddress: string;
  configured: boolean;
  escrowDeployed: boolean;
  rpcConnected: boolean;
  latestBlock: number | null;
  observedChainId: number | null;
  status: string;
}

export interface FiatSettlement {
  id: string;
  provider: string;
  event_id: string;
  settlement_reference: string;
  expense_id?: string | null;
  project_id?: string | null;
  evidence_hash: string;
  amount: number;
  currency: string;
  chain_id?: number | null;
  provider_status: string;
  duplicate_evidence: boolean;
  review_status: string;
  raw_event_hash: string;
  created_at?: string | null;
}

export const fundingIntegrityService = {
  getNetworks: () =>
    api.get<{ networks: NetworkStatus[]; validatorQuorum: string }>("/blockchain/networks"),
  getSettlements: () => api.get<FiatSettlement[]>("/fiat-settlements"),
};
