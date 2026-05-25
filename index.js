// Must use require() here so polyfill runs before any module is imported
// URL.protocol is not implemented in Hermes / RN 0.76 bridgeless new architecture
if (typeof URL !== 'undefined') {
  const missingProps = ['protocol', 'host', 'hostname', 'port', 'pathname', 'search', 'hash', 'origin'];
  missingProps.forEach((prop) => {
    if (!(prop in URL.prototype)) {
      Object.defineProperty(URL.prototype, prop, {
        get() { return ''; },
        configurable: true,
      });
    }
  });
}

const { registerRootComponent } = require('expo');
const { default: App } = require('./App');

registerRootComponent(App);
