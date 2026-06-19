window.PageAdminClients = {
  clients: [],
  search: '',
  sortBy: 'created_at',

  render: function() {
    this.search = '';
    this.sortBy = 'created_at';
    window.Helpers.renderPage('<div class="admin-page-wrapper"><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Chargement...</div></div>');
    this._load();
  },

  _load: function() {
    var self = this;
    window.DB.from('users')
      .select('id, prenom, nom, email, role, organization_id, created_at, is_blocked')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
      .then(function(res) {
        var users = res.data || [];
        var orgIds = users.map(function(u){ return u.organization_id; }).filter(Boolean);

        if (!orgIds.length) {
          self.clients = users.map(function(u) {
            return { id: u.id, prenom: u.prenom||'', nom: u.nom||'', email: u.email||'',
              role: 'client', organization_id: null, created_at: u.created_at,
              credits_fcfa: 0, sms_remaining: 0, sids: [], total_campagnes: 0, is_blocked: u.is_blocked || false };
          });
          self._renderList();
          return;
        }

        Promise.all([
          window.DB.from('credit_accounts').select('organization_id,balance_fcfa,sms_remaining').in('organization_id', orgIds),
          window.DB.from('sender_ids').select('id,organization_id,name,statut').in('organization_id', orgIds),
          window.DB.from('campaigns').select('id,organization_id').in('organization_id', orgIds)
        ]).then(function(r) {
          var credits = r[0].data || [];
          var sids    = r[1].data || [];
          var camps   = r[2].data || [];

          self.clients = users.map(function(u) {
            var cr      = credits.find(function(x){ return x.organization_id === u.organization_id; }) || {};
            var mySids  = sids.filter(function(x){ return x.organization_id === u.organization_id; });
            var myCamps = camps.filter(function(x){ return x.organization_id === u.organization_id; });
            return {
              id: u.id, prenom: u.prenom||'', nom: u.nom||'', email: u.email||'',
              role: 'client', organization_id: u.organization_id,
              created_at: u.created_at,
              credits_fcfa: cr.balance_fcfa || 0,
              sms_remaining: cr.sms_remaining || 0,
              sids: mySids,
              total_campagnes: myCamps.length,
              is_blocked: u.is_blocked || false
            };
          });
          self._renderList();
        });
      })
      .catch(function() { self.clients = []; self._renderList(); });
  },

  _filtered: function() {
    var self = this;
    var s = this.search.toLowerCase();
    var list = this.clients.filter(function(c) {
      if (!s) return true;
      return ((c.prenom+' '+c.nom+' '+c.email).toLowerCase()).indexOf(s) !== -1;
    });
    var sb = this.sortBy;
    list.sort(function(a,b) {
      if (sb === 'credits')   return b.sms_remaining - a.sms_remaining;
      if (sb === 'campagnes') return b.total_campagnes - a.total_campagnes;
      if (sb === 'sids')      return b.sids.length - a.sids.length;
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return list;
  },

  _renderList: function() {
    var self = this;
    var filtered = this._filtered();
    var total = this.clients.length;
    var totalAdmins = this.clients.filter(function(c){ return c.role === 'admin'; }).length;

    var cards = filtered.map(function(c) {
      var name = (c.prenom + ' ' + c.nom).trim() || 'Sans nom';
      var initials = name !== 'Sans nom'
        ? name.split(' ').map(function(w){ return w[0]||''; }).join('').slice(0,2).toUpperCase()
        : '?';
      var roleCls = c.role === 'admin' ? 'tag-warning' : 'tag-neutral';
      var roleLabel = c.role === 'admin' ? 'Admin' : 'Client';
      var activeSids = c.sids.filter(function(s){ return s.statut === 'approved'; }).length;
      var pendingSids = c.sids.filter(function(s){ return s.statut === 'pending'; }).length;
      var date = c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : '-';

      return '<div class="admin-client-card" data-id="' + c.id + '">' +
        '<div class="acc-top">' +
          '<div class="acc-identity">' +
            '<div class="acc-avatar">' + initials + '</div>' +
            '<div>' +
              '<div class="acc-name">' + window.Helpers.escapeHtml(name) + '</div>' +
              '<div class="acc-email">' + window.Helpers.escapeHtml(c.email) + '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:4px;align-items:center">' +
            '<span class="tag ' + roleCls + '">' + roleLabel + '</span>' +
            (c.is_blocked ? '<span class="tag tag-danger">Bloqué</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="acc-action-row">' +
          '<button class="acc-action-pill acc-edit-btn" data-id="' + c.id + '" onclick="event.stopPropagation()">' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M8 2l2 2-5.5 5.5H2.5V8L8 2z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>Modifier' +
          '</button>' +
          '<button class="acc-action-pill acc-block-btn ' + (c.is_blocked?'acc-pill-green':'acc-pill-orange') + '" data-id="' + c.id + '" data-blocked="' + (c.is_blocked?'1':'0') + '" onclick="event.stopPropagation()">' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.2"/><path d="M3 3l6 6" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>' +
            (c.is_blocked?'Débloquer':'Bloquer') +
          '</button>' +
          '<button class="acc-action-pill acc-del-btn acc-pill-red" data-id="' + c.id + '" onclick="event.stopPropagation()">' +
            '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M4.5 3V2h3v1M5 5v4M7 5v4M2.5 3l.5 6.5h6L9.5 3" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>Supprimer' +
          '</button>' +
        '</div>' +
        '<div class="acc-stats">' +
          '<div class="acc-stat"><div class="acc-stat-val">' + c.sms_remaining.toLocaleString('fr-FR') + '</div><div class="acc-stat-lbl">SMS restants</div></div>' +
          '<div class="acc-stat"><div class="acc-stat-val">' + activeSids + (pendingSids > 0 ? ' <span style="font-size:10px;color:var(--color-text-muted)">+' + pendingSids + ' att.</span>' : '') + '</div><div class="acc-stat-lbl">Sender IDs</div></div>' +
          '<div class="acc-stat"><div class="acc-stat-val">' + c.total_campagnes + '</div><div class="acc-stat-lbl">Campagnes</div></div>' +
          '<div class="acc-stat"><div class="acc-stat-val" style="font-size:12px">' + date + '</div><div class="acc-stat-lbl">Inscrit le</div></div>' +
        '</div>' +
      '</div>';
    }).join('') || '<div style="padding:40px;text-align:center;color:var(--color-text-muted)">Aucun client.</div>';

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
        '<div class="admin-page-header">' +
          '<div>' +
            '<div class="admin-page-title">Clients</div>' +
            '<div class="admin-page-sub">' + total + ' comptes · ' + totalAdmins + ' admins</div>' +
          '</div>' +
        '</div>' +

        '<div class="acc-toolbar">' +
          '<input class="acc-search" id="acc-search" type="text" placeholder="Rechercher par nom ou email..." value="' + window.Helpers.escapeHtml(self.search) + '">' +
          '<select class="acc-sort" id="acc-sort">' +
            '<option value="created_at"' + (self.sortBy==='created_at'?' selected':'') + '>Trier : inscription</option>' +
            '<option value="credits"'    + (self.sortBy==='credits'?' selected':'') + '>Trier : credits</option>' +
            '<option value="campagnes"'  + (self.sortBy==='campagnes'?' selected':'') + '>Trier : campagnes</option>' +
            '<option value="sids"'       + (self.sortBy==='sids'?' selected':'') + '>Trier : Sender IDs</option>' +
          '</select>' +
        '</div>' +

        '<div class="acc-grid">' + cards + '</div>' +
      '</div>'
    );

    this._bindListEvents();
  },

  _bindListEvents: function() {
    var self = this;

    var search = document.getElementById('acc-search');
    if (search) search.addEventListener('input', function() {
      self.search = search.value;
      self._renderList();
    });

    var sort = document.getElementById('acc-sort');
    if (sort) sort.addEventListener('change', function() {
      self.sortBy = sort.value;
      self._renderList();
    });

    document.querySelectorAll('.admin-client-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.acc-edit-btn') || e.target.closest('.acc-del-btn')) return;
        var id = card.getAttribute('data-id');
        window.PageAdminClientDetail.openClient(id, self.clients);
      });
    });

    document.querySelectorAll('.acc-edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        var c = self.clients.find(function(x){ return x.id === id; });
        if (c) self._openEditModal(c);
      });
    });

    document.querySelectorAll('.acc-block-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id      = btn.getAttribute('data-id');
        var blocked = btn.getAttribute('data-blocked') === '1';
        var client  = self.clients.find(function(x){ return x.id === id; });
        if (!client) return;
        if (blocked) {
          window.DB.from('users').update({ is_blocked: false }).eq('id', id).then(function(res) {
            if (res.error) { window.Toast.error(res.error.message); return; }
            window.HookEvents.log('user_unblocked', 'user', id, id, { email: client.email });
            window.Toast.success('Compte débloqué');
            self._load();
          });
        } else {
          window.Helpers.openModal(
            '<div class="modal-box">' +
              '<div class="modal-title" style="color:#C07A00">Bloquer ce compte</div>' +
              '<div class="modal-desc">L\'utilisateur <strong>' + window.Helpers.escapeHtml((client.prenom + ' ' + client.nom).trim() || client.email) + '</strong> ne pourra plus accéder à Hook. Il verra un message lui demandant de contacter le support.</div>' +
              '<div class="modal-actions">' +
                '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
                '<button class="btn" style="background:#C07A00;color:#fff;border-color:#C07A00" id="confirm-block-btn">Bloquer le compte</button>' +
              '</div>' +
            '</div>'
          );
          document.getElementById('confirm-block-btn').addEventListener('click', function() {
            window.DB.from('users').update({ is_blocked: true }).eq('id', id).then(function(res) {
              if (res.error) { window.Toast.error(res.error.message); return; }
              window.HookEvents.log('user_blocked', 'user', id, id, { email: client.email });
              window.HookEvents.notify(id, null, 'alerte', 'Compte bloqué', 'Votre compte a été bloqué. Veuillez contacter le service client pour régulariser votre situation.', null, {});
              window.Helpers.closeModal();
              window.Toast.success('Compte bloqué');
              self._load();
            });
          });
        }
      });
    });

    document.querySelectorAll('.acc-del-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        var c = self.clients.find(function(x){ return x.id === id; });
        if (c) self._confirmDelete(c);
      });
    });
  },

  _openEditModal: function(c) {
    var self = this;
    window.Helpers.openModal(
      '<div class="modal-box">' +
        '<div class="modal-header-row"><div class="modal-title">Modifier le compte</div>' +
        '<button class="modal-close-btn" onclick="window.Helpers.closeModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>' +
        '<div class="sid-form-row">' +
          '<div class="campnew-field"><label>Prénom</label><input type="text" id="edit-prénom" value="' + window.Helpers.escapeHtml(c.prenom) + '"></div>' +
          '<div class="campnew-field"><label>Nom</label><input type="text" id="edit-nom" value="' + window.Helpers.escapeHtml(c.nom) + '"></div>' +
        '</div>' +
        '<div class="campnew-field"><label>Email</label><input type="email" id="edit-email" value="' + window.Helpers.escapeHtml(c.email) + '"></div>' +
        '<div class="campnew-field"><label>Role</label><select id="edit-role">' +
          '<option value="client"' + (c.role==='client'?' selected':'') + '>Client</option>' +
          '<option value="admin"'  + (c.role==='admin'?' selected':'') + '>Admin</option>' +
        '</select></div>' +
        '<div class="modal-actions">' +
          '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
          '<button class="btn btn-primary" id="btn-save-client">Enregistrer</button>' +
        '</div>' +
      '</div>'
    );
    document.getElementById('btn-save-client').addEventListener('click', function() {
      var data = {
        prenom: document.getElementById('edit-prénom').value.trim(),
        nom:    document.getElementById('edit-nom').value.trim(),
        role:   document.getElementById('edit-role').value
      };
      window.DB.from('users').update(data).eq('id', c.id).then(function(res) {
        if (res.error) { window.Toast.error(res.error.message); return; }
        if (data.role && data.role !== c.role) {
          window.HookEvents.clientRoleChanged(c, c.role, data.role);
        } else {
          window.HookEvents.clientUpdated(c, data);
        }
        window.Helpers.closeModal();
        window.Toast.success('Compte mis à jour');
        self._load();
      });
    });
  },

  _confirmDelete: function(c) {
    var self = this;
    var name = (c.prenom + ' ' + c.nom).trim() || c.email;
    window.Helpers.openModal(
      '<div class="modal-box">' +
        '<div class="modal-title modal-title-danger">Supprimer ce compte</div>' +
        '<div class="modal-desc">Le compte de <strong>' + window.Helpers.escapeHtml(name) + '</strong> sera supprime. Ses campagnes, contacts et Sender IDs seront perdus.</div>' +
        '<div class="modal-actions">' +
          '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
          '<button class="btn btn-danger-solid" id="btn-confirm-del-client">Supprimer</button>' +
        '</div>' +
      '</div>'
    );
    document.getElementById('btn-confirm-del-client').addEventListener('click', function() {
      window.DB.from('users').delete().eq('id', c.id).then(function(res) {
        if (res.error) { window.Toast.error(res.error.message); return; }
        window.HookEvents.clientDeleted(c);
        window.Helpers.closeModal();
        window.Toast.success('Compte supprime');
        self._load();
      });
    });
  }
};

