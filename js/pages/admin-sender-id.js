window.PageAdminSenderId = {
  activeTab: 'pending',
  sids: [],

  render: function() {
    this.activeTab = 'pending';
    window.Helpers.renderPage('<div class="admin-page-wrapper"><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Chargement...</div></div>');
    this._load();
  },

  _load: function() {
    var self = this;
    window.DB.from('sender_ids')
      .select('*, users(prenom,nom,email)')
      .order('submitted_at', { ascending: false })
      .then(function(res) {
        self.sids = res.data || [];
        self._renderList();
      })
      .catch(function() { self.sids = []; self._renderList(); });
  },

  _byTab: function(tab) {
    return this.sids.filter(function(s) {
      if (tab === 'pending')   return s.statut === 'pending';
      if (tab === 'approved')  return s.statut === 'approved' && (s.activity_status || 'actif') === 'actif';
      if (tab === 'suspended') return s.statut === 'approved' && s.activity_status === 'suspendu';
      if (tab === 'blocked')   return s.statut === 'approved' && s.activity_status === 'bloque';
      if (tab === 'rejected')  return s.statut === 'rejected';
      return true;
    });
  },

  _renderList: function() {
    var self = this;
    var tabs = [
      { id: 'pending',   label: 'En attente' },
      { id: 'approved',  label: 'Validés' },
      { id: 'suspended', label: 'Suspendus' },
      { id: 'blocked',   label: 'Bloques' },
      { id: 'rejected',  label: 'Refusés' }
    ];

    var tabsHtml = tabs.map(function(t) {
      var count = self._byTab(t.id).length;
      return '<button class="asd-tab ' + (self.activeTab === t.id ? 'active' : '') + '" data-tab="' + t.id + '">' +
        t.label + (count > 0 ? '<span class="asd-tab-count">' + count + '</span>' : '') +
      '</button>';
    }).join('');

    var filtered = this._byTab(this.activeTab);

    var cards = filtered.length
      ? filtered.map(function(s) { return self._card(s); }).join('')
      : '<div style="padding:48px;text-align:center;color:var(--color-text-muted);font-size:14px">Aucun Sender ID dans cette categorie.</div>';

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
        '<div class="admin-page-header">' +
          '<div>' +
            '<div class="admin-breadcrumb">Administration</div>' +
            '<div class="admin-page-title">Validation Sender ID</div>' +
            '<div class="admin-page-subtitle">' + self.sids.length + ' Sender ID au total</div>' +
          '</div>' +
          '<button class="admin-btn" onclick="window.PageAdminSenderId._load()">Actualiser</button>' +
        '</div>' +
        '<div class="asd-tabs">' + tabsHtml + '</div>' +
        '<div id="asd-grid">' + cards + '</div>' +
      '</div>'
    );

    document.querySelectorAll('.asd-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        self.activeTab = tab.getAttribute('data-tab');
        document.querySelectorAll('.asd-tab').forEach(function(t){ t.classList.remove('active'); });
        tab.classList.add('active');
        var f = self._byTab(self.activeTab);
        document.getElementById('asd-grid').innerHTML = f.length
          ? f.map(function(s){ return self._card(s); }).join('')
          : '<div style="padding:48px;text-align:center;color:var(--color-text-muted);font-size:14px">Aucun Sender ID dans cette categorie.</div>';
        self._bindCardEvents();
      });
    });

    this._bindCardEvents();
  },

  _card: function(s) {
    var stMap = { pending:'En attente', approved:'Approuve', rejected:'Refusé', suspended:'Suspendu', bloque:'Bloque' };
    var stCls = { pending:'admin-tag-warn', approved:'admin-tag-success', rejected:'admin-tag-danger' };
    var act = s.activity_status || 'actif';
    var actMap = { actif:'Actif', suspendu:'Suspendu', bloque:'Bloque' };
    var actCls = { actif:'admin-tag-success', suspendu:'admin-tag-warn', bloque:'admin-tag-danger' };

    var age = s.submitted_at ? Math.floor((Date.now() - new Date(s.submitted_at).getTime()) / 3600000) + 'h' : '-';
    var owner = s.users ? ((s.users.prenom||'') + ' ' + (s.users.nom||'')).trim() || s.users.email : '-';

    var actions = '';
    if (s.statut === 'pending') {
      actions = '<button class="admin-btn-sm asd-action" style="background:#1D9E75;color:#fff;border-color:#1D9E75" data-action="approve" data-id="' + s.id + '">Approuver</button>' +
        '<button class="admin-btn-sm asd-action" style="background:rgba(163,45,45,0.1);color:#A32D2D;border-color:rgba(163,45,45,0.2)" data-action="reject" data-id="' + s.id + '">Refusér</button>';
    } else if (s.statut === 'approved' && act === 'actif') {
      actions = '<button class="admin-btn-sm asd-action" data-action="suspend" data-id="' + s.id + '">Suspendre</button>' +
        '<button class="admin-btn-sm asd-action" style="color:#A32D2D;border-color:rgba(163,45,45,0.2)" data-action="block" data-id="' + s.id + '">Bloquer</button>' +
        '<button class="admin-btn-sm asd-action" style="color:#A32D2D" data-action="delete" data-id="' + s.id + '">Supprimer</button>';
    } else if (s.statut === 'approved' && act === 'suspendu') {
      actions = '<button class="admin-btn-sm asd-action" style="background:#1D9E75;color:#fff;border-color:#1D9E75" data-action="reactivate" data-id="' + s.id + '">Réactiver</button>' +
        '<button class="admin-btn-sm asd-action" style="color:#A32D2D;border-color:rgba(163,45,45,0.2)" data-action="block" data-id="' + s.id + '">Bloquer</button>';
    } else if (s.statut === 'approved' && act === 'bloque') {
      actions = '<button class="admin-btn-sm asd-action" data-action="unblock" data-id="' + s.id + '">Debloquer</button>' +
        '<button class="admin-btn-sm asd-action" style="color:#A32D2D" data-action="delete" data-id="' + s.id + '">Supprimer</button>';
    }

    return '<div class="asd-card" data-id="' + s.id + '">' +
      '<div class="asd-card-top">' +
        '<div>' +
          '<div class="asd-card-name">' + window.Helpers.escapeHtml(s.name) + '</div>' +
          '<div class="asd-card-sub">' + window.Helpers.escapeHtml(owner) + ' · ' + (s.secteur||'-') + ' · ' + age + '</div>' +
        '</div>' +
        '<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">' +
          '<span class="admin-tag ' + (stCls[s.statut]||'admin-tag-neutral') + '">' + (stMap[s.statut]||s.statut) + '</span>' +
          (s.statut === 'approved' ? '<span class="admin-tag ' + (actCls[act]||'admin-tag-neutral') + '">' + (actMap[act]||act) + '</span>' : '') +
        '</div>' +
      '</div>' +
      '<div class="asd-card-actions">' +
        '<button class="admin-btn-sm asd-détail-btn" data-id="' + s.id + '">Voir la fiche</button>' +
        actions +
      '</div>' +
    '</div>';
  },

  _bindCardEvents: function() {
    var self = this;

    document.querySelectorAll('.asd-détail-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        self._openDétail(btn.getAttribute('data-id'));
      });
    });

    document.querySelectorAll('.asd-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.admin-btn-sm')) return;
        self._openDétail(card.getAttribute('data-id'));
      });
    });

    document.querySelectorAll('.asd-action').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var action = btn.getAttribute('data-action');
        var id     = btn.getAttribute('data-id');
        self._doAction(action, id);
      });
    });
  },

  _openDétail: function(id) {
    var self = this;
    var s = this.sids.find(function(x){ return x.id === id; });
    if (!s) return;

    var owner = s.users ? ((s.users.prenom||'') + ' ' + (s.users.nom||'')).trim() || s.users.email || '-' : '-';
    var row = function(l, v) {
      return '<div class="asd-info-row"><span class="asd-info-label">' + l + '</span><span class="asd-info-val">' + window.Helpers.escapeHtml(v||'-') + '</span></div>';
    };

    window.DB.from('sender_id_documents').select('*').eq('sender_id_id', id)
      .then(function(res) {
        var docs = res.data || [];
        var docLabels = { rccm:'Attestation RCCM', statut:'Statut de la societe', fiscal:'Attestation fiscale', cni:'CNI représentant', lettre:'Lettre engagement' };

        var docsHtml = docs.length
          ? docs.map(function(d) {
              return '<div class="asd-doc-row">' +
                '<span style="font-size:13px">' + (docLabels[d.type]||d.type) + '</span>' +
                '<a class="admin-btn-sm" href="' + self._docUrl(d.file_url) + '" target="_blank" download>Télécharger</a>' +
              '</div>';
            }).join('')
          : '<div style="font-size:13px;color:var(--color-text-muted)">Aucun document joint.</div>';

        var pendingActions = s.statut === 'pending'
          ? '<div class="asd-détail-actions">' +
              '<div class="campnew-field" style="flex:1"><label>Note (optionnel)</label><textarea id="détail-note" rows="2" placeholder="Motif de refus, demande de complement..."></textarea></div>' +
              '<div style="display:flex;gap:8px;margin-top:8px">' +
                '<button class="btn" onclick="window.Helpers.closeModal()">Fermer</button>' +
                '<button class="btn" style="color:#A32D2D;border-color:rgba(163,45,45,0.3)" id="détail-reject-btn">Refusér</button>' +
                '<button class="btn btn-primary" id="détail-approve-btn">Approuver</button>' +
              '</div>' +
            '</div>'
          : '<div class="modal-actions"><button class="btn" onclick="window.Helpers.closeModal()">Fermer</button></div>';

        window.Helpers.openModal(
          '<div class="modal-box modal-wide">' +
            '<div class="modal-header-row">' +
              '<div>' +
                '<div style="font-size:20px;font-weight:800;letter-spacing:0.5px">' + window.Helpers.escapeHtml(s.name) + '</div>' +
                '<div style="font-size:12px;color:var(--color-text-muted);margin-top:3px">' + window.Helpers.escapeHtml(owner) + '</div>' +
              '</div>' +
              '<button class="modal-close-btn" onclick="window.Helpers.closeModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' +
            '</div>' +
            '<div class="asd-détail-grid">' +
              '<div>' +
                '<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-muted);margin-bottom:10px">Informations</div>' +
                row('Représentant', s.représentant_legal) +
                row('Email', s.email_contact) +
                row('Téléphone', s.telephone) +
                row('RCCM', s.rccm) +
                row('NIU', s.niu) +
                row('Secteur', s.secteur) +
                row('Usage', s.usage_principal) +
                row('Soumis le', s.submitted_at ? s.submitted_at.slice(0,10) : '-') +
                row('Validé le', s.reviewed_at ? s.reviewed_at.slice(0,10) : 'En attente') +
                (s.admin_note ? row('Note admin', s.admin_note) : '') +
              '</div>' +
              '<div>' +
                '<div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--color-text-muted);margin-bottom:10px">Documents</div>' +
                docsHtml +
              '</div>' +
            '</div>' +
            pendingActions +
          '</div>'
        );

        if (s.statut === 'pending') {
          var approveBtn = document.getElementById('détail-approve-btn');
          var rejectBtn  = document.getElementById('détail-reject-btn');
          if (approveBtn) approveBtn.addEventListener('click', function() {
            var note = (document.getElementById('détail-note')||{}).value || '';
            window.Helpers.closeModal();
            self._doActionWithNote('approve', id, note);
          });
          if (rejectBtn) rejectBtn.addEventListener('click', function() {
            var note = (document.getElementById('détail-note')||{}).value || '';
            if (!note.trim()) { window.Toast.error('Entrez un motif de refus'); return; }
            window.Helpers.closeModal();
            self._doActionWithNote('reject', id, note);
          });
        }
      });
  },

  _docUrl: function(path) {
    if (!path) return '#';
    return 'https://lzdhipjgguwpqljahogu.supabase.co/storage/v1/object/authenticated/kyc-documents/' + path;
  },

  _doAction: function(action, id) {
    var self = this;
    if (action === 'approve') { self._doActionWithNote('approve', id, ''); return; }
    if (action === 'reject') {
      window.Helpers.openModal(
        '<div class="modal-box">' +
          '<div class="modal-title modal-title-danger">Refusér ce Sender ID</div>' +
          '<div class="campnew-field"><label>Motif du refus <span class="field-req">*</span></label><textarea id="reject-note" rows="3" placeholder="Expliquez la raison du refus a l\'utilisateur..."></textarea></div>' +
          '<div class="modal-actions"><button class="btn" onclick="window.Helpers.closeModal()">Annuler</button><button class="btn btn-danger-solid" id="confirm-reject-btn">Confirmer le refus</button></div>' +
        '</div>'
      );
      document.getElementById('confirm-reject-btn').addEventListener('click', function() {
        var note = document.getElementById('reject-note').value.trim();
        if (!note) { window.Toast.error('Motif requis'); return; }
        window.Helpers.closeModal();
        self._doActionWithNote('reject', id, note);
      });
      return;
    }
    if (action === 'delete') {
      window.Helpers.openModal(
        '<div class="modal-box">' +
          '<div class="modal-title modal-title-danger">Supprimer ce Sender ID</div>' +
          '<div class="modal-desc">Cette action est irreversible.</div>' +
          '<div class="modal-actions"><button class="btn" onclick="window.Helpers.closeModal()">Annuler</button><button class="btn btn-danger-solid" id="confirm-delete-sid">Supprimer</button></div>' +
        '</div>'
      );
      document.getElementById('confirm-delete-sid').addEventListener('click', function() {
        var s = self.sids.find(function(x){ return x.id === id; });
        window.DB.from('sender_ids').delete().eq('id', id).then(function() {
          if (s) {
            window.DB.from('users').select('id').eq('organization_id', s.organization_id).then(function(ur) {
              var uid = ur.data && ur.data[0] && ur.data[0].id;
              window.HookEvents.senderIdDeleted(s, uid);
            });
          }
          window.Helpers.closeModal();
          window.Toast.success('Sender ID supprime');
          self._load();
        });
      });
      return;
    }
    var updates = {};
    if (action === 'suspend')    { updates = { activity_status: 'suspendu' }; }
    if (action === 'block')      { updates = { activity_status: 'bloque' }; }
    if (action === 'reactivate') { updates = { activity_status: 'actif' }; }
    if (action === 'unblock')    { updates = { activity_status: 'actif' }; }

    var s = self.sids.find(function(x){ return x.id === id; });
    window.DB.from('sender_ids').update(updates).eq('id', id).then(function() {
      if (s) {
        window.DB.from('users').select('id').eq('organization_id', s.organization_id).then(function(ur) {
          var uid = ur.data && ur.data[0] && ur.data[0].id;
          if (action === 'suspend')    window.HookEvents.senderIdSuspended(s, uid);
          if (action === 'block')      window.HookEvents.senderIdBlocked(s, uid);
          if (action === 'reactivate') window.HookEvents.senderIdReactivated(s, uid);
          if (action === 'unblock')    window.HookEvents.senderIdReactivated(s, uid);
        });
      }
      var label = { suspend:'Suspendu', block:'Bloque', reactivate:'Réactiver', unblock:'Debloque' }[action] || 'Mise a jour';
      window.Toast.success(label);
      self._load();
    });
  },

  _doActionWithNote: function(action, id, note) {
    var self = this;
    var updates = {};
    if (action === 'approve') {
      updates = { statut: 'approved', activity_status: 'actif', reviewed_at: new Date().toISOString(), admin_note: note || null };
    } else {
      updates = { statut: 'rejected', rejected_at: new Date().toISOString(), admin_note: note || null };
    }
    var s = self.sids.find(function(x){ return x.id === id; });
    window.DB.from('sender_ids').update(updates).eq('id', id).then(function(res) {
      if (res.error) { window.Toast.error(res.error.message); return; }
      if (s) {
        window.DB.from('users').select('id').eq('organization_id', s.organization_id).then(function(ur) {
          var uid = ur.data && ur.data[0] && ur.data[0].id;
          if (action === 'approve') window.HookEvents.senderIdApproved(s, uid);
          else window.HookEvents.senderIdRejected(s, uid, note);
        });
      }
      var label = action === 'approve' ? 'Sender ID approuve' : 'Sender ID refusé';
      window.Toast.success(label);
      self._load();
    });
  }
};
