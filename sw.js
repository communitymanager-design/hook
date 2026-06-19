self.addEventListener('push', function(event) {
  var data = event.data ? event.data.json() : {};
  var title = data.title || 'Hook';
  var options = {
    body: data.body || '',
    icon: 'https://ik.imagekit.io/dkeqnflsg/HOOK%20ICON%20COLOR%20(1).png?updatedAt=1781142267098&tr=w-192,h-192,cm-pad_resize,bg-0B3828',
    badge: 'https://ik.imagekit.io/dkeqnflsg/HOOK%20ICON%20COLOR%20(1).png?updatedAt=1781142267098&tr=w-192,h-192,cm-pad_resize,bg-0B3828',
    data: { url: data.url || '/' },
    vibrate: [200, 100, 200]
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(clients.openWindow(url));
});
