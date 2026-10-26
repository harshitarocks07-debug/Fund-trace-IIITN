import React, { useState, useEffect } from 'react';
import { donationService } from '../services/donationService';
import type { Donation, DonationCommitmentVerifyResponse } from '../types';
import { ShieldCheck, Lock, RefreshCw, CheckCircle2, HandCoins } from 'lucide-react';

export const DonationsPage: React.FC = () => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDonation, setSelectedDonation] = useState<Donation | null>(null);
  const [verificationResult, setVerificationResult] = useState<DonationCommitmentVerifyResponse | null>(null);
  const [verifying, setVerifying] = useState<boolean>(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const list = await donationService.listDonations();
        setDonations(list);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  async function handleVerify(donation: Donation) {
    setSelectedDonation(donation);
    setVerifying(true);
    setVerificationResult(null);
    try {
      const res = await donationService.verifyCommitment({
        donationId: donation.id,
        projectId: donation.projectId,
        amount: donation.amount,
        paymentReference: donation.reference,
        blindingSalt: donation.blindingSalt || '0x9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1e0f9a8b',
      });
      setVerificationResult(res);
    } catch (err) {
      console.error('Failed to verify commitment:', err);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#ecfdf5', color: '#065f46', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
            <ShieldCheck size={14} /> Zero Donor PII On-Chain
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#eff6ff', color: '#1e40af', padding: '4px 10px', borderRadius: '16px', fontSize: '12px', fontWeight: 600 }}>
            <Lock size={14} /> Keccak-256 Salted Commitments
          </span>
        </div>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: 700 }}>Zero-PII Donation Commitments</h1>
        <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '14px' }}>
          Cryptographic commitments protect donor privacy on Ethereum. Identities remain strictly off-chain.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px' }}>
          <RefreshCw className="spin-icon" size={24} style={{ margin: '0 auto 8px', color: '#0d9488' }} />
          <p>Loading donations...</p>
        </div>
      ) : donations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
          <HandCoins size={36} style={{ color: '#9ca3af', margin: '0 auto 8px' }} />
          <p style={{ margin: 0, color: '#4b5563', fontWeight: 500 }}>No donation commitments found.</p>
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: '8px', border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead style={{ background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
              <tr>
                <th style={{ padding: '12px 16px' }}>REFERENCE</th>
                <th style={{ padding: '12px 16px' }}>DONOR</th>
                <th style={{ padding: '12px 16px' }}>PROJECT</th>
                <th style={{ padding: '12px 16px' }}>AMOUNT</th>
                <th style={{ padding: '12px 16px' }}>COMMITMENT</th>
                <th style={{ padding: '12px 16px' }}>STATUS</th>
                <th style={{ padding: '12px 16px' }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d) => (
                <tr key={d.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>{d.id}</td>
                  <td style={{ padding: '12px 16px', color: '#065f46' }}>
                    <ShieldCheck size={12} style={{ display: 'inline', marginRight: 4 }} />
                    {d.donor}
                  </td>
                  <td style={{ padding: '12px 16px' }}>{d.projectId}</td>
                  <td style={{ padding: '12px 16px', fontWeight: 600 }}>₹{d.amount.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {d.commitmentHash ? `${d.commitmentHash.slice(0, 10)}...` : 'Salted Keccak-256'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: d.paymentStatus === 'Verified' ? '#ecfdf5' : '#fef3c7', color: d.paymentStatus === 'Verified' ? '#065f46' : '#92400e', padding: '2px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: 500 }}>
                      {d.paymentStatus || 'Pending'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button
                      onClick={() => void handleVerify(d)}
                      style={{ background: '#0d9488', color: '#fff', border: 'none', padding: '4px 10px', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                    >
                      <ShieldCheck size={12} /> Verify
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedDonation && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: '12px', maxWidth: '540px', width: '90%', padding: '24px' }}>
            <h3 style={{ margin: '0 0 12px' }}>Verify Donation Commitment · {selectedDonation.id}</h3>
            <p style={{ margin: '0 0 16px', fontSize: '13px', color: '#4b5563' }}>
              Mathematical proof verified directly on Ethereum blockchain without revealing donor identity.
            </p>
            {verifying ? (
              <div style={{ textAlign: 'center', padding: '24px' }}>
                <RefreshCw className="spin-icon" size={24} style={{ margin: '0 auto 8px', color: '#0d9488' }} />
                <p>Verifying commitment on-chain...</p>
              </div>
            ) : verificationResult ? (
              <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '16px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#065f46', fontWeight: 600, marginBottom: '8px' }}>
                  <CheckCircle2 size={18} /> Verified On-Chain
                </div>
                <p style={{ margin: 0, fontSize: '13px', color: '#1f2937' }}>{verificationResult.message}</p>
                <p style={{ margin: '8px 0 0', fontSize: '12px', color: '#047857' }}>{verificationResult.piiStatus}</p>
              </div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setSelectedDonation(null)}
                style={{ background: '#e5e7eb', border: 'none', padding: '6px 14px', borderRadius: '6px', fontSize: '13px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
