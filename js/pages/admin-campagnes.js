window.PageAdminCampagnes = {
  users: [],
  sids: [],
  camps: [],
  selectedUser: null,
  selectedSid: null,
  period: 'all',
  search: '',

  render: function() {
    window.Helpers.renderPage('<div class="admin-page-wrapper"><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Chargement...</div></div>');
    this._loadAll();
  },

  _loadAll: function() {
    var self = this;
    Promise.all([
      window.DB.from('users').select('id, prenom, nom, email').eq('role', 'client').order('created_at', { ascending: false }),
      window.DB.from('campaigns').select('id, nom, statut, contacts_count, created_at, organization_id').order('created_at', { ascending: false })
    ]).then(function(r) {
      self.users = r[0].data || [];
      self.camps = r[1].data || [];
      self.sids  = [];
      self.selectedUser = null;
      self.selectedSid  = null;
      self._renderPage();
    }).catch(function() { self._renderPage(); });
  },

  _loadSids: function(orgId) {
    var self = this;
    if (!orgId) { self.sids = []; self._renderPage(); return; }
    window.DB.from('sender_ids').select('id, name, statut').eq('organization_id', orgId)
      .then(function(r) {
        self.sids = r.data || [];
        self._renderPage();
      });
  },

  _filteredCamps: function() {
    var self = this;
    var list = this.camps;

    if (self.selectedSid) {
      list = list.filter(function(c){ return c.sender_id === self.selectedSid; });
    } else if (self.selectedUser) {
      var user = self.users.find(function(u){ return u.id === self.selectedUser; });
      if (user && user.organization_id) {
        list = list.filter(function(c){ return c.organization_id === user.organization_id; });
      }
    }

    if (self.period !== 'all') {
      var cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - parseInt(self.period));
      list = list.filter(function(c){ return new Date(c.created_at) >= cutoff; });
    }

    if (self.search) {
      var s = self.search.toLowerCase();
      list = list.filter(function(c){ return (c.nom||'').toLowerCase().indexOf(s) !== -1; });
    }

    return list;
  },

  _renderPage: function() {
    var self = this;
    var filtered = this._filteredCamps();
    var stMap = { sending: 'En cours', scheduled: 'Programmée', sent: 'Terminée', cancelled: 'Annulée', draft: 'Brouillon' };
    var stCls  = { sending: 'admin-tag-info', scheduled: 'admin-tag-warn', sent: 'admin-tag-success', cancelled: 'admin-tag-danger', draft: 'admin-tag-neutral' };

    var campRows = filtered.length
      ? filtered.map(function(c) {
          var date = c.created_at ? c.created_at.slice(0,10) : '-';
          return '<tr>' +
            '<td><strong>' + window.Helpers.escapeHtml(c.nom) + '</strong></td>' +
            '<td><span class="admin-tag ' + (stCls[c.statut]||'admin-tag-neutral') + '">' + (stMap[c.statut]||c.statut) + '</span></td>' +
            '<td>' + (c.contacts_count||0).toLocaleString('fr-FR') + '</td>' +
            '<td style="color:var(--admin-text-secondary)">' + date + '</td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="4" style="text-align:center;padding:28px;color:var(--admin-text-secondary)">Aucune campagne.</td></tr>';

    var userList = self.users.map(function(u) {
      var name = ((u.prenom||'') + ' ' + (u.nom||'')).trim() || u.email || 'Sans nom';
      var initials = name !== (u.email||'Sans nom') ? name.split(' ').map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase() : '?';
      var active = self.selectedUser === u.id;
      return '<div class="acamp-user-row ' + (active?'active':'') + '" data-uid="' + u.id + '" data-orgid="' + (u.organization_id||'') + '">' +
        '<div style="width:28px;height:28px;border-radius:50%;background:' + (active?'#0B3828':'#E4F0E8') + ';color:' + (active?'#BDDE48':'#0B3828') + ';font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0">' + initials + '</div>' +
        '<div style="min-width:0"><div style="font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + window.Helpers.escapeHtml(name) + '</div><div style="font-size:10px;color:var(--admin-text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + window.Helpers.escapeHtml(u.email||'') + '</div></div>' +
      '</div>';
    }).join('') || '<div style="font-size:12px;color:var(--admin-text-secondary);padding:12px 8px">Aucun client.</div>';

    var sidList = self.sids.length
      ? self.sids.map(function(s) {
          var active = self.selectedSid === s.id;
          var stc = s.statut === 'approved' ? '#1D9E75' : '#C07A00';
          return '<div class="acamp-sid-row ' + (active?'active':'') + '" data-sid="' + s.id + '">' +
            '<div style="font-size:13px;font-weight:700;letter-spacing:0.5px">' + window.Helpers.escapeHtml(s.name) + '</div>' +
            '<span style="font-size:10px;color:' + stc + ';font-weight:600">' + (s.statut==='approved'?'Actif':'En attente') + '</span>' +
          '</div>';
        }).join('')
      : '<div style="font-size:12px;color:var(--admin-text-secondary);padding:12px 8px">' + (self.selectedUser ? 'Aucun Sender ID.' : 'Sélectionnez un client.') + '</div>';

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
        '<div class="admin-page-header">' +
          '<div><div class="admin-page-title">Campagnes</div><div class="admin-page-subtitle">' + filtered.length + ' campagne' + (filtered.length > 1 ? 's' : '') + ' affichée' + (filtered.length > 1 ? 's' : '') + '</div></div>' +
        '</div>' +

        '<div class="acamp-layout">' +

          '<div class="acamp-main">' +
            '<div class="acamp-filters">' +
              '<select class="acamp-period" id="acamp-period">' +
                '<option value="all"' + (self.period==='all'?' selected':'') + '>Toutes les périodes</option>' +
                '<option value="7"'   + (self.period==='7'?' selected':'') + '>7 derniers jours</option>' +
                '<option value="30"'  + (self.period==='30'?' selected':'') + '>30 derniers jours</option>' +
                '<option value="90"'  + (self.period==='90'?' selected':'') + '>90 derniers jours</option>' +
              '</select>' +
            '</div>' +
            '<div class="acamp-table-wrap">' +
              '<table class="admin-table"><thead><tr><th>Nom</th><th>Statut</th><th>Contacts</th><th>Date</th></tr></thead><tbody>' +
              campRows +
              '</tbody></table>' +
            '</div>' +
          '</div>' +

          '<div class="acamp-sidebar">' +

            '<div class="acamp-panel">' +
              '<div class="acamp-panel-title">Clients</div>' +
              '<input class="acamp-user-search" id="acamp-user-search" type="text" placeholder="Rechercher..." value="">' +
              '<div class="acamp-user-list" id="acamp-user-list">' + userList + '</div>' +
            '</div>' +

            '<div class="acamp-panel">' +
              '<div class="acamp-panel-title">Sender IDs' + (self.selectedUser ? '' : '') + '</div>' +
              '<div class="acamp-sid-list" id="acamp-sid-list">' + sidList + '</div>' +
            '</div>' +

          '</div>' +

        '</div>' +
      '</div>'
    );

    this._bindEvents();
  },

  _bindEvents: function() {
    var self = this;

    var period = document.getElementById('acamp-period');
    if (period) period.addEventListener('change', function() {
      self.period = period.value;
      self._renderPage();
    });

    var userSearch = document.getElementById('acamp-user-search');
    var userListEl = document.getElementById('acamp-user-list');
    if (userSearch && userListEl) {
      userSearch.addEventListener('input', function() {
        var s = userSearch.value.toLowerCase();
        userListEl.querySelectorAll('.acamp-user-row').forEach(function(row) {
          var text = row.textContent.toLowerCase();
          row.style.display = text.indexOf(s) !== -1 ? '' : 'none';
        });
      });
    }

    document.querySelectorAll('.acamp-user-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var uid   = row.getAttribute('data-uid');
        var orgId = row.getAttribute('data-orgid');
        if (self.selectedUser === uid) {
          self.selectedUser = null;
          self.selectedSid  = null;
          self.sids = [];
          self._renderPage();
        } else {
          self.selectedUser = uid;
          self.selectedSid  = null;
          var user = self.users.find(function(u){ return u.id === uid; });
          if (user) user.organization_id = orgId || null;
          self._loadSids(orgId);
        }
      });
    });

    document.querySelectorAll('.acamp-sid-row').forEach(function(row) {
      row.addEventListener('click', function() {
        var sid = row.getAttribute('data-sid');
        if (self.selectedSid === sid) {
          self.selectedSid = null;
        } else {
          self.selectedSid = sid;
        }
        self._renderPage();
      });
    });
  }
};
