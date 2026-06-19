window.HookPush = {
  VAPID_PUBLIC: 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjZkisx8htugdxnduxO-FbT6k',

  _urlBase64ToUint8: function(base64String) {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);
    for (var i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
    return outputArray;
  },

  init: function() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    var self = this;
    navigator.serviceWorker.register('/sw.js').then(function(reg) {
      self._registration = reg;
      // Ask for permission if not already granted
      if (Notification.permission === 'default') {
        setTimeout(function() { self._askPermission(); }, 3000);
      } else if (Notification.permission === 'granted') {
        self._subscribe();
      }
    }).catch(function(e) { console.warn('SW error:', e); });
  },

  _askPermission: function() {
    var self = this;
    Notification.requestPermission().then(function(p) {
      if (p === 'granted') self._subscribe();
    });
  },

  _subscribe: function() {
    var self = this;
    if (!self._registration) return;
    self._registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: self._urlBase64ToUint8(self.VAPID_PUBLIC)
    }).then(function(sub) {
      var json = sub.toJSON();
      var userId = window.HookAuth.user && window.HookAuth.user.id;
      if (!userId) return;
      window.DB.from('push_subscriptions').upsert({
        user_id: userId,
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        auth: json.keys.auth
      }, { onConflict: 'user_id,endpoint' }).then(function(){});
    }).catch(function(){});
  }
};
