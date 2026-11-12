// Outils partages par les pages du back-office (/Nkololopangohook/*)
window.AdminUI = {
  esc: function(s) {
    return window.Helpers.escapeHtml(s == null ? '' : String(s));
  },

  name: function(u) {
    if (!u) return 'Sans nom';
    return ((u.prenom || '') + ' ' + (u.nom || '')).trim() || 'Sans nom';
  },

  initials: function(name) {
    if (!name || name === 'Sans nom') return '?';
    return name.split(' ').map(function(w) { return w[0] || ''; }).join('').slice(0, 2).toUpperCase();
  },

  avatar: function(name, size) {
    size = size || 28;
    return '<div class="admin-avatar-sm" style="width:' + size + 'px;height:' + size + 'px">' + this.initials(name) + '</div>';
  },

  identity: function(u, sub) {
    var name = this.name(u);
    return '<div class="admin-identity">' + this.avatar(name) +
      '<div style="min-width:0"><div class="admin-identity-name">' + this.esc(name) + '</div>' +
      '<div class="admin-identity-sub">' + this.esc(sub != null ? sub : (u && u.email) || '') + '</div></div>' +
      '</div>';
  },

  num: function(n) {
    return (n || 0).toLocaleString('fr-FR');
  },

  fcfa: function(n) {
    return (Math.round(n || 0)).toLocaleString('fr-FR') + ' FCFA';
  },

  date: function(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  },

  dateTime: function(d) {
    if (!d) return '-';
    var x = new Date(d);
    return x.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' ' +
      x.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
  },

  ago: function(d) {
    if (!d) return '-';
    var diff = Date.now() - new Date(d).getTime();
    var min = Math.floor(diff / 60000);
    if (min < 1) return 'À l\'instant';
    if (min < 60) return 'Il y a ' + min + ' min';
    var h = Math.floor(min / 60);
    if (h < 24) return 'Il y a ' + h + 'h';
    var j = Math.floor(h / 24);
    if (j === 1) return 'Hier';
    if (j < 30) return 'Il y a ' + j + 'j';
    return 'Le ' + this.date(d);
  },

  daysSince: function(d) {
    if (!d) return Infinity;
    return (Date.now() - new Date(d).getTime()) / 86400000;
  },

  loading: function() {
    return '<div class="admin-page-wrapper"><div style="padding:40px;text-align:center;color:var(--admin-text-muted)">Chargement...</div></div>';
  },

  empty: function(msg) {
    return '<div class="admin-empty">' + msg + '</div>';
  },

  header: function(breadcrumb, title, subtitle, actions) {
    return '<div class="admin-page-header">' +
      '<div>' +
      '<div class="admin-breadcrumb">' + breadcrumb + '</div>' +
      '<div class="admin-page-title">' + title + '</div>' +
      (subtitle ? '<div class="admin-page-subtitle">' + subtitle + '</div>' : '') +
      '</div>' +
      (actions ? '<div class="admin-header-actions">' + actions + '</div>' : '') +
      '</div>';
  },

  kpi: function(label, val, sub, type, route) {
    var subColor = type === 'up' ? '#1D9E75' : type === 'down' ? '#A32D2D' : '#854F0B';
    var bg = type === 'warn' ? 'background:rgba(133,79,11,0.08)' : type === 'down' ? 'background:rgba(163,45,45,0.06)' : '';
    return '<div class="admin-kpi-card' + (route ? '' : ' admin-kpi-static') + '" style="' + bg + '"' +
      (route ? ' onclick="window.Router.navigate(\'' + route + '\')"' : '') + '>' +
      '<div class="admin-kpi-label">' + label + '</div>' +
      '<div class="admin-kpi-value">' + val + '</div>' +
      (sub ? '<div class="admin-kpi-sub" style="color:' + subColor + '">' + sub + '</div>' : '') +
      '</div>';
  },

  tabs: function(items, active, attr) {
    return '<div class="asd-tabs">' + items.map(function(t) {
      return '<button class="asd-tab ' + (t.key === active ? 'active' : '') + '" ' + attr + '="' + t.key + '">' + t.label +
        (t.count != null ? ' <span class="asd-tab-count">' + t.count + '</span>' : '') + '</button>';
    }).join('') + '</div>';
  },

  // Barres horizontales simples (une seule couleur, valeurs ecrites en clair)
  bars: function(rows, opts) {
    opts = opts || {};
    if (!rows.length) return this.empty(opts.empty || 'Pas encore de données.');
    var max = rows.reduce(function(m, r) { return Math.max(m, r.value); }, 0) || 1;
    var self = this;
    return '<div class="admin-bars">' + rows.map(function(r) {
      var pct = Math.max(2, Math.round(r.value / max * 100));
      return '<div class="admin-bar-row">' +
        '<div class="admin-bar-label" title="' + self.esc(r.label) + '">' + self.esc(r.label) + '</div>' +
        '<div class="admin-bar-track"><div class="admin-bar-fill" style="width:' + (r.value ? pct : 0) + '%"></div></div>' +
        '<div class="admin-bar-val">' + (opts.format ? opts.format(r.value) : self.num(r.value)) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  },

  // Histogramme vertical par periode
  columns: function(rows, opts) {
    opts = opts || {};
    var max = rows.reduce(function(m, r) { return Math.max(m, r.value); }, 0) || 1;
    var self = this;
    return '<div class="admin-cols">' + rows.map(function(r) {
      var pct = Math.round(r.value / max * 100);
      return '<div class="admin-col" title="' + self.esc(r.label) + ' : ' + self.num(r.value) + '">' +
        '<div class="admin-col-val">' + (r.value ? self.num(r.value) : '') + '</div>' +
        '<div class="admin-col-track"><div class="admin-col-fill" style="height:' + (r.value ? Math.max(3, pct) : 0) + '%"></div></div>' +
        '<div class="admin-col-label">' + self.esc(r.short || r.label) + '</div>' +
        '</div>';
    }).join('') + '</div>';
  },

  // Regroupe des dates par semaine (lundi) sur les n dernieres semaines
  weekly: function(items, getDate, getValue, weeks) {
    weeks = weeks || 12;
    var monday = new Date();
    monday.setHours(0, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    var buckets = [];
    for (var i = weeks - 1; i >= 0; i--) {
      var start = new Date(monday);
      start.setDate(start.getDate() - i * 7);
      buckets.push({
        start: start.getTime(),
        label: 'Semaine du ' + start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        short: start.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }),
        value: 0
      });
    }
    var first = buckets[0].start;
    items.forEach(function(it) {
      var d = getDate(it);
      if (!d) return;
      var t = new Date(d).getTime();
      if (t < first) return;
      var idx = Math.min(buckets.length - 1, Math.floor((t - first) / (7 * 86400000)));
      buckets[idx].value += getValue ? getValue(it) : 1;
    });
    return buckets;
  },

  statusTag: function(map, value) {
    var m = map[value] || { label: value || '-', cls: 'admin-tag-neutral' };
    return '<span class="admin-tag ' + m.cls + '">' + m.label + '</span>';
  },

  confirm: function(opts, onOk) {
    window.Helpers.openModal(
      '<div class="modal-box">' +
      '<div class="modal-title' + (opts.danger ? ' modal-title-danger' : '') + '">' + opts.title + '</div>' +
      '<div class="modal-desc">' + opts.message + '</div>' +
      '<div class="modal-actions">' +
      '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
      '<button class="btn ' + (opts.danger ? 'btn-danger-solid' : 'btn-primary') + '" id="admin-confirm-ok">' + (opts.ok || 'Confirmer') + '</button>' +
      '</div>' +
      '</div>'
    );
    document.getElementById('admin-confirm-ok').addEventListener('click', function() {
      onOk(this);
    });
  },

  // Journalise l'entree dans le back-office (une fois par session d'onglet)
  trackAdminSession: function() {
    var u = window.HookAuth && window.HookAuth.user;
    if (!u || !window.DB) return;
    var key = 'hook_admin_session_' + u.id;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch (e) {}
    window.DB.from('admin_connections').insert({
      user_id: u.id,
      email: u.email || null,
      user_agent: (navigator.userAgent || '').slice(0, 300)
    }).then(function() {}, function() {});
  },

  canManage: function() {
    return window.HookAuth && window.HookAuth.isSuperAdmin && window.HookAuth.isSuperAdmin();
  }
};
