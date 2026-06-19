window.PageSenderId = {
  view: 'list',
  selectedId: null,
  senderIds: [],

  render: function() {
    if (!window.HookAuth.isLoggedIn()) { window.Router.navigate('/auth'); return; }
    window.Helpers.renderPage('<div class="page-wrapper"><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Chargement...</div></div>');
    this._load();
  },

  _load: function() {
    var self = this;
    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    if (!orgId) { self.senderIds = []; self.renderList(); return; }
    window.DB.from('sender_ids').select('*').eq('organization_id', orgId || window.HookAuth.user.id).order('submitted_at', { ascending: false })
      .then(function(res) {
        var now = Date.now();
        var twoDays = 2 * 24 * 60 * 60 * 1000;
        self.senderIds = (res.data || []).filter(function(s) {
          if (s.statut !== 'rejected') return true;
          var rejDate = s.rejected_at ? new Date(s.rejected_at).getTime() : 0;
          return rejDate && (now - rejDate) < twoDays;
        });
        if (self.view === 'detail' && self.selectedId) self.renderDetail();
        else self.renderList();
      })
      .catch(function() { self.senderIds = []; self.renderList(); });
  },

  stMap: { pending:'En attente', approved:'Approuve', rejected:'Refusé', suspended:'Suspendu' },
  stCls:  { pending:'tag-warning', approved:'tag-success', rejected:'tag-danger', suspended:'tag-neutral' },
  actMap: { actif:'Actif', suspendu:'Suspendu', bloque:'Bloque' },
  actCls: { actif:'tag-success', suspendu:'tag-neutral', bloque:'tag-danger' },

  renderList: function() {
    var self = this;
    var sids = this.senderIds;

    var cards = sids.map(function(s) {
      var act = s.activity_status || 'actif';
      var stLabel  = self.stMap[s.statut]  || s.statut;
      var stClass  = self.stCls[s.statut]  || 'tag-neutral';
      var actLabel = self.actMap[act]      || act;
      var actClass = self.actCls[act]      || 'tag-neutral';
      var date = s.reviewed_at ? 'Validé le ' + s.reviewed_at.slice(0,10) : 'Soumis le ' + (s.submitted_at ? s.submitted_at.slice(0,10) : '-');
      return '<div class="sid-card" onclick="window.PageSenderId.openDetail(\'' + s.id + '\')">' +
        '<div class="sid-card-header">' +
          '<div class="sid-card-name">' + window.Helpers.escapeHtml(s.name) + '</div>' +
          '<div style="display:flex;gap:6px">' +
            '<span class="tag ' + stClass + '">' + stLabel + '</span>' +
            '<span class="tag ' + actClass + '">' + actLabel + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="sid-card-meta"><span>' + window.Helpers.escapeHtml(s.secteur||'') + '</span><span>' + date + '</span></div>' +
        '<div class="sid-card-footer"><span class="sid-card-hint">Voir les détails</span><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M5 3l4 4-4 4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div>' +
      '</div>';
    }).join('');

    window.Helpers.renderPage(
      '<div class="page-wrapper"><div class="page-card">' +
        '<div class="page-header">' +
          '<div><div class="breadcrumb">Sender ID</div><div class="page-title">Mes Sender IDs</div>' +
          '<div class="page-subtitle">' + sids.length + ' identifiant' + (sids.length > 1 ? 's' : '') + '</div></div>' +
          '<button class="btn btn-primary" onclick="window.Router.navigate(\'/sender-id/new\')">' +
            '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 2v11M2 7.5h11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Nouveau Sender ID' +
          '</button>' +
        '</div>' +
        '<div class="sid-info-banner"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 7v5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><circle cx="8" cy="5" r="0.75" fill="currentColor"/></svg>' +
        '<span>Chaque Sender ID doit etre validé par notre equipe. Validation sous 24-48h après reception des documents.</span></div>' +
        '<div class="sid-grid">' + cards +
          '<div class="sid-card sid-card-empty" onclick="window.Router.navigate(\'/sender-id/new\')">' +
            '<div class="sid-empty-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></div>' +
            '<div class="sid-empty-label">Demander un nouveau Sender ID</div>' +
          '</div>' +
        '</div>' +
      '</div></div>'
    );
  },

  openDetail: function(id) {
    this.selectedId = id;
    this.view = 'detail';
    this.renderDetail();
  },

  renderDetail: function() {
    var self = this;
    var s = this.senderIds.find(function(x){ return x.id === self.selectedId; });
    if (!s) { this.view = 'list'; this.renderList(); return; }

    var act = s.activity_status || 'actif';
    var tlSteps = [
      { label: 'Demande envoyée', done: true },
      { label: 'Documents reçus', done: true },
      { label: 'Validation en cours', done: s.statut !== 'pending', current: s.statut === 'pending' },
      { label: 'Activation operateurs', done: s.statut === 'approved', current: s.statut === 'approved' }
    ];

    var timeline = s.statut === 'pending' || s.statut === 'approved'
      ? '<div class="sid-timeline">' + tlSteps.map(function(step) {
          var cls = step.current ? 'current' : step.done ? 'done' : '';
          return '<div class="sid-timeline-step ' + cls + '"><div class="sid-tl-dot"></div><div class="sid-tl-label">' + step.label + '</div></div>';
        }).join('') + '</div>'
      : '';

    var adminNote = s.admin_note
      ? '<div class="sid-détail-section"><div class="sid-section-title">Note de l\'equipe Hook</div><div class="sid-description">' + window.Helpers.escapeHtml(s.admin_note) + '</div></div>'
      : '';

    window.Helpers.renderPage(
      '<div class="page-wrapper">' +
        '<button class="sid-back-btn" onclick="window.PageSenderId.backToList()">' +
          '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M10 3L5 7.5l5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Retour a la liste' +
        '</button>' +
        '<div class="page-card">' +
          '<div class="sid-détail-header">' +
            '<div class="sid-détail-name-wrap">' +
              '<div class="sid-détail-name">' + window.Helpers.escapeHtml(s.name) + '</div>' +
              '<div style="display:flex;gap:6px;margin-top:6px">' +
                '<span class="tag ' + (self.stCls[s.statut]||'tag-neutral') + ' sid-détail-tag">' + (self.stMap[s.statut]||s.statut) + '</span>' +
                '<span class="tag ' + (self.actCls[act]||'tag-neutral') + '">' + (self.actMap[act]||act) + '</span>' +
              '</div>' +
            '</div>' +
            '<div class="sid-détail-actions">' +
              '<button class="btn btn-sm" onclick="window.PageSenderId.openModal(\'modif\',\'' + s.id + '\')">' +
                '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M8.5 2.5l2 2L4 11H2v-2L8.5 2.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/></svg>Modifier' +
              '</button>' +
              '<button class="btn btn-sm btn-danger" onclick="window.PageSenderId.openModal(\'suppr\',\'' + s.id + '\')">' +
                '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3.5h9M4.5 3.5V2.5h4v1M5.5 6v4M7.5 6v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><rect x="3" y="3.5" width="7" height="8" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>Supprimer' +
              '</button>' +
            '</div>' +
          '</div>' +
          timeline +
          '<div class="sid-détail-grid">' +
            '<div class="sid-détail-section"><div class="sid-section-title">Informations</div>' +
              '<table class="sid-info-table">' +
                '<tr><td>Représentant</td><td>' + window.Helpers.escapeHtml(s.représentant_legal||'N/A') + '</td></tr>' +
                '<tr><td>Email</td><td>' + window.Helpers.escapeHtml(s.email_contact||'N/A') + '</td></tr>' +
                '<tr><td>Téléphone</td><td>' + window.Helpers.escapeHtml(s.telephone||'N/A') + '</td></tr>' +
                '<tr><td>RCCM</td><td>' + window.Helpers.escapeHtml(s.rccm||'N/A') + '</td></tr>' +
                '<tr><td>NIU</td><td>' + window.Helpers.escapeHtml(s.niu||'N/A') + '</td></tr>' +
                '<tr><td>Secteur</td><td>' + window.Helpers.escapeHtml(s.secteur||'N/A') + '</td></tr>' +
                '<tr><td>Usage</td><td>' + window.Helpers.escapeHtml(s.usage_principal||'N/A') + '</td></tr>' +
                '<tr><td>Soumis le</td><td>' + (s.submitted_at ? s.submitted_at.slice(0,10) : 'N/A') + '</td></tr>' +
                '<tr><td>Validé le</td><td>' + (s.reviewed_at ? s.reviewed_at.slice(0,10) : 'En attente') + '</td></tr>' +
              '</table>' +
            '</div>' +
            adminNote +
          '</div>' +
        '</div>' +
      '</div>'
    );
  },

  backToList: function() { this.view = 'list'; this.selectedId = null; this.renderList(); },

  openModal: function(type, id) {
    var s = id ? this.senderIds.find(function(x){ return x.id === id; }) : null;
    if (type === 'new')   this._modalForm(null);
    if (type === 'modif') this._modalForm(s);
    if (type === 'suppr') this._modalSuppr(s);
  },

  _modalForm: function(s) {
    var isEdit = !!s;
    var v = function(f){ return s ? window.Helpers.escapeHtml(s[f]||'') : ''; };
    var selectOpts = function(arr, val) {
      return arr.map(function(o){ return '<option value="'+o+'"'+(s&&s[val]===o?' selected':'')+'>'+o+'</option>'; }).join('');
    };

    window.Helpers.openModal(
      '<div class="modal-box modal-wide">' +
        '<div class="modal-header-row">' +
          '<div><div class="modal-title">' + (isEdit ? 'Modifier le Sender ID' : 'Demander un Sender ID') + '</div>' +
          (isEdit ? '<div style="font-size:12px;color:var(--color-text-muted);margin-top:2px">Sender ID : <strong>' + window.Helpers.escapeHtml(s.name) + '</strong></div>' : '') +
          '</div>' +
          '<button class="modal-close-btn" onclick="window.Helpers.closeModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' +
        '</div>' +

        '<div class="sid-form">' +
          '<div class="sid-form-row">' +
            '<div class="campnew-field"><label>Nom du Sender ID <span class="field-req">*</span></label><input type="text" id="sf-nom" placeholder="Ex: MONENTREPRISE" maxlength="11"  value="' + (s?s.name:'') + '" style="text-transform:uppercase"><div class="field-hint">11 caracteres max</div></div>' +
            '<div class="campnew-field"><label>Secteur <span class="field-req">*</span></label><select id="sf-secteur"><option value="">Choisir...</option>' + selectOpts(['Banque','Assurance','E-commerce','Commerce','Sante','Education','ONG','Autre'],'secteur') + '</select></div>' +
          '</div>' +
          '<div class="campnew-field"><label>Usage principal <span class="field-req">*</span></label><input type="text" id="sf-usage" placeholder="Ex: Rappels échéance et alertes clients" value="' + v('usage_principal') + '"></div>' +
          '<div class="sid-form-row">' +
            '<div class="campnew-field"><label>Représentant legal <span class="field-req">*</span></label><input type="text" id="sf-rep" placeholder="Nom complet" value="' + v('représentant_legal') + '"></div>' +
            '<div class="campnew-field"><label>Téléphone <span class="field-req">*</span></label><input type="tel" id="sf-tel" placeholder="+242 06 000 00 00" value="' + v('telephone') + '"></div>' +
          '</div>' +
          '<div class="sid-form-row">' +
            '<div class="campnew-field"><label>RCCM <span class="field-req">*</span></label><input type="text" id="sf-rccm" placeholder="CG-BZV-01-2025-B12-00000" value="' + v('rccm') + '"></div>' +
            '<div class="campnew-field"><label>NIU</label><input type="text" id="sf-niu" placeholder="P20250000000R" value="' + v('niu') + '"></div>' +
          '</div>' +
          '<div class="campnew-field"><label>Email de contact <span class="field-req">*</span></label><input type="email" id="sf-email" placeholder="contact@entreprise.cg" value="' + v('email_contact') + '"></div>' +

          '<div class="sid-docs-section"><div class="sid-docs-title">Documents requis <span class="field-req">*</span></div>' +
            '<div class="sid-docs-grid">' +
              this._docField('doc-rccm',    'Attestation RCCM',          true) +
              this._docField('doc-statut',  'Statut de la societe',      true) +
              this._docField('doc-fiscal',  'Attestation fiscale',       true) +
              this._docField('doc-cni',     'CNI représentant legal',    true) +
              this._docField('doc-lettre',  'Lettre engagement (optionnel)', false) +
            '</div>' +
          '</div>' +

          (isEdit ? '<div class="campnew-field"><label>Motif de la modification</label><textarea id="sf-motif" rows="2" placeholder="Expliquez la raison de cette modification..."></textarea></div>' : '') +
        '</div>' +

        '<div style="background:var(--color-beige);border-radius:var(--radius-md);padding:12px 14px;font-size:13px;color:var(--color-text-secondary);margin-bottom:16px">Votre demande sera examinee sous 24-48h. Vous recevrez un email de confirmation.</div>' +
        '<div class="modal-footer-actions">' +
          '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
          '<button class="btn btn-primary" id="btn-submit-sf">' + (isEdit ? 'Soumettree la modification' : 'Soumettree la demande') + '</button>' +
        '</div>' +
      '</div>'
    );

    this._bindDocUploads();
    document.getElementById('btn-submit-sf').addEventListener('click', function() {
      window.PageSenderId._submitForm(s ? s.id : null);
    });
  },

  _docField: function(id, label, required) {
    return '<label class="doc-upload-zone" for="' + id + '">' +
      '<svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 12V5M6 8l3-3 3 3" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><rect x="2" y="13" width="14" height="3" rx="1.5" stroke="currentColor" stroke-width="1.3"/></svg>' +
      '<span class="doc-upload-label">' + label + (required ? ' <span class="field-req">*</span>' : '') + '</span>' +
      '<span class="doc-upload-hint">PDF, JPG, PNG</span>' +
      '<input type="file" id="' + id + '" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none">' +
    '</label>';
  },

  _bindDocUploads: function() {
    document.querySelectorAll('.doc-upload-zone input[type=file]').forEach(function(input) {
      input.addEventListener('change', function() {
        if (!input.files || !input.files[0]) return;
        var zone = input.closest('.doc-upload-zone');
        if (zone) {
          zone.classList.add('uploaded');
          zone.querySelector('.doc-upload-label').textContent = input.files[0].name;
        }
      });
    });
  },

  _submitForm: function(existingId) {
    var get = function(id){ return document.getElementById(id); };
    var val = function(id){ return get(id) ? get(id).value.trim() : ''; };

    var nom    = val('sf-nom').toUpperCase();
    var secteur= val('sf-secteur');
    var usage  = val('sf-usage');
    var rep    = val('sf-rep');
    var tel    = val('sf-tel');
    var rccm   = val('sf-rccm');
    var email  = val('sf-email');

    if (!nom)    { window.Toast.error('Nom du Sender ID requis'); return; }
    if (!secteur){ window.Toast.error('Secteur requis'); return; }
    if (!usage)  { window.Toast.error('Usage principal requis'); return; }
    if (!rep)    { window.Toast.error('Représentant legal requis'); return; }
    if (!tel)    { window.Toast.error('Téléphone requis'); return; }
    if (!rccm)   { window.Toast.error('RCCM requis'); return; }
    if (!email)  { window.Toast.error('Email requis'); return; }

    var docRccm   = get('doc-rccm');
    var docStatut = get('doc-statut');
    var docFiscal = get('doc-fiscal');
    var docCni    = get('doc-cni');
    if (!docRccm   || !docRccm.files   || !docRccm.files[0])   { window.Toast.error('Attestation RCCM requise'); return; }
    if (!docStatut || !docStatut.files || !docStatut.files[0]) { window.Toast.error('Statut de la societe requis'); return; }
    if (!docFiscal || !docFiscal.files || !docFiscal.files[0]) { window.Toast.error('Attestation fiscale requise'); return; }
    if (!docCni    || !docCni.files    || !docCni.files[0])    { window.Toast.error('CNI du représentant requise'); return; }

    var btn = document.getElementById('btn-submit-sf');
    if (btn) { btn.textContent = 'Envoi...'; btn.disabled = true; }

    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    var uid   = window.HookAuth.user && window.HookAuth.user.id;
    var data  = {
      name: nom, secteur: secteur, usage_principal: usage,
      représentant_legal: rep, telephone: tel, rccm: rccm,
      niu: val('sf-niu'), email_contact: email,
      statut: 'pending', activity_status: 'actif', organization_id: orgId
    };

    var q = existingId
      ? window.DB.from('sender_ids').update(data).eq('id', existingId).select().single()
      : window.DB.from('sender_ids').insert(data).select().single();

    q.then(function(res) {
      if (res.error) { window.Toast.error(res.error.message); if(btn){btn.textContent='Soumettree';btn.disabled=false;} return; }
      var sidId = res.data.id;
      var docs = [
        { el: docRccm,   type: 'rccm' },
        { el: docStatut, type: 'statut' },
        { el: docFiscal, type: 'fiscal' },
        { el: docCni,    type: 'cni' }
      ];
      var lettre = get('doc-lettre');
      if (lettre && lettre.files && lettre.files[0]) docs.push({ el: lettre, type: 'lettre' });

      var done = 0;
      var total = docs.length;
      docs.forEach(function(d) {
        var path = uid + '/' + sidId + '/' + d.type + '_' + Date.now();
        window.DB.storage.from('kyc-documents').upload(path, d.el.files[0], { upsert: true })
          .then(function() {
            window.DB.from('sender_id_documents').insert({ sender_id_id: sidId, type: d.type, file_url: path }).then(function(){});
            done++;
            if (done >= total) {
              window.Helpers.closeModal();
              window.Toast.success('Demande soumise. Validation sous 24-48h. Vous serez notifie par email.');
              window.PageSenderId._load();
            }
          })
          .catch(function() {
            done++;
            if (done >= total) {
              window.Helpers.closeModal();
              window.Toast.success('Demande soumise.');
              window.PageSenderId._load();
            }
          });
      });
    });
  },

  _modalSuppr: function(s) {
    if (!s) return;
    window.Helpers.openModal(
      '<div class="modal-box">' +
        '<div class="modal-title modal-title-danger">Supprimer ce Sender ID</div>' +
        '<div class="modal-desc">Cette action est irreversible. Les campagnes utilisant <strong>' + window.Helpers.escapeHtml(s.name) + '</strong> seront interrompues.</div>' +
        '<div class="campnew-field"><label>Tapez <strong>' + window.Helpers.escapeHtml(s.name) + '</strong> pour confirmer</label><input type="text" id="del-confirm"></div>' +
        '<div class="modal-actions">' +
          '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
          '<button class="btn btn-danger-solid" onclick="window.PageSenderId._confirmDel(\'' + s.id + '\',\'' + window.Helpers.escapeHtml(s.name) + '\')">Supprimer</button>' +
        '</div>' +
      '</div>'
    );
  },

  _confirmDel: function(id, nom) {
    var val = document.getElementById('del-confirm');
    if (!val || val.value.trim().toUpperCase() !== nom.toUpperCase()) {
      window.Toast.error('Tapez exactement "' + nom + '"');
      return;
    }
    window.DB.from('sender_ids').delete().eq('id', id).then(function() {
      window.Helpers.closeModal();
      window.Toast.success('Sender ID supprime');
      window.PageSenderId.view = 'list';
      window.PageSenderId.selectedId = null;
      window.PageSenderId._load();
    });
  }
};

window.PageSenderIdKyc    = { render: function(){ window.PageSenderId.render(); } };
window.PageSenderIdStatus = { render: function(){ window.PageSenderId.render(); } };
