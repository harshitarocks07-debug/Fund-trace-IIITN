import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, CircleHelp, RefreshCw, ShieldCheck } from "lucide-react";
import {
  fundingIntegrityService,
  type FiatSettlement,
  type NetworkStatus,
} from "../services/fundingIntegrityService";

export function FundingIntegrityPage() {
  const [networks, setNetworks] = useState<NetworkStatus[]>([]);
  const [settlements, setSettlements] = useState<FiatSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [networkResponse, settlementResponse] = await Promise.all([
        fundingIntegrityService.getNetworks(),
        fundingIntegrityService.getSettlements(),
      ]);
      setNetworks(networkResponse.networks);
      setSettlements(settlementResponse);
    } catch (loadError: unknown) {
      setError(loadError instanceof Error ? loadError.message : "Could not load fund integrity data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return (
    <section className="fund-integrity-page">
      <div className="welcome-row">
        <div>
          <p className="eyebrow">CROSS-CHAIN CONTROLS</p>
          <h1>Funding integrity</h1>
          <p className="welcome-subtitle">
            Testnet escrow readiness and signed off-ramp settlement evidence.
          </p>
        </div>
        <button className="button button-outline" onClick={() => void refresh()} disabled={loading}>
          <RefreshCw size={14} /> {loading ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      <div className="fund-integrity-note">
        <ShieldCheck size={18} />
        <div>
          <b>Disbursement policy: 3 of 5 independent validators</b>
          <span>
            The escrow contract stores evidence fingerprints only. Webhook alerts do not by themselves
            confirm that an on-chain freeze succeeded.
          </span>
        </div>
      </div>

      {error && <div className="fund-integrity-error" role="alert">{error}</div>}

      <div className="fund-integrity-grid">
        {networks.map((network) => (
          <article className="panel fund-network-card" key={network.chainId}>
            <div className="fund-card-heading">
              <div>
                <p className="eyebrow">CHAIN ID {network.chainId}</p>
                <h2>{network.network}</h2>
              </div>
              <span className={`fund-network-status ${network.rpcConnected ? "is-connected" : "is-offline"}`}>
                {network.rpcConnected ? <CheckCircle2 size={13} /> : <CircleHelp size={13} />}
                {network.status}
              </span>
            </div>
            <dl className="fund-network-details">
              <div><dt>Escrow deployment</dt><dd>{network.escrowDeployed ? network.escrowAddress : "Not deployed or not verified"}</dd></div>
              <div><dt>RPC connection</dt><dd>{network.rpcConnected ? `Connected · block ${network.latestBlock ?? "—"}` : "Not verified"}</dd></div>
              {network.observedChainId && network.observedChainId !== network.chainId && (
                <div className="fund-chain-warning">
                  <dt>Observed chain ID</dt><dd>{network.observedChainId} · expected {network.chainId}</dd>
                </div>
              )}
            </dl>
          </article>
        ))}
      </div>

      <section className="panel fund-settlement-panel">
        <div className="panel-heading">
          <div><p className="eyebrow">PROVIDER-SIGNED EVENTS</p><h2>Fiat off-ramp settlements</h2></div>
          <span>{settlements.length} recorded</span>
        </div>
        {loading ? (
          <p className="fund-empty">Loading settlement records…</p>
        ) : settlements.length === 0 ? (
          <p className="fund-empty">No signed settlement webhooks have been recorded.</p>
        ) : (
          <div className="fund-settlement-list">
            {settlements.map((settlement) => (
              <article className="fund-settlement-row" key={settlement.id}>
                <div className="fund-settlement-main">
                  <span className="fund-settlement-ref">{settlement.settlement_reference}</span>
                  <span>{settlement.provider} · {settlement.provider_status}</span>
                  <small>
                    {settlement.project_id || "Unlinked project"} · {settlement.expense_id || "Unlinked expense"}
                    {settlement.chain_id ? ` · source chain ${settlement.chain_id}` : ""}
                  </small>
                </div>
                <div className="fund-settlement-value">
                  <b>{settlement.amount.toLocaleString("en-IN")} {settlement.currency}</b>
                  <span className={settlement.duplicate_evidence ? "fund-review-required" : "fund-clear"}>
                    {settlement.duplicate_evidence ? (
                      <><AlertTriangle size={13} /> 3-of-5 review required</>
                    ) : (
                      <><CheckCircle2 size={13} /> No duplicate match</>
                    )}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <p className="fund-integrity-disclaimer">
        Identical SHA-256 hashes reveal byte-identical files, not whether a unique receipt is authentic.
        Off-ramp providers must keep payouts cancellable until quorum authorization is verified.
      </p>
    </section>
  );
}
