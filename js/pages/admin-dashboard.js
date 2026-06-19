window.PageAdminDashboard = {
  render: function() {
    window.Helpers.renderPage('<div class="admin-page-wrapper"><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Chargement...</div></div>');
    this._load();
  },

  _load: function() {
    var self = this;
    Promise.all([
      window.DB.from('users').select('id', { count: 'exact', head: true }).neq('role', 'super_admin'),
      window.DB.from('sender_ids').select('id', { count: 'exact', head: true }).eq('statut', 'pending'),
      window.DB.from('campaigns').select('id,nom,statut,contacts_count,created_at').order('created_at', { ascending: false }).limit(5),
      window.DB.from('sender_ids').select('id,name,représentant_legal,submitted_at').eq('statut', 'pending').order('submitted_at', { ascending: true }).limit(5),
      window.DB.from('users').select('id,prenom,nom,email,organization_id,created_at').neq('role','super_admin').gte('created_at', new Date(Date.now()-7*24*60*60*1000).toISOString()).order('created_at', { ascending: false }).limit(10)
    ]).then(function(r) {
      var camps = r[2].data || [];
      var totalSmsToday = 0;
      camps.forEach(function(c){ totalSmsToday += c.contacts_count || 0; });

      self._buildHtml({
        totalClients:    r[0].count || 0,
        pendingSids:     r[1].count || 0,
        totalSmsToday:   totalSmsToday,
        recentCamps:     camps,
        pendingSidsList: r[3].data || [],
        recentUsers:     r[4].data || []
      });
    }).catch(function() { self._buildHtml({}); });
  },

  _buildHtml: function(d) {
    var clients   = d.totalClients   || 0;
    var pendSids  = d.pendingSids    || 0;
    var smsToday  = d.totalSmsToday  || 0;
    var recentCamps = d.recentCamps  || [];
    var pendSidsList = d.pendingSidsList || [];
    var recentUsers  = d.recentUsers || [];

    var html = '<div class="admin-page-wrapper">' +
      '<div class="admin-page-header">' +
        '<div>' +
          '<div class="admin-breadcrumb">Administration</div>' +
          '<div class="admin-page-title">Tableau de bord</div>' +
          '<div class="admin-page-subtitle">Vue globale en temps reel</div>' +
        '</div>' +
        '<div class="admin-header-actions">' +
          '<button class="admin-btn" onclick="window.PageAdminDashboard.render()">Actualiser</button>' +
        '</div>' +
      '</div>' +

      '<div class="admin-kpi-grid">' +
        this._kpi('Clients', clients.toLocaleString('fr-FR'), '', '', '#/Nkololopangohook/clients') +
        this._kpi('SMS envoyés total', smsToday.toLocaleString('fr-FR'), '', '', '#/Nkololopangohook/campagnes') +
        this._kpi('Sender ID en attente', pendSids.toLocaleString('fr-FR'), pendSids > 0 ? 'A validér' : '', pendSids > 0 ? 'warn' : '', '#/Nkololopangohook/sender-id') +
        this._kpi('Campagnes récentes', recentCamps.length.toLocaleString('fr-FR'), '', '', '#/Nkololopangohook/campagnes') +
        this._kpi('Revenus du mois', 'N/A', '', '', '#/Nkololopangohook/billing') +
        this._kpi('Tickets support', 'N/A', '', '', '#/Nkololopangohook/support') +
      '</div>' +

      '<div class="admin-grid-2">' +
        '<div class="admin-card">' +
          '<div class="admin-card-header"><div class="admin-card-title">Campagnes récentes</div>' +
          '<span class="admin-link" onclick="window.Router.navigate(\'/Nkololopangohook/campagnes\')">Voir tout</span></div>' +
          this._recentCamps(recentCamps) +
        '</div>' +
        '<div class="admin-card">' +
          '<div class="admin-card-header"><div class="admin-card-title">Sender ID en attente</div>' +
          '<span class="admin-link" onclick="window.Router.navigate(\'/Nkololopangohook/sender-id\')">Voir tout</span></div>' +
          this._pendingSenderIds(pendSidsList) +
        '</div>' +
      '</div>' +

      '<div class="admin-card admin-mt">' +
        '<div class="admin-card-header"><div class="admin-card-title">Dernières inscriptions</div>' +
        '<span class="admin-link" onclick="window.Router.navigate(\'/Nkololopangohook/clients\')">Voir tout</span></div>' +
        this._recentClients(recentUsers) +
      '</div>' +

    '</div>';

    window.Helpers.renderPage(html);
  },

  _kpi: function(label, val, sub, type, href) {
    var subColor = type === 'up' ? '#1D9E75' : type === 'down' ? '#A32D2D' : '#854F0B';
    var bg = type === 'warn' ? 'background:rgba(133,79,11,0.08)' : type === 'down' ? 'background:rgba(163,45,45,0.06)' : '';
    return '<div class="admin-kpi-card" style="' + bg + '" onclick="window.location.hash=\'' + href.replace('#','') + '\'">' +
      '<div class="admin-kpi-label">' + label + '</div>' +
      '<div class="admin-kpi-value">' + val + '</div>' +
      (sub ? '<div class="admin-kpi-sub" style="color:' + subColor + '">' + sub + '</div>' : '') +
    '</div>';
  },

  _recentCamps: function(camps) {
    if (!camps.length) return '<div style="padding:16px;font-size:13px;color:var(--admin-text-secondary)">Aucune campagne.</div>';
    var statusMap = { sending:'En cours', scheduled:'Programme', sent:'Terminée', cancelled:'Annule', draft:'Brouillon' };
    var stCls = { sending:'admin-tag-info', scheduled:'admin-tag-warn', sent:'admin-tag-success', draft:'admin-tag-neutral', cancelled:'admin-tag-danger' };
    return '<table class="admin-table"><thead><tr><th>Nom</th><th>Statut</th><th>Contacts</th><th>Date</th></tr></thead><tbody>' +
      camps.map(function(c) {
        return '<tr>' +
          '<td><strong>' + window.Helpers.escapeHtml(c.nom) + '</strong></td>' +
          '<td><span class="admin-tag ' + (stCls[c.statut]||'admin-tag-neutral') + '">' + (statusMap[c.statut]||c.statut) + '</span></td>' +
          '<td>' + (c.contacts_count||0).toLocaleString('fr-FR') + '</td>' +
          '<td style="color:var(--admin-text-secondary)">' + (c.created_at?c.created_at.slice(0,10):'-') + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  },

  _pendingSenderIds: function(sids) {
    if (!sids.length) return '<div style="padding:16px;font-size:13px;color:var(--admin-text-secondary)">Aucun Sender ID en attente.</div>';
    return sids.map(function(s) {
      var hours = s.submitted_at ? Math.floor((Date.now() - new Date(s.submitted_at).getTime()) / 3600000) + 'h' : '-';
      return '<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:0.5px solid rgba(11,56,40,0.08)">' +
        '<div>' +
          '<div style="font-size:14px;font-weight:700;letter-spacing:0.5px;color:var(--admin-text-primary)">' + window.Helpers.escapeHtml(s.name) + '</div>' +
          '<div style="font-size:11px;color:var(--admin-text-secondary)">' + window.Helpers.escapeHtml(s.représentant_legal||'-') + ' · ' + hours + '</div>' +
        '</div>' +
        '<button class="admin-btn-sm" onclick="window.Router.navigate(\'/Nkololopangohook/sender-id\')">Examiner</button>' +
      '</div>';
    }).join('');
  },

  _recentClients: function(users) {
    if (!users.length) return '<div style="padding:16px;font-size:13px;color:var(--admin-text-secondary)">Aucune inscription cette semaine.</div>';
    return '<table class="admin-table"><thead><tr><th>Utilisateur</th><th>Email</th><th>Inscription</th></tr></thead><tbody>' +
      users.map(function(u) {
        var name = ((u.prenom||'') + ' ' + (u.nom||'')).trim() || 'Sans nom';
        var initials = name !== 'Sans nom' ? name.split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase() : '?';
        var hours = u.created_at ? Math.floor((Date.now() - new Date(u.created_at).getTime()) / 3600000) : 0;
        var ago = hours < 1 ? 'A l\'instant' : hours < 24 ? 'Il y a ' + hours + 'h' : 'Il y a ' + Math.floor(hours/24) + 'j';
        return '<tr>' +
          '<td><div style="display:flex;align-items:center;gap:8px"><div style="width:28px;height:28px;border-radius:50%;background:#E4F0E8;color:#0B3828;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials + '</div><strong>' + window.Helpers.escapeHtml(name) + '</strong></div></td>' +
          '<td style="color:var(--admin-text-secondary)">' + window.Helpers.escapeHtml(u.email||'-') + '</td>' +
          '<td style="color:var(--admin-text-secondary);font-size:12px">' + ago + '</td>' +
        '</tr>';
      }).join('') + '</tbody></table>';
  }
};
