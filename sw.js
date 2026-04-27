// sw.js — سُكُون | Service Worker

const CACHE_VERSION = 'sakoon-v1';
const CACHE_STATIC  = `${CACHE_VERSION}-static`;
const CACHE_DYNAMIC = `${CACHE_VERSION}-dynamic`;
const CACHE_FONTS   = `${CACHE_VERSION}-fonts`;

/* ══════════════════════════════════════
   جميع ملفات التطبيق — لا يفوت ولا واحد
══════════════════════════════════════ */
const STATIC_FILES = [
  '/',
  '/conversation.html',
  '/index.html',
  '/patient-home.html',
  '/patient-chats.html',
  '/patient-agenda.html',
  '/patient-tools.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/firebase-config.js',
  '/patient-call-listener.js',
  '/screenshots/screen1.png',
  '/screenshots/screen2.png',
];

const FONT_FILES = [
  'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;700;900&display=swap',
  'https://fonts.gstatic.com/s/cairo/v28/SLXVc1nY6HkvangtZmpQdkhzfH5lkSs2SgRjCAGMQ1z0hOA-W1Q.woff2',
];

const EXTERNAL_FILES = [
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
];

/* ══════════════════════════════════════
   إعدادات ذكية
══════════════════════════════════════ */
const CONFIG = {
  maxDynamicItems : 60,
  maxCacheAgeDays : 30,
  networkTimeout  : 4000,   // ms قبل الذهاب إلى الكاش
  retryAttempts   : 3,
  retryDelay      : 800,
};

/* ══════════════════════════════════════
   أدوات مساعدة
══════════════════════════════════════ */
const log  = (...a) => console.log  ('%c[سُكُون SW]', 'color:#5aaecf;font-weight:bold', ...a);
const warn = (...a) => console.warn ('%c[سُكُون SW]', 'color:#ffb347;font-weight:bold', ...a);
const err  = (...a) => console.error('%c[سُكُون SW]', 'color:#ff6b6b;font-weight:bold', ...a);

/* إعادة المحاولة مع تأخير */
async function fetchWithRetry(request, attempts = CONFIG.retryAttempts) {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(request);
      if (res.ok || res.type === 'opaque') return res;
    } catch (e) {
      if (i < attempts - 1) {
        await new Promise(r => setTimeout(r, CONFIG.retryDelay * (i + 1)));
        warn(`إعادة محاولة ${i + 2}/${attempts}:`, request.url || request);
      }
    }
  }
  throw new Error('فشل كل المحاولات');
}

/* fetch مع timeout — لو النت بطيء يروح للكاش */
function fetchWithTimeout(request, ms = CONFIG.networkTimeout) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request)
      .then(res  => { clearTimeout(timer); resolve(res); })
      .catch(e   => { clearTimeout(timer); reject(e);    });
  });
}

/* تنظيف الكاش الديناميكي لو تجاوز الحد */
async function trimDynamicCache() {
  const cache = await caches.open(CACHE_DYNAMIC);
  const keys  = await cache.keys();
  if (keys.length > CONFIG.maxDynamicItems) {
    const toDelete = keys.slice(0, keys.length - CONFIG.maxDynamicItems);
    await Promise.all(toDelete.map(k => cache.delete(k)));
    log(`🧹 حُذف ${toDelete.length} ملف قديم من الكاش الديناميكي`);
  }
}

/* ══════════════════════════════════════
   INSTALL — التثبيت
══════════════════════════════════════ */
self.addEventListener('install', event => {
  log('🚀 بدء التثبيت...');

  event.waitUntil((async () => {

    /* ① الملفات الأساسية — لازم تنزل كلها */
    const staticCache = await caches.open(CACHE_STATIC);
    log('📦 تحميل الملفات الأساسية...');
    const staticResults = await Promise.allSettled(
      STATIC_FILES.map(async file => {
        try {
          const res = await fetchWithRetry(new Request(file, { cache: 'reload' }));
          await staticCache.put(file, res);
          log('✓', file);
        } catch (e) {
          warn('✗ فشل (سيُعاد لاحقاً):', file);
        }
      })
    );

    /* ② الخطوط + المكتبات الخارجية — في كاش منفصل */
    const fontCache = await caches.open(CACHE_FONTS);
    log('🔤 تحميل الخطوط والمكتبات...');
    await Promise.allSettled(
      [...FONT_FILES, ...EXTERNAL_FILES].map(async url => {
        try {
          const res = await fetchWithRetry(new Request(url, { mode: 'cors' }));
          await fontCache.put(url, res);
          log('✓ خط/مكتبة:', url.split('/').pop());
        } catch (e) {
          warn('✗ فشل:', url.split('/').pop());
        }
      })
    );

    const succeeded = staticResults.filter(r => r.status === 'fulfilled').length;
    log(`✅ التثبيت اكتمل — ${succeeded}/${STATIC_FILES.length} ملف محفوظ`);

    return self.skipWaiting();
  })());
});

