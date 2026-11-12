/*
 * Hook — consentement cookies + Google Analytics 4.
 *
 * - Google Analytics n'est chargé QU'APRÈS acceptation explicite du visiteur.
 * - Le choix est stocké dans le cookie first-party "hook_consent" (6 mois),
 *   puis le bandeau est reproposé.
 * - "Gérer les cookies" : window.HookConsent.open() rouvre les préférences.
 * - Mesure uniquement sur le domaine de production (pas sur les préviews).
 */
(function () {
  var GA_ID = 'G-DEH7PSF5NN';
  var COOKIE = 'hook_consent';
  var MAX_AGE_DAYS = 182; // ~6 mois
  var PROD_HOSTS = /(^|\.)hookplateform\.com$/;

  var gaLoaded = false;
  var lastPath = null;

  /* ---------- cookie du choix ---------- */
  function readChoice() {
    var m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    if (!m) return null;
    try { return JSON.parse(decodeURIComponent(m[1])); } catch (e) { return null; }
  }
  function writeChoice(analytics) {
    var v = encodeURIComponent(JSON.stringify({ analytics: !!analytics, v: 1, ts: Date.now() }));
    document.cookie = COOKIE + '=' + v + '; Max-Age=' + (MAX_AGE_DAYS * 86400) + '; Path=/; SameSite=Lax' +
      (location.protocol === 'https:' ? '; Secure' : '');
  }

  /* ---------- Google Analytics ---------- */
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }

  function cleanPath() {
    // Routage par hash (#/dashboard). On n'envoie jamais de jeton ni de paramètre.
    var h = (location.hash || '').replace(/^#/, '') || '/';
    if (/access_token|refresh_token|type=recovery|token=/.test(h)) return '/auth/reset';
    h = h.split(/[?&]/)[0];
    if (h.charAt(0) !== '/') h = '/' + h;
    // Remplace les identifiants (uuid, nombres) pour regrouper les pages
    return h.replace(/\/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, '/:id').replace(/\/\d+(?=\/|$)/g, '/:id');
  }

  function sendPageView() {
    if (!gaLoaded) return;
    var p = cleanPath();
    if (p === lastPath) return;
    lastPath = p;
    gtag('event', 'page_view', {
      page_location: location.origin + p,
      page_path: p,
      page_title: document.title
    });
  }

  function loadGA() {
    if (gaLoaded || !PROD_HOSTS.test(location.hostname)) return;
    gaLoaded = true;
    window['ga-disable-' + GA_ID] = false;
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    gtag('js', new Date());
    gtag('config', GA_ID, { send_page_view: false });
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    sendPageView();
  }

  function disableGA() {
    window['ga-disable-' + GA_ID] = true;
    if (gaLoaded) gtag('consent', 'update', { analytics_storage: 'denied' });
    // Supprime les cookies _ga déjà déposés
    var host = location.hostname, parts = host.split('.');
    var domains = ['', host, '.' + host];
    if (parts.length > 2) domains.push('.' + parts.slice(-2).join('.'));
    document.cookie.split('; ').forEach(function (c) {
      var name = c.split('=')[0];
      if (name === '_ga' || name.indexOf('_ga_') === 0) {
        domains.forEach(function (d) {
          document.cookie = name + '=; Max-Age=0; Path=/' + (d ? '; Domain=' + d : '');
        });
      }
    });
  }

  function track(name, params) {
    if (gaLoaded && !window['ga-disable-' + GA_ID]) gtag('event', name, params || {});
  }

  /* ---------- bandeau + préférences ---------- */
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstChild; }

  function closeUI() {
    var b = document.getElementById('hc-banner'); if (b) b.remove();
    var m = document.getElementById('hc-modal'); if (m) m.remove();
  }

  function apply(analytics) {
    writeChoice(analytics);
    closeUI();
    if (analytics) loadGA(); else disableGA();
  }

  function showBanner() {
    if (document.getElementById('hc-banner')) return;
    var b = el(
      '<div id="hc-banner" class="hc-banner" role="dialog" aria-live="polite" aria-label="Cookies">' +
        '<div class="hc-text"><strong>Nous utilisons des cookies</strong>' +
        '<span>Certains sont indispensables au fonctionnement de Hook. Avec votre accord, nous utilisons aussi Google Analytics pour mesurer l\'audience et améliorer le site. ' +
        '<a href="#" data-hc="policy">En savoir plus</a></span></div>' +
        '<div class="hc-actions">' +
          '<button type="button" class="hc-btn hc-link" data-hc="custom">Personnaliser</button>' +
          '<button type="button" class="hc-btn" data-hc="refuse">Refuser</button>' +
          '<button type="button" class="hc-btn hc-primary" data-hc="accept">Accepter</button>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(b);
  }

  function openPrefs() {
    closeUI();
    var c = readChoice();
    var on = c ? !!c.analytics : false;
    var m = el(
      '<div id="hc-modal" class="hc-overlay" role="dialog" aria-modal="true" aria-label="Préférences cookies">' +
        '<div class="hc-sheet">' +
          '<div class="hc-title">Gérer les cookies</div>' +
          '<div class="hc-row"><div><strong>Indispensables</strong>' +
            '<span>Connexion à votre compte et mémorisation de votre choix de cookies.</span></div>' +
            '<span class="hc-always">Toujours actifs</span></div>' +
          '<label class="hc-row"><div><strong>Mesure d\'audience</strong>' +
            '<span>Google Analytics : nombre de visites, pages vues, provenance. Données agrégées, aucune publicité.</span></div>' +
            '<input type="checkbox" id="hc-analytics"' + (on ? ' checked' : '') + '><span class="hc-switch" aria-hidden="true"></span></label>' +
          '<div class="hc-actions">' +
            '<button type="button" class="hc-btn" data-hc="refuse">Tout refuser</button>' +
            '<button type="button" class="hc-btn hc-primary" data-hc="save">Enregistrer</button>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    document.body.appendChild(m);
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-hc]') : null;
    if (t) {
      e.preventDefault();
      var a = t.getAttribute('data-hc');
      if (a === 'accept') apply(true);
      else if (a === 'refuse') apply(false);
      else if (a === 'custom') openPrefs();
      else if (a === 'save') { var cb = document.getElementById('hc-analytics'); apply(cb && cb.checked); }
      else if (a === 'policy' && window.LandingModals) window.LandingModals.openConfidentialite();
      return;
    }
    var ov = document.getElementById('hc-modal');
    if (ov && e.target === ov) { ov.remove(); if (!readChoice()) showBanner(); return; }

    // Événements clés : clics sur les appels à l'action
    var btn = e.target.closest ? e.target.closest('button, .btn, a') : null;
    if (!btn) return;
    var label = (btn.textContent || '').replace(/\s+/g, ' ').trim();
    if (!label || label.length > 60) return;
    if (/^(Accéder à la démo|Essai gratuit|Envoyer mon premier SMS|Démarrer|Commencer|Créer mon compte|Parler à un conseiller)$/i.test(label)) {
      track('cta_click', { cta_label: label, page_path: cleanPath() });
    } else if (/^Lancer la campagne$/i.test(label)) {
      track('campaign_launch', { page_path: cleanPath() });
    }
  });

  window.addEventListener('hashchange', function () { setTimeout(sendPageView, 50); });

  /* Inscription / connexion réussies (sans aucune donnée personnelle) */
  function wrapAuth() {
    var A = window.HookAuth;
    if (!A || A._hcWrapped) return;
    A._hcWrapped = true;
    if (typeof A.signUp === 'function') {
      var su = A.signUp;
      A.signUp = function (email, pwd, data, cb) {
        return su.call(A, email, pwd, data, function (err, res) {
          if (!err) track('sign_up', { method: 'email' });
          if (cb) return cb.apply(this, arguments);
        });
      };
    }
    if (typeof A.signIn === 'function') {
      var si = A.signIn;
      A.signIn = function () {
        var args = Array.prototype.slice.call(arguments);
        var cb = args[args.length - 1];
        if (typeof cb === 'function') {
          args[args.length - 1] = function (err) {
            if (!err) track('login', { method: 'email' });
            return cb.apply(this, arguments);
          };
        }
        return si.apply(A, args);
      };
    }
  }

  window.HookConsent = {
    open: openPrefs,
    track: track,
    hasAnalytics: function () { var c = readChoice(); return !!(c && c.analytics); }
  };

  function init() {
    wrapAuth();
    var c = readChoice();
    if (!c) showBanner();
    else if (c.analytics) loadGA();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
