window.Updater = {
  current: null,
  POLL_MS: 15000,

  init: function() {
    var self = this;

    // Enregistrer le Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(function(reg) {
          reg.addEventListener('updatefound', function() {
            var newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', function() {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  newWorker.postMessage('skipWaiting');
                }
              });
            }
          });
        })
        .catch(function() {});
    }

    // Polling version.json
    self._fetch(function(v) { self.current = v; });

    setInterval(function() {
      self._fetch(function(v) {
        if (self.current && v && v !== self.current) {
          self.current = v;
          self._reload();
        }
      });
    }, self.POLL_MS);
  },

  _fetch: function(cb) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', '/version.json?_=' + Date.now(), true);
    xhr.setRequestHeader('Cache-Control', 'no-cache, no-store');
    xhr.setRequestHeader('Pragma', 'no-cache');
    xhr.onload = function() {
      try { cb(JSON.parse(xhr.responseText).v); } catch(e) {}
    };
    xhr.onerror = function() {};
    xhr.send(null);
  },

  _reload: function() {
    if (window.Toast) window.Toast.info('Nouvelle version disponible...');
    var hash = window.location.hash;
    setTimeout(function() {
      // Vider le cache du SW puis recharger
      if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        caches.keys().then(function(keys) {
          return Promise.all(keys.map(function(k) { return caches.delete(k); }));
        }).then(function() {
          window.location.href = '/' + (hash || '');
        });
      } else {
        window.location.href = '/' + (hash || '');
      }
    }, 1500);
  }
};
