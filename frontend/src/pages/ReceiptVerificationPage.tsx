import React, { useState } from 'react';

export const ReceiptVerificationPage: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [result, setResult] = useState<any | null>(null);

  const handleSimulateScan = () => {
    setScanning(true);
    setResult(null);
    setTimeout(() => {
      setScanning(false);
      setResult({
        vendor: 'Vidarbha Educational Tools Pvt Ltd',
        date: '2026-02-14',
        invoiceNumber: 'INV-2026-0492',
        extractedAmount: 185000,
        ocrConfidence: '99.2%',
        taxIdMatch: true,
        hash: '0x8f19e4a3c109...b72e',
      });
    }, 1500);
  };

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f8fafc', marginBottom: '6px' }}>
          OCR Receipt & Invoice Verification
        </h1>
        <p style={{ fontSize: '14px', color: '#94a3b8' }}>
          Automated fraud detection and optical invoice audit engine.
        </p>
      </div>

      <div style={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '28px', marginBottom: '24px' }}>
        <div style={{ border: '2px dashed #475569', borderRadius: '10px', padding: '40px', textAlign: 'center', backgroundColor: '#0f172a' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>📄</div>
          <div style={{ fontSize: '15px', fontWeight: 600, color: '#f8fafc', marginBottom: '6px' }}>
            Upload Vendor Invoice or Purchase Receipt
          </div>
          <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '20px' }}>
            Supports PDF, PNG, JPG scans up to 10MB
          </p>
          <button
            onClick={handleSimulateScan}
            disabled={scanning}
            style={{
              padding: '10px 24px',
              backgroundColor: '#3b82f6',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {scanning ? 'Running OCR & Fraud Check...' : 'Run Receipt Verification'}
          </button>
        </div>

        {result && (
          <div style={{ marginTop: '24px', backgroundColor: '#0f172a', border: '1px solid #10b981', borderRadius: '10px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10b981', fontWeight: 600, fontSize: '15px', marginBottom: '16px' }}>
              <span>✅</span> OCR Verification Passed & Cryptographically Hashed
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', fontSize: '13px' }}>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Vendor</span>
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>{result.vendor}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Invoice No</span>
                <span style={{ color: '#f8fafc', fontWeight: 500 }}>{result.invoiceNumber}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Extracted Amount</span>
                <span style={{ color: '#10b981', fontWeight: 700 }}>₹{result.extractedAmount.toLocaleString()}</span>
              </div>
              <div>
                <span style={{ color: '#64748b', display: 'block' }}>Confidence</span>
                <span style={{ color: '#38bdf8', fontWeight: 600 }}>{result.ocrConfidence}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