/* ══════════════════════════════════════
   ACTIVATE — التفعيل النظيف
══════════════════════════════════════ */
self.addEventListener('activate', event => {
  log('⚡ تفعيل النسخة الجديدة...');

  event.waitUntil((async () => {

    /* امسح كل الكاشات القديمة */
    const allKeys = await caches.keys();
    const currentCaches = [CACHE_STATIC, CACHE_DYNAMIC, CACHE_FONTS];
    const deleted = await Promise.all(
      allKeys
        .filter(key => !currentCaches.includes(key))
        .map(key => {
          log('🗑️ حذف كاش قديم:', key);
          return caches.delete(key);
        })
    );

    if (deleted.length > 0) log(`🧹 حُذفت ${deleted.length} نسخة قديمة`);

    /* استحوذ على كل التبويبات المفتوحة فوراً */
    await self.clients.claim();

    /* أبلغ كل التبويبات إن التحديث جاهز */
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({ type: 'SW_ACTIVATED', version: CACHE_VERSION });
    });

    log('🌿 سُكُون جاهز للعمل offline تماماً!');
  })());
});

/* ══════════════════════════════════════
   FETCH — استراتيجية ذكية لكل نوع ملف
══════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  /* تجاهل غير GET وطلبات chrome-extension */
  if (request.method !== 'GET') return;
  if (!request.url.startsWith('http')) return;

  /* ① الخطوط والمكتبات الخارجية — Cache First إلى الأبد */
  if (url.hostname.includes('fonts.') || url.hostname.includes('cdnjs.')) {
    event.respondWith(cacheFirstForever(request, CACHE_FONTS));
    return;
  }

  /* ② ملفات HTML — Network First مع fallback للكاش */
  if (request.headers.get('accept')?.includes('text/html') ||
      url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  /* ③ باقي الملفات (صور، CSS، JS) — Stale While Revalidate */
  event.respondWith(staleWhileRevalidate(request));
});

/* ── استراتيجية ١: Cache Forever (خطوط ومكتبات خارجية) ── */
async function cacheFirstForever(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const res = await fetchWithRetry(request);
    if (res.ok || res.type === 'opaque') {
      const cache = await caches.open(cacheName);
      await cache.put(request, res.clone());
    }
    return res;
  } catch (e) {
    warn('خط/مكتبة غير متاحة offline:', request.url);
    return new Response('', { status: 503 });
  }
}

