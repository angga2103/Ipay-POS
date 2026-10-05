import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global fetch interceptor to automatically attach active tenant ID
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const activeTenant = localStorage.getItem('pos_tenant_id') || 'default';
  const modifiedInit = { ...(init || {}) };
  const headers = new Headers(modifiedInit.headers || {});
  if (!headers.has('x-tenant-id')) {
    headers.set('x-tenant-id', activeTenant);
  }
  modifiedInit.headers = headers;
  return originalFetch(input, modifiedInit);
};

// Check for SSO incoming params from GarudaTel (e.g. ?sso_merchant=...&sso_sign=...)
const urlParams = new URLSearchParams(window.location.search);
const ssoMerchant = urlParams.get('sso_merchant');
const ssoSign = urlParams.get('sso_sign');
const ssoTs = urlParams.get('sso_ts');

if (ssoMerchant && ssoSign && ssoTs) {
  const ssoApiKey = urlParams.get('sso_api_key') || '';
  const ssoSecret = urlParams.get('sso_secret') || '';
  const ssoName = urlParams.get('sso_name') || '';
  const ssoPhone = urlParams.get('sso_phone') || '';
  const ssoBaseUrl = urlParams.get('sso_base_url') || 'https://ipay.my.id';

  originalFetch('/api/auth/garudatel-sso', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      merchant_id: ssoMerchant,
      api_key: ssoApiKey,
      secret_key: ssoSecret,
      name: ssoName,
      phone: ssoPhone,
      timestamp: ssoTs,
      signature: ssoSign,
      base_url: ssoBaseUrl,
    }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem('pos_tenant_id', data.tenantId);
        localStorage.setItem('pos_user', JSON.stringify(data.user));
        // Remove query parameters from URL cleanly
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
      } else {
        alert(`Gagal login via SSO GarudaTel: ${data.error || 'Autentikasi ditolak'}`);
      }
    })
    .catch(err => {
      console.error('SSO initialization error:', err);
    });
} else if (urlParams.get('tenant')) {
  const tId = urlParams.get('tenant')!;
  localStorage.setItem('pos_tenant_id', tId);
  window.history.replaceState({}, document.title, window.location.pathname);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
