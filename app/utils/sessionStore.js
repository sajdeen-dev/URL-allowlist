import AsyncStorage from '@react-native-async-storage/async-storage';
import CookieManager from '@react-native-cookies/cookies';
import { Platform } from 'react-native';

const STORAGE_KEY = '@ecombuddy/meesho_session_v1';
const MEESHO_ORIGIN = 'https://supplier.meesho.com';

function cookieStoreUseWebKit() {
  return Platform.OS === 'ios';
}

export async function restoreSessionCookies() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return;
    }
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return;
    }
    const { cookies } = parsed;
    if (!cookies || typeof cookies !== 'object') {
      return;
    }

    const wk = cookieStoreUseWebKit();
    for (const key of Object.keys(cookies)) {
      const c = cookies[key];
      if (!c || typeof c.value !== 'string') {
        continue;
      }
      try {
        await CookieManager.set(
          MEESHO_ORIGIN,
          {
            name: c.name || key,
            value: c.value,
            domain: c.domain || 'supplier.meesho.com',
            path: c.path || '/',
            secure: c.secure !== false,
            httpOnly: c.httpOnly === true,
          },
          wk,
        );
      } catch {
        // ignore individual cookie failures
      }
    }

    await CookieManager.flush();
  } catch {
    // Best-effort: native cookie store or storage may be unavailable.
  }
}

export async function captureSessionFromCookies() {
  const wk = cookieStoreUseWebKit();
  try {
    const cookies = await CookieManager.get(MEESHO_ORIGIN, wk);
    const snapshot = {
      cookies,
      savedAt: Date.now(),
    };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore
  }
}

export async function hasPersistedSession() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return false;
    }
    try {
      const { cookies } = JSON.parse(raw);
      if (!cookies || typeof cookies !== 'object') {
        return false;
      }
      return Object.keys(cookies).length > 0;
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}
