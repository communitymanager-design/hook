// Logs & Monitoring : actions de l'équipe admin (audit_logs) et erreurs API (api_errors)
window.PageAdminLogs = {
  tab: 'audit',
  period: '7',
  search: '',
  data: null,

  ACTIONS: {
    sender_id_approved: { label: 'Sender ID approuvé', cls: 'admin-tag-success' },
    sender_id_rejected: { label: 'Sender ID refusé', cls: 'admin-tag-danger' },
    sender_id_suspended: { label: 'Sender ID suspendu', cls: 'admin-tag-warn' },
    sender_id_blocked: { label: 'Sender ID bloqué', cls: 'admin-tag-danger' },
    sender_id_reactivated: { label: 'Sender ID réactivé', cls: 'admin-tag-success' },
    sender_id_deleted: { label: 'Sender ID supprimé', cls: 'admin-tag-danger' },
    user_blocked: { label: 'Compte bloqué', cls: 'admin-tag-danger' },
    user_unblocked: { label: 'Compte débloqué', cls: 'admin-tag-success' },
    user_role_changed: { label: 'Rôle modifié', cls: 'admin-tag-warn' },
    user_updated: { label: 'Compte modifié', cls: 'admin-tag-neutral' },
    user_deleted: { label: 'Compte supprimé', cls: 'admin-tag-danger' },
    client_nudged: { label: 'Client relancé', cls: 'admin-tag-blue' },
    credits_adjusted: { label: 'Crédits ajustés', cls: 'admin-tag-warn' },
    system_notification_sent: { label: 'Notification système', cls: 'admin-tag-blue' },
    team_member_added: { label: 'Membre ajouté', cls: 'admin-tag-success' },
    team_member_removed: { label: 'Membre retiré', cls: 'admin-tag-danger' }
  },

  render: function() {
    this.search = '';
    window.Helpers.renderPage(window.AdminUI.loading());
    this._load();
  },

  _cutoff: function() {
    if (this.period === 'all') return null;
    var d = new Date();
    d.setDate(d.getDate() - parseInt(this.period, 10));
    return d.toISOString();
  },

  _load: function() {
    var self = this;
    var cutoff = this._cutoff();
    var auditQ = window.DB.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(500);
    var errQ = window.DB.from('api_errors').select('id,type,message,context,organization_id,created_at').order('created_at', { ascending: false }).limit(500);
    var connQ = window.DB.from('admin_connections').select('id,user_id,email,user_agent,created_at').order('created_at', { ascending: false }).limit(300);
    if (cutoff) { auditQ = auditQ.gte('created_at', cutoff); errQ = errQ.gte('created_at', cutoff); connQ = connQ.gte('created_at', cutoff); }

    Promise.all([auditQ, errQ, connQ]).then(function(r) {
      var audit = r[0].data || [];
      var errors = r[1].data || [];
      var userIds = [];
      audit.forEach(function(l) {
        if (l.actor_id && userIds.indexOf(l.actor_id) === -1) userIds.push(l.actor_id);
        if (l.target_user_id && userIds.indexOf(l.target_user_id) === -1) userIds.push(l.target_user_id);
      });
      var orgIds = errors.map(function(e) { return e.organization_id; }).filter(function(id, i, a) { return id && a.indexOf(id) === i; });

      Promise.all([
        userIds.length ? window.DB.from('users').select('id,prenom,nom,email').in('id', userIds) : Promise.resolve({ data: [] }),
        orgIds.length ? window.DB.from('organizations').select('id,nom').in('id', orgIds) : Promise.resolve({ data: [] })
      ]).then(function(r2) {
        var users = {};
        (r2[0].data || []).forEach(function(u) { users[u.id] = u; });
        var orgs = {};
        (r2[1].data || []).forEach(function(o) { orgs[o.id] = o; });
        self.data = { audit: audit, errors: errors, conns: r[2].data || [], users: users, orgs: orgs, auditError: r[0].error, errError: r[1].error, connError: r[2].error };
        self._render();
      });
    }).catch(function() {
      self.data = { audit: [], errors: [], conns: [], users: {}, orgs: {} };
      self._render();
    });
  },

  _details: function(l) {
    var d = l.details || l.metadata || {};
    var parts = [];
    if (d.name) parts.push(d.name);
    if (d.email) parts.push(d.email);
    if (d.old_role || d.new_role) parts.push((d.old_role || '?') + ' → ' + (d.new_role || '?'));
    if (d.note) parts.push('Motif : ' + d.note);
    if (d.titre) parts.push('« ' + d.titre + ' »');
    if (d.destinataires != null) parts.push(d.destinataires + ' destinataire' + (d.destinataires > 1 ? 's' : ''));
    if (d.canal) parts.push('via ' + d.canal);
    if (d.avant != null && d.apres != null) parts.push(d.avant + ' → ' + d.apres + ' SMS');
    return parts.join(' · ');
  },

  _render: function() {
    var UI = window.AdminUI;
    var self = this;
    var d = this.data;
    var s = this.search.toLowerCase();

    var errors24 = d.errors.filter(function(e) { return UI.daysSince(e.created_at) <= 1; }).length;
    var types = {};
    d.errors.forEach(function(e) { types[e.type || 'inconnu'] = (types[e.type || 'inconnu'] || 0) + 1; });
    var topType = Object.keys(types).sort(function(a, b) { return types[b] - types[a]; })[0];

    var body;
    if (this.tab === 'audit') {
      var list = d.audit.filter(function(l) {
        if (!s) return true;
        var actor = d.users[l.actor_id], target = d.users[l.target_user_id];
        return ((l.action || '') + ' ' + UI.name(actor) + ' ' + UI.name(target) + ' ' + JSON.stringify(l.details || {})).toLowerCase().indexOf(s) !== -1;
      });
      body = d.auditError ? UI.empty('Lecture du journal impossible : ' + UI.esc(d.auditError.message)) :
        !list.length ? UI.empty('Aucune action enregistrée sur la période.') :
        '<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Date</th><th>Action</th><th>Par</th><th>Client concerné</th><th>Détails</th></tr></thead><tbody>' +
        list.map(function(l) {
          var actor = d.users[l.actor_id], target = d.users[l.target_user_id];
          return '<tr>' +
            '<td style="white-space:nowrap;color:var(--admin-text-secondary)">' + UI.dateTime(l.created_at) + '</td>' +
            '<td>' + UI.statusTag(self.ACTIONS, l.action) + '</td>' +
            '<td>' + (actor ? UI.esc(UI.name(actor)) : '<span style="color:var(--admin-text-muted)">Système</span>') + '</td>' +
            '<td>' + (target ? UI.esc(UI.name(target)) + '<div class="admin-identity-sub">' + UI.esc(target.email || '') + '</div>' : '-') + '</td>' +
            '<td style="color:var(--admin-text-secondary)">' + UI.esc(self._details(l)) + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    } else if (this.tab === 'connexions') {
      var conns = d.conns.filter(function(c) {
        return !s || ((c.email || '') + ' ' + (c.user_agent || '')).toLowerCase().indexOf(s) !== -1;
      });
      body = d.connError ? UI.empty('Lecture des connexions impossible : ' + UI.esc(d.connError.message)) :
        !conns.length ? UI.empty('Aucune connexion au back-office sur la période.') :
        '<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Date</th><th>Membre</th><th>Appareil</th></tr></thead><tbody>' +
        conns.map(function(c) {
          var ua = c.user_agent || '';
          var device = /iPhone|Android|Mobile/i.test(ua) ? 'Mobile' : 'Ordinateur';
          var browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Navigateur';
          return '<tr>' +
            '<td style="white-space:nowrap;color:var(--admin-text-secondary)">' + UI.dateTime(c.created_at) + '</td>' +
            '<td>' + UI.esc(c.email || '-') + '</td>' +
            '<td style="color:var(--admin-text-secondary)" title="' + UI.esc(ua) + '">' + device + ' · ' + browser + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    } else {
      var errs = d.errors.filter(function(e) {
        if (!s) return true;
        var org = d.orgs[e.organization_id];
        return ((e.type || '') + ' ' + (e.message || '') + ' ' + (org ? org.nom : '')).toLowerCase().indexOf(s) !== -1;
      });
      body = d.errError ? UI.empty('Lecture des erreurs impossible : ' + UI.esc(d.errError.message)) :
        !errs.length ? UI.empty('Aucune erreur API sur la période.') :
        '<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Date</th><th>Type</th><th>Message</th><th>Client</th><th></th></tr></thead><tbody>' +
        errs.map(function(e) {
          var org = d.orgs[e.organization_id];
          return '<tr>' +
            '<td style="white-space:nowrap;color:var(--admin-text-secondary)">' + UI.dateTime(e.created_at) + '</td>' +
            '<td><span class="admin-tag admin-tag-danger">' + UI.esc(e.type || 'inconnu') + '</span></td>' +
            '<td style="max-width:420px">' + UI.esc(e.message || '-') + '</td>' +
            '<td>' + (org ? UI.esc(org.nom) : '-') + '</td>' +
            '<td style="text-align:right">' + (e.context ? '<button class="admin-btn-sm alog-ctx" data-id="' + e.id + '">Contexte</button>' : '') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
      UI.header('Technique', 'Logs & Monitoring', 'Actions de l\'équipe, erreurs des services SMS et connexions au back-office',
        '<select class="acamp-period" id="alog-period">' +
        [['1', '24 heures'], ['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours'], ['all', 'Tout']].map(function(p) {
          return '<option value="' + p[0] + '"' + (self.period === p[0] ? ' selected' : '') + '>' + p[1] + '</option>';
        }).join('') + '</select>' +
        '<button class="admin-btn" id="alog-refresh">Actualiser</button>') +
      '<div class="admin-kpi-grid">' +
      UI.kpi('Actions admin', UI.num(d.audit.length), 'sur la période', '') +
      UI.kpi('Erreurs API', UI.num(d.errors.length), errors24 ? errors24 + ' ces dernières 24h' : 'aucune ces dernières 24h', errors24 ? 'down' : 'up') +
      UI.kpi('Erreur la plus fréquente', topType ? UI.esc(topType) : '-', topType ? types[topType] + ' occurrence' + (types[topType] > 1 ? 's' : '') : '', topType ? 'warn' : '') +
      '</div>' +
      '<div class="admin-card">' +
      UI.tabs([
        { key: 'audit', label: 'Actions admin', count: d.audit.length },
        { key: 'errors', label: 'Erreurs API', count: d.errors.length },
        { key: 'connexions', label: 'Connexions admin', count: d.conns.length }
      ], this.tab, 'data-ltab') +
      '<div class="acc-toolbar"><input class="acc-search" id="alog-search" type="text" placeholder="Filtrer..." value="' + UI.esc(this.search) + '"></div>' +
      body +
      '</div>' +
      '</div>'
    );

    document.getElementById('alog-refresh').addEventListener('click', function() { self.render(); });
    document.getElementById('alog-period').addEventListener('change', function() {
      self.period = this.value;
      window.Helpers.renderPage(UI.loading());
      self._load();
    });
    document.querySelectorAll('[data-ltab]').forEach(function(t) {
      t.addEventListener('click', function() { self.tab = t.getAttribute('data-ltab'); self._render(); });
    });
    var search = document.getElementById('alog-search');
    search.addEventListener('input', function() {
      self.search = search.value;
      self._render();
      var el = document.getElementById('alog-search');
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    document.querySelectorAll('.alog-ctx').forEach(function(b) {
      b.addEventListener('click', function() {
        var e = d.errors.filter(function(x) { return x.id === b.getAttribute('data-id'); })[0];
        if (!e) return;
        window.Helpers.openModal(
          '<div class="modal-box" style="max-width:640px">' +
          '<div class="modal-header-row"><div class="modal-title">' + UI.esc(e.type || 'Erreur') + '</div>' +
          '<button class="modal-close-btn" onclick="window.Helpers.closeModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>' +
          '<div class="modal-desc">' + UI.esc(e.message || '') + '</div>' +
          '<pre class="admin-pre">' + UI.esc(JSON.stringify(e.context, null, 2)) + '</pre>' +
          '</div>'
        );
      });
    });
  }
};