window.PageAdminClientDetail = {
  clientId: null,
  clients: [],
  period: '30',
  campTab: 'toutes',

  openClient: function(id, clients) {
    this.clientId = id;
    this.clients = clients || [];
    this.period = '30';
    this.campTab = 'toutes';
    this._load();
  },

  _load: function() {
    var self = this;
    var c = this.clients.find(function(x){ return x.id === self.clientId; });
    if (!c) return;
    var orgId = c.organization_id;
    var cutoff = null;
    if (this.period !== 'all') {
      var d = new Date();
      d.setDate(d.getDate() - parseInt(this.period));
      cutoff = d.toISOString();
    }

    window.Helpers.renderPage('<div class="admin-page-wrapper"><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Chargement...</div></div>');

    var campQ = window.DB.from('campaigns').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
    if (cutoff) campQ = campQ.gte('created_at', cutoff);

    Promise.all([
      campQ,
      window.DB.from('sender_ids').select('*').eq('organization_id', orgId),
      window.DB.from('contacts').select('id', { count: 'exact', head: true }).eq('organization_id', orgId),
      window.DB.from('credit_accounts').select('*').eq('organization_id', orgId).single()
    ]).then(function(r) {
      self._render(c, {
        camps:    r[0].data || [],
        sids:     r[1].data || [],
        contacts: r[2].count || 0,
        credits:  r[3].data || {}
      });
    }).catch(function() { self._render(c, { camps:[], sids:[], contacts:0, credits:{} }); });
  },

  _render: function(c, data) {
    var self = this;
    var name = (c.prenom + ' ' + c.nom).trim() || 'Sans nom';
    var initials = name !== 'Sans nom' ? name.split(' ').map(function(w){ return w[0]||''; }).join('').slice(0,2).toUpperCase() : '?';
    var totalSms = data.camps.reduce(function(a,x){ return a+(x.contacts_count||0); }, 0);

    var stMap = { pending:'En attente', approved:'Approuve', rejected:'Refusé', suspended:'Suspendu' };
    var stCls = { pending:'tag-warning', approved:'tag-success', rejected:'tag-danger', suspended:'tag-neutral' };

    var sidsHtml = data.sids.length
      ? data.sids.map(function(s) {
          return '<div class="acd-sid-row">' +
            '<div><div class="acd-sid-name">' + window.Helpers.escapeHtml(s.name) + '</div>' +
            '<div style="font-size:11px;color:var(--color-text-muted)">' + (s.secteur||'') + ' · ' + (s.submitted_at?s.submitted_at.slice(0,10):'-') + '</div></div>' +
            '<span class="tag ' + (stCls[s.statut]||'tag-neutral') + '">' + (stMap[s.statut]||s.statut) + '</span>' +
          '</div>';
        }).join('')
      : '<div style="font-size:13px;color:var(--color-text-muted);padding:8px 0">Aucun Sender ID.</div>';

    var campStatus = { sending:'En cours', scheduled:'Programme', sent:'Terminée', cancelled:'Annule', draft:'Brouillon' };
    var campFiltered = this.campTab === 'toutes' ? data.camps : data.camps.filter(function(x){ return x.statut === self.campTab; });

    var campsHtml = campFiltered.length
      ? '<table class="acd-table"><thead><tr><th>Nom</th><th>Statut</th><th>Contacts</th><th>Date</th></tr></thead><tbody>' +
        campFiltered.map(function(camp) {
          return '<tr>' +
            '<td>' + window.Helpers.escapeHtml(camp.nom) + '</td>' +
            '<td><span class="tag tag-neutral" style="font-size:10px">' + (campStatus[camp.statut]||camp.statut) + '</span></td>' +
            '<td>' + (camp.contacts_count||0).toLocaleString('fr-FR') + '</td>' +
            '<td style="color:var(--color-text-muted)">' + (camp.created_at?camp.created_at.slice(0,10):'-') + '</td>' +
          '</tr>';
        }).join('') + '</tbody></table>'
      : '<div style="font-size:13px;color:var(--color-text-muted);padding:16px 0">Aucune campagne.</div>';

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
        '<button class="sid-back-btn" id="acd-back"><svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M10 3L5 7.5l5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Retour aux clients</button>' +

        '<div class="acd-profile">' +
          '<div class="acd-avatar">' + initials + '</div>' +
          '<div class="acd-profile-info">' +
            '<div class="acd-name">' + window.Helpers.escapeHtml(name) + '</div>' +
            '<div class="acd-email">' + window.Helpers.escapeHtml(c.email) + '</div>' +
            '<div style="margin-top:6px"><span class="tag ' + (c.role==='admin'?'tag-warning':'tag-neutral') + '">' + (c.role==='admin'?'Admin':'Client') + '</span></div>' +
          '</div>' +
        '</div>' +

        '<div class="acd-kpis">' +
          '<div class="acd-kpi"><div class="acd-kpi-val">' + data.contacts.toLocaleString('fr-FR') + '</div><div class="acd-kpi-lbl">Contacts</div></div>' +
          '<div class="acd-kpi"><div class="acd-kpi-val">' + data.camps.length + '</div><div class="acd-kpi-lbl">Campagnes</div></div>' +
          '<div class="acd-kpi"><div class="acd-kpi-val">' + totalSms.toLocaleString('fr-FR') + '</div><div class="acd-kpi-lbl">SMS envoyés</div></div>' +
          '<div class="acd-kpi"><div class="acd-kpi-val">' + (data.credits.sms_remaining||0).toLocaleString('fr-FR') + '</div><div class="acd-kpi-lbl">SMS restants</div></div>' +
          '<div class="acd-kpi"><div class="acd-kpi-val">' + data.sids.length + '</div><div class="acd-kpi-lbl">Sender IDs</div></div>' +
        '</div>' +

        '<div class="acd-grid">' +
          '<div class="acd-section">' +
            '<div class="acd-section-header">Sender IDs</div>' +
            '<div class="acd-sids">' + sidsHtml + '</div>' +
          '</div>' +
          '<div class="acd-section">' +
            '<div class="acd-section-header">Crédits</div>' +
            '<div class="acd-credits">' +
              '<div class="acd-credit-big">' + (data.credits.sms_remaining||0).toLocaleString('fr-FR') + '<span style="font-size:14px;font-weight:400;margin-left:6px">SMS</span></div>' +
              '<div style="font-size:12px;color:var(--color-text-muted);margin-top:4px">Solde : ' + (data.credits.balance_fcfa||0).toLocaleString('fr-FR') + ' FCFA</div>' +
            '</div>' +
          '</div>' +
        '</div>' +

        '<div class="acd-section">' +
          '<div class="acd-section-header" style="display:flex;justify-content:space-between;align-items:center">' +
            '<span>Campagnes</span>' +
            '<div style="display:flex;gap:8px">' +
              '<select id="acd-period" style="font-size:12px;border:var(--border-thin);border-radius:var(--radius-md);padding:5px 10px;background:var(--color-surface)">' +
                '<option value="7"'   + (self.period==='7'?  ' selected':'') + '>7 jours</option>' +
                '<option value="30"'  + (self.period==='30'? ' selected':'') + '>30 jours</option>' +
                '<option value="90"'  + (self.period==='90'? ' selected':'') + '>90 jours</option>' +
                '<option value="all"' + (self.period==='all'?' selected':'') + '>Tout</option>' +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="acd-camp-tabs">' +
            ['toutes','draft','sending','scheduled','sent','cancelled'].map(function(t) {
              var labels = { toutes:'Toutes', draft:'Brouillons', sending:'En cours', scheduled:'Programmees', sent:'Terminées', cancelled:'Annulees' };
              return '<button class="acd-camp-tab ' + (self.campTab===t?'active':'') + '" data-tab="' + t + '">' + labels[t] + '</button>';
            }).join('') +
          '</div>' +
          campsHtml +
        '</div>' +

      '</div>'
    );

    document.getElementById('acd-back').addEventListener('click', function() {
      window.PageAdminClients.render();
    });

    document.getElementById('acd-period').addEventListener('change', function() {
      self.period = this.value;
      self._load();
    });

    document.querySelectorAll('.acd-camp-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        self.campTab = tab.getAttribute('data-tab');
        document.querySelectorAll('.acd-camp-tab').forEach(function(t){ t.classList.remove('active'); });
        tab.classList.add('active');
        var filtered = self.campTab === 'toutes' ? data.camps : data.camps.filter(function(x){ return x.statut === self.campTab; });
        var campStatus = { sending:'En cours', scheduled:'Programme', sent:'Terminée', cancelled:'Annule', draft:'Brouillon' };
        var html = filtered.length
          ? '<table class="acd-table"><thead><tr><th>Nom</th><th>Statut</th><th>Contacts</th><th>Date</th></tr></thead><tbody>' +
            filtered.map(function(camp) {
              return '<tr><td>' + window.Helpers.escapeHtml(camp.nom) + '</td><td><span class="tag tag-neutral" style="font-size:10px">' + (campStatus[camp.statut]||camp.statut) + '</span></td><td>' + (camp.contacts_count||0).toLocaleString('fr-FR') + '</td><td style="color:var(--color-text-muted)">' + (camp.created_at?camp.created_at.slice(0,10):'-') + '</td></tr>';
            }).join('') + '</tbody></table>'
          : '<div style="font-size:13px;color:var(--color-text-muted);padding:16px 0">Aucune campagne.</div>';
        tab.closest('.acd-section').querySelector('table, div:last-child').outerHTML = html;
      });
    });
  }
};
