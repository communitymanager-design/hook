window.PageDevelopers = {
  _orgId: null,

  render: function() {
    if (!window.HookAuth.isLoggedIn()) { window.Router.navigate('/auth'); return; }
    window.Helpers.renderPage(
      '<div class="page-wrapper dev-wrapper">'
      + '<div class="dev-header">'
        + '<div>'
          + '<div class="page-title">Developpeurs</div>'
          + '<div class="page-subtitle">Integrez l\'envoi de SMS Hook directement dans vos applications</div>'
        + '</div>'
        + '<button class="btn btn-primary" id="dev-new-key">' + this._icon('plus') + 'Nouvelle cle API</button>'
      + '</div>'
      + '<div class="dev-stats" id="dev-stats"></div>'
      + '<div class="dev-doc-banner" id="dev-doc-link">'
        + '<div class="dev-doc-banner-txt">'
          + this._icon('book')
          + '<div><div class="dev-doc-banner-title">Documentation de l\'API</div>'
          + '<div class="dev-doc-banner-sub">Endpoints, exemples de code et gestion des erreurs</div></div>'
        + '</div>'
        + this._icon('arrow')
      + '</div>'
      + '<div class="dev-section-title">Vos cles API</div>'
      + '<div id="dev-keys-list"><div class="dev-empty">Chargement...</div></div>'
    + '</div>');
    this._bind();
    this._load();
  },

  _bind: function() {
    var self = this;
    var b = document.getElementById('dev-new-key');
    if (b) b.addEventListener('click', function() { self._openCreateModal(); });
    var d = document.getElementById('dev-doc-link');
    if (d) d.addEventListener('click', function() { window.Router.navigate('/api-docs'); });
  },

  _load: function() {
    var self = this;
    var uid = window.HookAuth.user && window.HookAuth.user.id;
    window.DB.from('users').select('organization_id').eq('id', uid).single().then(function(r) {
      self._orgId = r.data && r.data.organization_id;
      self._loadKeys();
      self._loadStats();
    });
  },

  _loadStats: function() {
    var self = this;
    var since = new Date(Date.now() - 30 * 864e5).toISOString();
    Promise.all([
      window.DB.from('api_requests').select('id', { count: 'exact', head: true }).eq('organization_id', self._orgId).gte('created_at', since),
      window.DB.from('api_messages').select('id', { count: 'exact', head: true }).eq('organization_id', self._orgId),
      window.DB.from('api_keys').select('id', { count: 'exact', head: true }).eq('organization_id', self._orgId).eq('statut', 'active')
    ]).then(function(res) {
      var calls = res[0].count || 0, sms = res[1].count || 0, keys = res[2].count || 0;
      var el = document.getElementById('dev-stats');
      if (!el) return;
      el.innerHTML =
        self._stat(self._icon('activity'), calls.toLocaleString('fr-FR'), 'Appels API (30j)')
        + self._stat(self._icon('message'), sms.toLocaleString('fr-FR'), 'SMS envoyes via API')
        + self._stat(self._icon('key'), keys.toLocaleString('fr-FR'), 'Cles actives');
    });
  },

  _stat: function(icon, val, label) {
    return '<div class="dev-stat"><div class="dev-stat-icon">' + icon + '</div>'
      + '<div class="dev-stat-val">' + val + '</div>'
      + '<div class="dev-stat-label">' + label + '</div></div>';
  },

  _loadKeys: function() {
    var self = this;
    window.DB.from('api_keys').select('id,key_prefix,nom,statut,last_used_at,created_at,revoked_at')
      .eq('organization_id', self._orgId).order('created_at', { ascending: false })
      .then(function(r) {
        var keys = r.data || [];
        var el = document.getElementById('dev-keys-list');
        if (!el) return;
        if (!keys.length) {
          el.innerHTML = '<div class="dev-empty">' + self._icon('key')
            + '<div class="dev-empty-title">Aucune cle API</div>'
            + '<div class="dev-empty-sub">Creez votre premiere cle pour commencer a envoyer des SMS par API.</div></div>';
          return;
        }
        el.innerHTML = keys.map(function(k) { return self._keyRow(k); }).join('');
        keys.forEach(function(k) {
          if (k.statut === 'active') {
            var rb = document.getElementById('revoke-' + k.id);
            if (rb) rb.addEventListener('click', function() { self._confirmRevoke(k); });
          }
        });
      });
  },

  _keyRow: function(k) {
    var active = k.statut === 'active';
    var used = k.last_used_at ? 'Derniere utilisation ' + window.Helpers.formatDate(k.last_used_at) : 'Jamais utilisee';
    var badge = active
      ? '<span class="dev-badge dev-badge-active">Active</span>'
      : '<span class="dev-badge dev-badge-revoked">Revoquee</span>';
    var action = active
      ? '<button class="dev-key-revoke" id="revoke-' + k.id + '">Revoquer</button>'
      : '';
    return '<div class="dev-key-row' + (active ? '' : ' dev-key-row-off') + '">'
      + '<div class="dev-key-main">'
        + '<div class="dev-key-name">' + window.Helpers.escapeHtml(k.nom || 'Cle sans nom') + badge + '</div>'
        + '<div class="dev-key-code">' + window.Helpers.escapeHtml(k.key_prefix) + '...</div>'
        + '<div class="dev-key-meta">Creee le ' + window.Helpers.formatDate(k.created_at) + ' . ' + used + '</div>'
      + '</div>'
      + action
    + '</div>';
  },

  _openCreateModal: function() {
    var self = this;
    window.Helpers.openModal(
      '<div class="modal-box" style="max-width:440px">'
        + '<div class="modal-title">Nouvelle cle API</div>'
        + '<div class="modal-desc">Donnez un nom a cette cle pour la reconnaitre plus tard (ex: Serveur production, App mobile).</div>'
        + '<input type="text" class="form-input" id="dev-key-name" placeholder="Nom de la cle" style="margin-top:14px" maxlength="60">'
        + '<div class="modal-actions">'
          + '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>'
          + '<button class="btn btn-primary" id="dev-key-create-confirm">Generer la cle</button>'
        + '</div>'
      + '</div>');
    setTimeout(function() {
      var inp = document.getElementById('dev-key-name');
      if (inp) inp.focus();
      var c = document.getElementById('dev-key-create-confirm');
      if (c) c.addEventListener('click', function() { self._createKey(); });
    }, 40);
  },

  _sha256Hex: function(str) {
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)).then(function(buf) {
      return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    });
  },

  _createKey: function() {
    var self = this;
    var nameInp = document.getElementById('dev-key-name');
    var nom = (nameInp && nameInp.value.trim()) || 'Cle sans nom';
    var btn = document.getElementById('dev-key-create-confirm');
    if (btn) { btn.disabled = true; btn.textContent = 'Generation...'; }

    var bytes = crypto.getRandomValues(new Uint8Array(16));
    var raw = 'hook_live_' + Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
    var prefix = raw.slice(0, 16);

    self._sha256Hex(raw).then(function(hash) {
      return window.DB.from('api_keys').insert({
        organization_id: self._orgId,
        key_hash: hash,
        key_prefix: prefix,
        nom: nom,
        statut: 'active',
        created_by: window.HookAuth.user.id
      });
    }).then(function(res) {
      if (res.error) { window.Toast.error('Erreur lors de la creation'); if (btn) { btn.disabled = false; btn.textContent = 'Generer la cle'; } return; }
      window.Helpers.closeModal();
      self._showKeyOnce(raw, nom);
      self._loadKeys();
      self._loadStats();
    });
  },

  _showKeyOnce: function(raw, nom) {
    window.Helpers.openModal(
      '<div class="modal-box" style="max-width:480px">'
        + '<div class="modal-title">Cle creee</div>'
        + '<div class="dev-key-warning">' + this._icon('warning')
          + 'Copiez cette cle maintenant. Pour des raisons de securite, elle ne sera plus jamais affichee.</div>'
        + '<div class="dev-key-reveal" id="dev-key-reveal">' + window.Helpers.escapeHtml(raw) + '</div>'
        + '<button class="btn btn-primary" id="dev-key-copy" style="width:100%;margin-top:12px">' + this._icon('copy') + 'Copier la cle</button>'
        + '<div class="modal-actions" style="margin-top:10px">'
          + '<button class="btn" onclick="window.Helpers.closeModal()" style="width:100%">J\'ai copie ma cle</button>'
        + '</div>'
      + '</div>');
    var self = this;
    setTimeout(function() {
      var cp = document.getElementById('dev-key-copy');
      if (cp) cp.addEventListener('click', function() {
        navigator.clipboard.writeText(raw).then(function() {
          window.Toast.success('Cle copiee');
          cp.innerHTML = self._icon('check') + 'Copiee';
        });
      });
    }, 40);
  },

  _confirmRevoke: function(k) {
    var self = this;
    window.Helpers.openModal(
      '<div class="modal-box" style="max-width:420px">'
        + '<div class="modal-title">Revoquer cette cle ?</div>'
        + '<div class="modal-desc">La cle <strong>' + window.Helpers.escapeHtml(k.nom || k.key_prefix) + '</strong> cessera immediatement de fonctionner. Les applications qui l\'utilisent ne pourront plus envoyer de SMS. Cette action est irreversible.</div>'
        + '<div class="modal-actions">'
          + '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>'
          + '<button class="btn btn-danger" id="dev-revoke-confirm">Revoquer</button>'
        + '</div>'
      + '</div>');
    setTimeout(function() {
      var c = document.getElementById('dev-revoke-confirm');
      if (c) c.addEventListener('click', function() {
        c.disabled = true; c.textContent = 'Revocation...';
        window.DB.from('api_keys').update({ statut: 'revoked', revoked_at: new Date().toISOString() }).eq('id', k.id).then(function(res) {
          window.Helpers.closeModal();
          if (res.error) { window.Toast.error('Erreur'); return; }
          window.Toast.success('Cle revoquee');
          self._loadKeys();
          self._loadStats();
        });
      });
    }, 40);
  },

  _icon: function(name) {
    var i = {
      plus: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 3v9M3 7.5h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
      key: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="6" cy="6" r="3.2" stroke="currentColor" stroke-width="1.4"/><path d="M8.3 8.3L14 14M11.5 11.5l1.5-1.5M13 13l1.2-1.2" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      activity: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M2 9h3l2-5 4 10 2-5h3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      message: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M15 4H3a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h2v2l3-2h7a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
      book: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M10 5C8.5 3.8 6.5 3.5 4 3.8v10C6.5 13.5 8.5 13.8 10 15c1.5-1.2 3.5-1.5 6-1.2v-10C13.5 3.5 11.5 3.8 10 5z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M10 5v10" stroke="currentColor" stroke-width="1.4"/></svg>',
      arrow: '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M6 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      copy: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 5V3.5A1.5 1.5 0 0 0 8.5 2h-5A1.5 1.5 0 0 0 2 3.5v5A1.5 1.5 0 0 0 3.5 10H5" stroke="currentColor" stroke-width="1.3"/></svg>',
      check: '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M3 8l3 3 6-6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      warning: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2l6 11H2L8 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 6.5v3M8 11.2v.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'
    };
    return i[name] || '';
  }
};
