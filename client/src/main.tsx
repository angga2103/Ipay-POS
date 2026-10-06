import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Global fetch interceptor to automatically attach active tenant ID & auth token
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const activeTenant = localStorage.getItem('pos_tenant_id') || 'default';
  const authToken = localStorage.getItem('pos_auth_token');
  const modifiedInit = { ...(init || {}) };
  const headers = new Headers(modifiedInit.headers || {});

  if (!headers.has('x-tenant-id')) {
    headers.set('x-tenant-id', activeTenant);
  }
  if (authToken && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${authToken}`);
  }

  modifiedInit.headers = headers;
  const res = await originalFetch(input, modifiedInit);

  // If session expired or token is invalid on multi-tenant store, clear dead tokens
  if (res.status === 401 && activeTenant !== 'default') {
    const urlStr = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url || '';
    if (!urlStr.includes('/auth/login') && !urlStr.includes('/auth/sso-exchange')) {
      localStorage.removeItem('pos_auth_token');
      localStorage.removeItem('pos_user');
    }
  }

  return res;
};

// Check for SSO incoming params from GarudaTel
const urlParams = new URLSearchParams(window.location.search);
const ssoCode = urlParams.get('sso_code');
const ssoMerchant = urlParams.get('sso_merchant');
const ssoSign = urlParams.get('sso_sign');
const ssoTs = urlParams.get('sso_ts');

if (ssoCode) {
  // Metode Aman: Pertukaran One-Time Ticket Token SSO
  const ssoBaseUrl = urlParams.get('sso_base_url') || 'https://ipay.my.id';
  originalFetch('/api/auth/sso-exchange', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sso_code: ssoCode,
      base_url: ssoBaseUrl,
    }),
  })
    .then(res => res.json())
    .then(data => {
      if (data.success) {
        localStorage.setItem('pos_tenant_id', data.tenantId);
        localStorage.setItem('pos_user', JSON.stringify(data.user));
        if (data.token) localStorage.setItem('pos_auth_token', data.token);
        // Hapus query parameters dari URL browser
        window.history.replaceState({}, document.title, window.location.pathname);
        window.location.reload();
      } else {
        alert(`Gagal login via SSO GarudaTel: ${data.error || 'Autentikasi ditolak'}`);
      }
    })
    .catch(err => {
      console.error('SSO exchange error:', err);
    });
} else if (ssoMerchant && ssoSign && ssoTs) {
  // Metode Legacy (Fallback): Signature MD5
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
        if (data.token) localStorage.setItem('pos_auth_token', data.token);
        // Hapus query parameters dari URL browser
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
