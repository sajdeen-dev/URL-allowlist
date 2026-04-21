import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView as RNWebView } from 'react-native-webview';
import {
  isUrlAllowed,
  MEESHO_HOME_URL,
  MEESHO_LOGIN_URL,
} from '../utils/whitelist';
import {
  captureSessionFromCookies,
  hasPersistedSession,
  restoreSessionCookies,
} from '../utils/sessionStore';

/**
 * Meesho is a SPA: most route changes use history.pushState, which does not
 * trigger onShouldStartLoadWithRequest. This runs before page scripts so the
 * History API is wrapped early; we also poll as a fallback.
 */
const SPA_URL_SYNC_JS = `
(function () {
  if (window.__ECOM_BUDDY_URL_SYNC__) return;
  window.__ECOM_BUDDY_URL_SYNC__ = true;
  function send() {
    try {
      if (!window.ReactNativeWebView) return;
      window.ReactNativeWebView.postMessage(JSON.stringify({
        type: 'ecBuddyUrl',
        href: window.location.href,
      }));
    } catch (e) {}
  }
  var ps = history.pushState;
  history.pushState = function () {
    ps.apply(history, arguments);
    setTimeout(send, 0);
  };
  var rs = history.replaceState;
  history.replaceState = function () {
    rs.apply(history, arguments);
    setTimeout(send, 0);
  };
  window.addEventListener('popstate', function () { setTimeout(send, 0); });
  window.addEventListener('hashchange', send);
  setInterval(send, 450);
  send();
})();
true;
`;

export default function MeeshoPanelWebView() {
  const [startUrl, setStartUrl] = useState(null);
  const webRef = useRef(null);
  const lastAllowedRef = useRef(MEESHO_LOGIN_URL);
  const redirectGateRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await restoreSessionCookies();
        const loggedIn = await hasPersistedSession();
        if (!cancelled) {
          const initial = loggedIn ? MEESHO_HOME_URL : MEESHO_LOGIN_URL;
          lastAllowedRef.current = initial;
          setStartUrl(initial);
        }
      } catch {
        if (!cancelled) {
          lastAllowedRef.current = MEESHO_LOGIN_URL;
          setStartUrl(MEESHO_LOGIN_URL);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistSession = useCallback(() => {
    captureSessionFromCookies().catch(() => {});
  }, []);

  const redirectToAllowed = useCallback((fallbackUrl) => {
    if (redirectGateRef.current) {
      return;
    }
    redirectGateRef.current = true;
    const target =
      fallbackUrl && isUrlAllowed(fallbackUrl)
        ? fallbackUrl
        : MEESHO_HOME_URL;
    const script = `window.location.replace(${JSON.stringify(target)}); true;`;
    webRef.current?.injectJavaScript(script);
    setTimeout(() => {
      redirectGateRef.current = false;
    }, 700);
  }, []);

  const reconcileDocumentUrl = useCallback(
    (url) => {
      if (!url || url === 'about:blank') {
        return;
      }
      if (isUrlAllowed(url)) {
        lastAllowedRef.current = url;
        return;
      }
      redirectToAllowed(lastAllowedRef.current);
    },
    [redirectToAllowed],
  );

  const onShouldStartLoadWithRequest = useCallback((request) => {
    return isUrlAllowed(request.url, request);
  }, []);

  const onMessage = useCallback(
    (event) => {
      let payload;
      try {
        payload = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      if (payload?.type !== 'ecBuddyUrl' || typeof payload.href !== 'string') {
        return;
      }
      reconcileDocumentUrl(payload.href);
    },
    [reconcileDocumentUrl],
  );

  const onNavigationStateChange = useCallback(
    (nav) => {
      if (nav?.url) {
        reconcileDocumentUrl(nav.url);
      }
      persistSession();
    },
    [reconcileDocumentUrl, persistSession],
  );

  const onOpenWindow = useCallback(
    (event) => {
      const target = event.nativeEvent?.targetUrl;
      if (!target || !isUrlAllowed(target)) {
        return;
      }
      webRef.current?.injectJavaScript(
        `window.location.href = ${JSON.stringify(target)}; true;`,
      );
    },
    [],
  );

  if (!startUrl) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <RNWebView
      ref={webRef}
      source={{ uri: startUrl }}
      style={styles.webview}
      onShouldStartLoadWithRequest={onShouldStartLoadWithRequest}
      onNavigationStateChange={onNavigationStateChange}
      onLoadEnd={persistSession}
      onMessage={onMessage}
      onOpenWindow={onOpenWindow}
      javaScriptEnabled
      domStorageEnabled
      sharedCookiesEnabled
      thirdPartyCookiesEnabled={Platform.OS === 'android'}
      cacheEnabled
      mediaCapturePermissionGrantType="grant"
      allowsInlineMediaPlayback
      geolocationEnabled={false}
      setSupportMultipleWindows={false}
      injectedJavaScriptBeforeContentLoaded={SPA_URL_SYNC_JS}
      injectedJavaScript={SPA_URL_SYNC_JS}
    />
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
  },
});
