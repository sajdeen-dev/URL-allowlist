/**
 * ECOM Buddy — Meesho supplier panel URL policy.
 * Allowed  paths on supplier.meesho.com: login, /home, /orders/, /returns/, /scan-now.
 */

export const MEESHO_HOST = 'supplier.meesho.com';

/** Saved login entry (session restored via cookies; opens home when cookies exist). */
export const MEESHO_LOGIN_URL =
  'https://supplier.meesho.com/panel/v3/new/root/login';

export const MEESHO_HOME_URL =
  'https://supplier.meesho.com/panel/v3/new/growth/tetkw/home';

/*
 * Reference — staff routes (whitelist enforced by path rules below):
 * Orders:  .../fulfillment/tetkw/orders/...
 * Returns: .../fulfillment/tetkw/returns/...
 * Scan:    .../fulfillment/tetkw/scan-now
 */

const LOGIN_PATH_PREFIX = '/panel/v3/new/root/login';

function isAllowedSupplierPath(pathname) {
  const p = pathname || '/';
  if (p.startsWith(LOGIN_PATH_PREFIX)) {
    return true;
  }
  if (p.includes('/orders/') || /\/orders(\/|$)/.test(p)) {
    return true;
  }
  if (p.includes('/returns/') || /\/returns(\/|$)/.test(p)) {
    return true;
  }
  if (p.includes('/scan-now')) {
    return true;
  }
  const segments = p.split('/').filter(Boolean);
  if (segments.length > 0 && segments[segments.length - 1] === 'home') {
    return true;
  }
  return false;
}

function isMeeshoFamilyHost(hostname) {
  const h = String(hostname).toLowerCase();
  return h === MEESHO_HOST || h.endsWith('.meesho.com');
}

/**
 * @param {string} url
 * @param {{ isTopFrame?: boolean } | undefined} request native request when available
 */
export function isUrlAllowed(url, request) {
  if (!url || url === 'about:blank') {
    return true;
  }

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.protocol === 'about:') {
    return true;
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false;
  }

  const host = parsed.hostname.toLowerCase();
  const isTop = request?.isTopFrame !== false;

  if (!isTop) {
    return isMeeshoFamilyHost(host);
  }

  if (host !== MEESHO_HOST) {
    return false;
  }

  return isAllowedSupplierPath(parsed.pathname || '/');
}
