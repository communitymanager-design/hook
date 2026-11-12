// Notifications système : messages ciblés envoyés dans l'espace client
window.PageAdminNotifications = {
  rows: [],
  history: [],

  SEGMENTS: [
    { key: 'tous', label: 'Tous les clients' },
    { key: 'actif', label: 'Clients actifs (30j)' },
    { key: 'demarre', label: 'Ont démarré, sans campagne envoyée' },
    { key: 'connecte', label: 'Connectés, sans usage' },
    { key: 'jamais', label: 'Jamais connectés' },
    { key: 'inactif', label: 'Inactifs' },
    { key: 'liste', label: 'Ma liste de suivi' }
  ],

  TYPES: [
    { key: 'campagne', label: 'Information' },
    { key: 'alerte', label: 'Alerte / maintenance' },
    { key: 'credit', label: 'Crédits / offre' },
    { key: 'senderid', label: 'Sender ID' }
  ],

  render: function() {
    var self = this;
    window.Helpers.renderPage(window.AdminUI.loading());
    window.AdminActivity.load(function(err, rows) {
      self.rows = err ? [] : rows;
      window.DB.from('audit_logs').select('*').eq('action', 'system_notification_sent').order('created_at', { ascending: false }).limit(30)
        .then(function(res) {
          self.history = res.data || [];
          self._render();
        }, function() {
          self.history = [];
          self._render();
        });
    });
  },

  _recipients: function(segment) {
    if (segment === 'tous') return this.rows.filter(function(r) { return !r.user.is_blocked; });
    if (segment === 'liste') {
      var page = window.PageAdminActivity;
      page.rows = this.rows;
      var seen = {};
      return page._watchlist().map(function(e) { return page._match(e); }).filter(function(r) {
        if (!r || seen[r.user.id]) return false;
        seen[r.user.id] = true;
        return true;
      });
    }
    return this.rows.filter(function(r) { return r.status === segment && !r.user.is_blocked; });
  },

  _render: function() {
    var UI = window.AdminUI;
    var self = this;
    var manage = UI.canManage();

    var hist = !this.history.length ? UI.empty('Aucune notification système envoyée pour le moment.') :
      '<table class="admin-table"><thead><tr><th>Date</th><th>Message</th><th>Cible</th><th>Envoyés</th></tr></thead><tbody>' +
      this.history.map(function(h) {
        var d = h.details || {};
        return '<tr>' +
          '<td style="white-space:nowrap;color:var(--admin-text-secondary)">' + UI.dateTime(h.created_at) + '</td>' +
          '<td><strong>' + UI.esc(d.titre || '-') + '</strong><div class="admin-identity-sub">' + UI.esc((d.message || '').slice(0, 90)) + ((d.message || '').length > 90 ? '…' : '') + '</div></td>' +
          '<td>' + UI.esc(d.segment_label || d.segment || '-') + '</td>' +
          '<td>' + UI.num(d.destinataires) + '</td>' +
          '</tr>';
      }).join('') + '</tbody></table>';

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
      UI.header('Services', 'Notifications système', 'Messages envoyés dans la cloche de l\'espace client', '') +
      '<div class="admin-grid-2">' +
      '<div class="admin-card">' +
      '<div class="admin-card-header"><div class="admin-card-title">Nouveau message</div></div>' +
      '<div class="campnew-field"><label>Destinataires</label><select id="anot-seg">' +
      this.SEGMENTS.map(function(s) { return '<option value="' + s.key + '">' + s.label + '</option>'; }).join('') +
      '</select><div class="admin-identity-sub" id="anot-count" style="margin-top:6px"></div></div>' +
      '<div class="campnew-field"><label>Type</label><select id="anot-type">' +
      this.TYPES.map(function(t) { return '<option value="' + t.key + '">' + t.label + '</option>'; }).join('') +
      '</select></div>' +
      '<div class="campnew-field"><label>Titre</label><input type="text" id="anot-title" maxlength="80" placeholder="ex : Maintenance prévue dimanche"></div>' +
      '<div class="campnew-field"><label>Message</label><textarea id="anot-msg" rows="4" maxlength="500" placeholder="Le texte affiché au client"></textarea></div>' +
      '<div class="campnew-field"><label>Lien (optionnel)</label><select id="anot-link">' +
      '<option value="">Aucun</option><option value="/dashboard">Tableau de bord</option><option value="/campagnes/new">Nouvelle campagne</option>' +
      '<option value="/contacts">Contacts</option><option value="/sender-id">Sender ID</option><option value="/settings">Paramètres</option>' +
      '</select></div>' +
      (manage ? '<button class="btn btn-primary" id="anot-send" style="width:100%">Envoyer</button>' :
        '<div style="font-size:12px;color:var(--admin-text-muted)">Seul un Super Admin peut envoyer une notification système.</div>') +
      '</div>' +
      '<div class="admin-card">' +
      '<div class="admin-card-header"><div class="admin-card-title">Aperçu</div></div>' +
      '<div class="anot-preview" id="anot-preview"></div>' +
      '</div>' +
      '</div>' +
      '<div class="admin-card admin-mt">' +
      '<div class="admin-card-header"><div class="admin-card-title">Historique</div></div>' +
      hist +
      '</div>' +
      '</div>'
    );

    var update = function() {
      var seg = document.getElementById('anot-seg').value;
      var n = self._recipients(seg).length;
      document.getElementById('anot-count').textContent = n + ' destinataire' + (n > 1 ? 's' : '');
      var title = document.getElementById('anot-title').value.trim() || 'Titre du message';
      var msg = document.getElementById('anot-msg').value.trim() || 'Le contenu de votre message apparaîtra ici.';
      document.getElementById('anot-preview').innerHTML =
        '<div class="anot-preview-card"><div class="anot-preview-dot"></div><div>' +
        '<div class="anot-preview-title">' + UI.esc(title) + '</div>' +
        '<div class="anot-preview-msg">' + UI.esc(msg) + '</div>' +
        '<div class="anot-preview-time">A l\'instant</div>' +
        '</div></div>';
    };
    ['anot-seg', 'anot-title', 'anot-msg'].forEach(function(id) {
      document.getElementById(id).addEventListener(id === 'anot-seg' ? 'change' : 'input', update);
    });
    update();

    var send = document.getElementById('anot-send');
    if (send) send.addEventListener('click', function() { self._send(); });
  },

  _send: function() {
    var self = this;
    var UI = window.AdminUI;
    var seg = document.getElementById('anot-seg').value;
    var type = document.getElementById('anot-type').value;
    var titre = document.getElementById('anot-title').value.trim();
    var message = document.getElementById('anot-msg').value.trim();
    var lien = document.getElementById('anot-link').value || null;
    var recipients = this._recipients(seg);
    var segLabel = this.SEGMENTS.filter(function(s) { return s.key === seg; })[0].label;

    if (!titre || !message) { window.Toast.error('Titre et message obligatoires'); return; }
    if (!recipients.length) { window.Toast.error('Aucun destinataire dans ce segment'); return; }

    UI.confirm({
      title: 'Envoyer la notification',
      message: '« <strong>' + UI.esc(titre) + '</strong> » sera envoyé à <strong>' + recipients.length + '</strong> client' + (recipients.length > 1 ? 's' : '') + ' (' + UI.esc(segLabel) + ').',
      ok: 'Envoyer'
    }, function(btn) {
      btn.disabled = true;
      btn.textContent = 'Envoi...';
      var actor = window.HookAuth.user ? window.HookAuth.user.id : null;
      var ok = 0;
      var i = 0;
      var batch = function() {
        var chunk = recipients.slice(i, i + 20);
        if (!chunk.length) return Promise.resolve();
        i += 20;
        return Promise.all(chunk.map(function(r) {
          return window.DB.rpc('notify_user', {
            p_user_id: r.user.id,
            p_actor_id: actor,
            p_type: type,
            p_titre: titre,
            p_message: message,
            p_lien: lien,
            p_metadata: { source: 'notification_systeme', segment: seg }
          }).then(function(res) { if (!res.error) ok++; }, function() {});
        })).then(batch);
      };
      batch().then(function() {
        window.HookEvents.log('system_notification_sent', 'notification', null, null, {
          titre: titre, message: message, type: type, segment: seg, segment_label: segLabel, destinataires: ok
        });
        window.Helpers.closeModal();
        if (ok === recipients.length) window.Toast.success('Notification envoyée à ' + ok + ' client' + (ok > 1 ? 's' : ''));
        else window.Toast.error(ok + ' / ' + recipients.length + ' notifications envoyées');
        self.render();
      });
    });
  }
};