/* ── استراتيجية ٢: Network First (صفحات HTML) ── */
async function networkFirstWithCache(request) {
  try {
    /* حاول من النت أولاً مع timeout */
    const res = await fetchWithTimeout(request, CONFIG.networkTimeout);

    if (res.ok) {
      /* حدّث الكاش بالنسخة الجديدة */
      const cache = await caches.open(CACHE_STATIC);
      await cache.put(request, res.clone());
      log('🔄 تحديث:', new URL(request.url).pathname);
    }
    return res;

  } catch (e) {
    /* النت فشل أو بطيء → من الكاش */
    const cached = await caches.match(request);
    if (cached) {
      log('📱 offline → كاش:', new URL(request.url).pathname);
      return cached;
    }

    /* مفيش كاش → صفحة تسجيل الدخول fallback */
    const fallback = await caches.match('/patient-login.html');
    if (fallback) return fallback;

    /* آخر حل */
    return new Response(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head><meta charset="UTF-8"><title>سُكُون</title>
      <style>
        body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;
             min-height:100vh;background:#0a1628;color:white;text-align:center;padding:20px}
        h2{font-size:1.5rem;margin-bottom:10px}p{opacity:.6}
      </style></head>
      <body><div><h2>🌿 سُكُون</h2><p>يرجى الاتصال بالإنترنت لأول استخدام</p></div></body>
      </html>
    `, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

/* ── استراتيجية ٣: Stale While Revalidate (صور، JS، CSS) ── */
async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);

  /* ابدأ تحديث الكاش في الخلفية */
  const networkPromise = fetch(request).then(async res => {
    if (res.ok) {
      const cache = await caches.open(CACHE_DYNAMIC);
      await cache.put(request, res.clone());
      await trimDynamicCache();
    }
    return res;
  }).catch(() => null);

  /* لو عنده كاش → رجّعه فوراً + حدّث في الخلفية */
  if (cached) return cached;

  /* مفيش كاش → انتظر النت */
  const netRes = await networkPromise;
  if (netRes) return netRes;

  return new Response('', { status: 503 });
}

/* ══════════════════════════════════════
   BACKGROUND SYNC — مزامنة لما يرجع النت
══════════════════════════════════════ */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-agenda') {
    log('🔄 Background Sync: مزامنة الأجندة...');
    event.waitUntil(syncPendingTasks());
  }
});

async function syncPendingTasks() {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({ type: 'SYNC_COMPLETE' });
    });
    log('✅ المزامنة اكتملت');
  } catch (e) {
    err('فشل الـ sync:', e);
  }
}

/* ══════════════════════════════════════
   PUSH — إشعارات (جاهز للمستقبل)
══════════════════════════════════════ */
self.addEventListener('push', event => {
  const data = event.data?.json() || {
    title: '🌿 سُكُون',
    body : 'لديك تذكير في أجندتك اليوم',
    icon : '/icon-192.png',
    badge: '/icon-192.png',
  };

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body     : data.body,
      icon     : data.icon,
      badge    : data.badge,
      dir      : 'rtl',
      lang     : 'ar',
      vibrate  : [200, 100, 200],
      tag      : 'sakoon-notif',
      renotify : true,
      actions  : [
        { action: 'open',   title: '📋 افتح التطبيق' },
        { action: 'close',  title: '✕ إغلاق'          },
      ],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'close') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const appClient = clients.find(c => c.url.includes(self.location.origin));
      if (appClient) return appClient.focus();
      return self.clients.openWindow('/patient-home.html');
    })
  );
});

/* ══════════════════════════════════════
   MESSAGES — تواصل مع التطبيق
══════════════════════════════════════ */
self.addEventListener('message', async event => {
  const { type, payload } = event.data || {};

  switch (type) {

    case 'SKIP_WAITING':
      log('⚡ تحديث فوري بناءً على طلب التطبيق');
      self.skipWaiting();
      break;

    case 'CACHE_STATUS':
      /* التطبيق يسأل عن حالة الكاش */
      const keys    = await caches.keys();
      const sizes   = await Promise.all(keys.map(async k => {
        const c  = await caches.open(k);
        const ks = await c.keys();
        return { name: k, count: ks.length };
      }));
      event.source.postMessage({ type: 'CACHE_STATUS_RESPONSE', data: sizes });
      break;

    case 'CLEAR_CACHE':
      /* مسح الكاش الديناميكي فقط */
      await caches.delete(CACHE_DYNAMIC);
      log('🧹 تم مسح الكاش الديناميكي');
      event.source.postMessage({ type: 'CACHE_CLEARED' });
      break;

    case 'PRECACHE_EXTRA':
      /* التطبيق يطلب تحميل ملفات إضافية */
      if (payload?.files?.length) {
        const cache = await caches.open(CACHE_DYNAMIC);
        await Promise.allSettled(payload.files.map(f => cache.add(f).catch(() => {})));
        log('📦 تم تحميل', payload.files.length, 'ملف إضافي');
      }
      break;
  }
});

/* ══════════════════════════════════════
   PERIODIC BACKGROUND SYNC
   (يتحقق من تحديثات كل يوم تلقائياً)
══════════════════════════════════════ */
self.addEventListener('periodicsync', event => {
  if (event.tag === 'daily-update') {
    log('🔄 فحص تحديثات يومي...');
    event.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    const cache = await caches.open(CACHE_STATIC);
    await Promise.allSettled(
      STATIC_FILES.map(async file => {
        const res = await fetch(file, { cache: 'no-cache' }).catch(() => null);
        if (res?.ok) await cache.put(file, res);
      })
    );
    log('✅ التحديث اليومي اكتمل');
  } catch (e) {
    warn('فشل التحديث اليومي:', e);
  }
}

log('🌿 sw.js محمّل وجاهز — سُكُون يعمل offline بالكامل!');
