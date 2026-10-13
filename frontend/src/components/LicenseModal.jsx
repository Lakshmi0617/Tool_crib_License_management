import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

export default function LicenseModal({ isOpen, onClose, isBlocking = false, onActivated }) {
  const [systemInfo, setSystemInfo] = useState(null);
  const [statusInfo, setStatusInfo] = useState(null);
  const [licenseKeyInput, setLicenseKeyInput] = useState('');
  
  // Company details state
  const [companyName, setCompanyName] = useState('');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [projectName, setProjectName] = useState('');

  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [fetchingCredentials, setFetchingCredentials] = useState(false);
  const [fetchedCredentials, setFetchedCredentials] = useState('');
  const [copiedCredentials, setCopiedCredentials] = useState(false);
  const [validationResult, setValidationResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen || isBlocking) {
      fetchLicenseData();
    }
  }, [isOpen, isBlocking]);

  const fetchLicenseData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [sysRes, statRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/license/system-info`).then(res => res.json()),
        fetch(`${API_BASE_URL}/api/license/status`).then(res => res.json())
      ]);
      setSystemInfo(sysRes);
      setStatusInfo(statRes);
      if (statRes?.license_info?.company_name && !companyName) {
        setCompanyName(statRes.license_info.company_name);
      }
    } catch (err) {
      setErrorMsg('Failed to connect to backend license service.');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchCredentials = async () => {
    setFetchingCredentials(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const response = await fetch(`${API_BASE_URL}/api/license/fetch-request`, {
        method: 'POST'
      });
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.detail || 'Failed to fetch hardware request credentials');
      }

      const credText = data.credentials_text || data.stdout;
      setFetchedCredentials(credText);
      setSuccessMsg('⚡ Hardware machine request credentials fetched successfully from client_license.py!');

      if (data.machine_info?.MacAddress) {
        setSystemInfo(prev => ({
          ...prev,
          primary_mac: data.machine_info.MacAddress
        }));
      }
    } catch (err) {
      setErrorMsg(`Fetch Failed: ${err.message}`);
    } finally {
      setFetchingCredentials(false);
    }
  };

  const handleCopyCredentials = () => {
    if (fetchedCredentials) {
      navigator.clipboard.writeText(fetchedCredentials);
      setCopiedCredentials(true);
      setTimeout(() => setCopiedCredentials(false), 2000);
    }
  };

  const handleCopyMac = () => {
    if (systemInfo?.primary_mac) {
      navigator.clipboard.writeText(systemInfo.primary_mac);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleValidate = async (e) => {
    if (e) e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setErrorMsg('Please enter a license key string to validate.');
      return;
    }

    setValidating(true);
    setErrorMsg('');
    setSuccessMsg('');
    setValidationResult(null);

    try {
      const response = await fetch(`${API_BASE_URL}/api/license/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKeyInput.trim() })
      });

      const data = await response.json();
      setValidationResult(data);

      if (!data.is_valid) {
        setErrorMsg(`Validation Warning: ${data.message}`);
      } else {
        setSuccessMsg('License key validated successfully! Verification summary is shown below.');
        const payloadCustomer = data.customer;
        if (payloadCustomer && !companyName) {
          setCompanyName(payloadCustomer);
        }
      }
    } catch (err) {
      setErrorMsg('License key decryption/validation request failed.');
    } finally {
      setValidating(false);
    }
  };

  const handleActivate = async (e) => {
    e.preventDefault();
    if (!licenseKeyInput.trim()) {
      setErrorMsg('Please enter a valid license key.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const response = await fetch(`${API_BASE_URL}/api/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          license_key: licenseKeyInput.trim(),
          company_name: companyName.trim(),
          address: address.trim(),
          phone: phone.trim(),
          email: email.trim(),
          project_name: projectName.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Activation failed');
      }

      setSuccessMsg(data.message || 'License activated & Company registered successfully!');
      setLicenseKeyInput('');
      setValidationResult(null);
      await fetchLicenseData();
      if (onActivated) onActivated();
      if (!isBlocking && onClose) {
        setTimeout(() => onClose(), 1500);
      }
    } catch (err) {
      setErrorMsg(err.message || 'License activation failed');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen && !isBlocking) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 99999,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        maxWidth: '720px',
        width: '100%',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        overflow: 'hidden',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #e2e8f0',
        fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}>
        {/* Header */}
        <div style={{
          background: isBlocking ? 'linear-gradient(135deg, #dc2626 0%, #991b1b 100%)' : 'linear-gradient(135deg, #2563eb 0%, #1e40af 100%)',
          color: '#ffffff',
          padding: '20px 28px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 600 }}>
              {isBlocking ? '⚠️ Software License Required' : '🔑 Software License & Company Registration'}
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', opacity: 0.9 }}>
              {isBlocking ? 'System access restricted until a valid license key is activated.' : 'Validate Ed25519 & SHA-256 License Key & Register Company Details'}
            </p>
          </div>
          {!isBlocking && onClose && (
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: '1.5rem',
                cursor: 'pointer',
                lineHeight: 1
              }}
            >
              &times;
            </button>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div style={{ padding: '24px 28px', overflowY: 'auto' }}>
          {/* System MAC Address Card */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <span style={{ fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', fontWeight: 700 }}>
              Host Machine System MAC Address
            </span>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
              <code style={{
                fontSize: '1.2rem',
                fontWeight: 700,
                color: '#0f172a',
                fontFamily: 'monospace',
                letterSpacing: '1px'
              }}>
                {systemInfo?.primary_mac || 'Loading...'}
              </code>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleFetchCredentials}
                  disabled={fetchingCredentials}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: fetchingCredentials ? 'not-allowed' : 'pointer',
                    opacity: fetchingCredentials ? 0.7 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  {fetchingCredentials ? '⚡ Running...' : '⚡ Fetch Credentials'}
                </button>
                <button
                  type="button"
                  onClick={handleCopyMac}
                  style={{
                    backgroundColor: copied ? '#16a34a' : '#0f172a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                >
                  {copied ? '✓ Copied!' : '📋 Copy MAC'}
                </button>
              </div>
            </div>
          </div>

          {/* Fetched Machine Hardware Credentials Request Box */}
          <div style={{
            backgroundColor: '#f8fafc',
            border: '1px solid #cbd5e1',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.88rem', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>💻 Fetched Hardware Machine Request Credentials</span>
                <span style={{ fontSize: '0.72rem', backgroundColor: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '10px', fontWeight: 600 }}>
                  client_license.py --request
                </span>
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  onClick={handleFetchCredentials}
                  disabled={fetchingCredentials}
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '6px 14px',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                    cursor: fetchingCredentials ? 'not-allowed' : 'pointer',
                    opacity: fetchingCredentials ? 0.7 : 1
                  }}
                >
                  {fetchingCredentials ? '⚡ Running...' : '⚡ Fetch'}
                </button>
                {fetchedCredentials && (
                  <button
                    type="button"
                    onClick={handleCopyCredentials}
                    style={{
                      backgroundColor: copiedCredentials ? '#16a34a' : '#475569',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 12px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    {copiedCredentials ? '✓ Copied!' : '📋 Copy Credentials'}
                  </button>
                )}
              </div>
            </div>
            <textarea
              rows={8}
              readOnly
              value={fetchedCredentials || 'Click the "Fetch" button to automatically execute python License/client_license.py --request and display machine credentials here...'}
              style={{
                width: '100%',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                padding: '10px 12px',
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                boxSizing: 'border-box',
                backgroundColor: '#ffffff',
                color: fetchedCredentials ? '#0f172a' : '#94a3b8',
                resize: 'vertical'
              }}
            />
          </div>

          {/* Active License Status Banner */}
          {statusInfo && (
            <div style={{
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '20px',
              backgroundColor: statusInfo.is_valid ? '#f0fdf4' : '#fef2f2',
              border: `1px solid ${statusInfo.is_valid ? '#bbf7d0' : '#fecaca'}`,
              color: statusInfo.is_valid ? '#166534' : '#991b1b',
              fontSize: '0.88rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600 }}>
                <span>Current Status: {statusInfo.is_valid ? '✅ Active & Valid' : '❌ License Inactive / Expired'}</span>
                {statusInfo.days_remaining !== null && statusInfo.days_remaining !== undefined && (
                  <span>{statusInfo.days_remaining} Days Remaining</span>
                )}
              </div>
              {statusInfo.license_info && (
                <div style={{ marginTop: '8px', fontSize: '0.82rem', lineHeight: '1.4' }}>
                  <div><strong>Licensed To:</strong> {statusInfo.license_info.company_name}</div>
                  <div><strong>Expires On:</strong> {statusInfo.license_info.expires_at ? new Date(statusInfo.license_info.expires_at).toLocaleDateString() : 'Perpetual'}</div>
                </div>
              )}
            </div>
          )}

          {/* Feedback messages */}
          {errorMsg && (
            <div style={{ backgroundColor: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem' }}>
              ⚠️ {errorMsg}
            </div>
          )}
          {successMsg && (
            <div style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px 14px', marginBottom: '16px', fontSize: '0.85rem' }}>
              🎉 {successMsg}
            </div>
          )}

          {/* License Key & Company Registration Form */}
          <form onSubmit={handleActivate}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
                Enter / Paste Encrypted License Key String:
              </label>
              <textarea
                rows={3}
                value={licenseKeyInput}
                onChange={(e) => {
                  setLicenseKeyInput(e.target.value);
                  setValidationResult(null);
                }}
                placeholder="Paste your signed Ed25519 & SHA-256 license key string here..."
                style={{
                  width: '100%',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  padding: '10px 12px',
                  fontFamily: 'monospace',
                  fontSize: '0.8rem',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                  backgroundColor: '#fafafa'
                }}
              />
            </div>

            {/* Company & Organization Details Section */}
            <div style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px',
              marginBottom: '20px'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700, color: '#1e293b' }}>
                🏢 Company & Project Information
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="e.g. ACME Tooling Ltd"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Project Name
                  </label>
                  <input
                    type="text"
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. ToolCrib Inventory System"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Contact Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+1 555-0198"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Email ID
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@company.com"
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '0.85rem',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                  Company Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Industrial Park, Suite 400"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    fontSize: '0.85rem',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Action Buttons: Validate & Activate */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px' }}>
              <button
                type="button"
                onClick={handleValidate}
                disabled={validating || !licenseKeyInput.trim()}
                style={{
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '10px 20px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  cursor: validating || !licenseKeyInput.trim() ? 'not-allowed' : 'pointer',
                  opacity: validating || !licenseKeyInput.trim() ? 0.6 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                {validating ? '🔍 Decrypting & Validating...' : '🔍 Validate License'}
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                {!isBlocking && onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    style={{
                      backgroundColor: '#e2e8f0',
                      color: '#475569',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      fontWeight: 600,
                      fontSize: '0.88rem',
                      cursor: 'pointer'
                    }}
                  >
                    Close
                  </button>
                )}
                <button
                  type="submit"
                  disabled={loading || !licenseKeyInput.trim()}
                  style={{
                    backgroundColor: '#16a34a',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    padding: '10px 24px',
                    fontWeight: 600,
                    fontSize: '0.88rem',
                    cursor: loading || !licenseKeyInput.trim() ? 'not-allowed' : 'pointer',
                    opacity: loading || !licenseKeyInput.trim() ? 0.6 : 1
                  }}
                >
                  {loading ? 'Activating...' : '🔑 Activate License'}
                </button>
              </div>
            </div>
          </form>

          {/* Decrypted License Data Table Preview */}
          {validationResult && (
            <div style={{
              marginTop: '24px',
              border: '1px solid #cbd5e1',
              borderRadius: '12px',
              overflow: 'hidden',
              backgroundColor: '#ffffff'
            }}>
              <div style={{
                backgroundColor: validationResult.is_valid ? '#f0fdf4' : '#fef2f2',
                padding: '12px 16px',
                borderBottom: '1px solid #cbd5e1',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <span style={{ fontWeight: 700, color: validationResult.is_valid ? '#166534' : '#991b1b', fontSize: '0.9rem' }}>
                  Decrypted License Verification Results
                </span>
                <span style={{
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: '12px',
                  backgroundColor: validationResult.is_valid ? '#22c55e' : '#ef4444',
                  color: '#ffffff',
                  textTransform: 'uppercase'
                }}>
                  {validationResult.is_valid ? 'Valid License' : 'Invalid License'}
                </span>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem', textAlign: 'left' }}>
                <tbody>
                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', width: '38%', backgroundColor: '#f8fafc' }}>Customer / Company</td>
                    <td style={{ padding: '10px 14px', fontWeight: 700, color: '#0f172a' }}>
                      {validationResult.customer || 'N/A'}
                    </td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', backgroundColor: '#f8fafc' }}>Hardware Lock Status</td>
                    <td style={{ padding: '10px 14px' }}>
                      {validationResult.host_match_valid ? (
                        <span style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#dcfce7', color: '#15803d', fontWeight: 600 }}>System Host Hardware Match ✓</span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', padding: '3px 8px', borderRadius: '4px', backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 600 }}>Host Mismatch / Invalid Hardware ✗</span>
                      )}
                    </td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', backgroundColor: '#f8fafc' }}>Issued Date</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>
                      {validationResult.details?.issued_at ? new Date(validationResult.details.issued_at).toLocaleString() : 'N/A'}
                    </td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', backgroundColor: '#f8fafc' }}>Expiration Date</td>
                    <td style={{ padding: '10px 14px', color: '#334155' }}>
                      {validationResult.expires_at ? new Date(validationResult.expires_at).toLocaleString() : 'Perpetual (No Expiration)'}
                    </td>
                  </tr>

                  <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', backgroundColor: '#f8fafc' }}>Asymmetric Signature Check</td>
                    <td style={{ padding: '10px 14px' }}>
                      {validationResult.signature_valid ? (
                        <span style={{ color: '#166534', fontWeight: 700 }}>✓ Verified Valid Signature</span>
                      ) : (
                        <span style={{ color: '#991b1b', fontWeight: 700 }}>✗ Invalid / Tampered Signature</span>
                      )}
                    </td>
                  </tr>

                  <tr>
                    <td style={{ padding: '10px 14px', fontWeight: 600, color: '#475569', backgroundColor: '#f8fafc' }}>SHA-256 Hash Checksum</td>
                    <td style={{ padding: '10px 14px' }}>
                      {validationResult.sha256_valid ? (
                        <span style={{ color: '#166534', fontWeight: 700 }}>✓ SHA-256 Integrity Verified</span>
                      ) : (
                        <span style={{ color: '#991b1b', fontWeight: 700 }}>✗ SHA-256 Hash Mismatch</span>
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
