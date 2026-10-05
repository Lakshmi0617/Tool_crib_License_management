import React from 'react';

export default function LicenseBanner({ statusInfo, onOpenModal }) {
  if (!statusInfo || !statusInfo.is_valid || statusInfo.days_remaining === null || statusInfo.days_remaining === undefined) {
    return null;
  }

  // Only show warning banner if 30 or fewer days remaining
  if (statusInfo.days_remaining > 30) {
    return null;
  }

  return (
    <div style={{
      backgroundColor: statusInfo.days_remaining <= 7 ? '#ef4444' : '#f59e0b',
      color: '#ffffff',
      padding: '8px 16px',
      fontSize: '0.88rem',
      fontWeight: 600,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      zIndex: 9000
    }}>
      <span>
        ⚠️ <strong>License Expiration Notice:</strong> Your software license expires in {statusInfo.days_remaining} day(s). Please renew your license key.
      </span>
      <button
        onClick={onOpenModal}
        style={{
          backgroundColor: '#ffffff',
          color: statusInfo.days_remaining <= 7 ? '#dc2626' : '#b45309',
          border: 'none',
          borderRadius: '4px',
          padding: '4px 12px',
          fontWeight: 700,
          fontSize: '0.8rem',
          cursor: 'pointer'
        }}
      >
        Renew License
      </button>
    </div>
  );
}
