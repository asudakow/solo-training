const CACHE_NAME = 'solo-training-v1';
const ASSETS = [
  './index.html',
  './manifest.json'
];

// ====== INSTALL — кэшируем основные файлы ======
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(() => {});
    })
  );
  self.skipWaiting();
});

// ====== ACTIVATE — удаляем старые кэши ======
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ====== FETCH — отдаём из кэша, если офлайн ======
self.addEventListener('fetch', e => {
  // Только GET запросы, пропускаем внешние CDN при наличии сети
  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request)
      .then(response => {
        // Кэшируем свежие ответы для наших файлов
        if (e.request.url.includes(self.location.origin)) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Офлайн — отдаём из кэша
        return caches.match(e.request).then(cached => {
          if (cached) return cached;
          // Fallback для навигации
          if (e.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});

// ====== PUSH NOTIFICATIONS ======
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : {};
  const title = data.title || '⚔ Solo Training';
  const options = {
    body: data.body || 'Не забудь выполнить задания!',
    icon: 'https://i.ibb.co/0ywCVD9d/f8068834-5e59-4d9e-b419-0aca5f978191.png',
    badge: 'https://i.ibb.co/0ywCVD9d/f8068834-5e59-4d9e-b419-0aca5f978191.png',
    vibrate: [200, 100, 200, 100, 200],
    tag: 'solo-training',
    renotify: true,
    data: { url: self.location.origin }
  };
  e.waitUntil(self.registration.showNotification(title, options));
});

// ====== NOTIFICATION CLICK — открываем приложение ======
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow('./index.html');
    })
  );
});

// ====== MIDNIGHT CHECK — каждые 30 секунд проверяем полночь ======
// (основная логика в index.html, SW только для уведомлений когда приложение закрыто)
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SCHEDULE_MIDNIGHT') {
    // Приложение просит запланировать проверку
    scheduleMidnightCheck();
  }
});

let midnightTimer = null;
function scheduleMidnightCheck() {
  if (midnightTimer) clearTimeout(midnightTimer);
  const now = new Date();
  const midnight = new Date();
  midnight.setHours(24, 0, 5, 0); // 00:00:05 следующего дня
  const msUntilMidnight = midnight - now;

  midnightTimer = setTimeout(() => {
    // Отправляем уведомление о сбросе
    self.registration.showNotification('⚠ Система Solo Training', {
      body: 'Новый день начался. Проверь выполнение заданий и получи штрафное задание если что-то пропущено.',
      icon: 'https://i.ibb.co/0ywCVD9d/f8068834-5e59-4d9e-b419-0aca5f978191.png',
      badge: 'https://i.ibb.co/0ywCVD9d/f8068834-5e59-4d9e-b419-0aca5f978191.png',
      vibrate: [300, 100, 300, 100, 300],
      tag: 'solo-midnight',
      requireInteraction: true
    });
    // Перепланировать на следующую полночь
    scheduleMidnightCheck();
  }, msUntilMidnight);
}
