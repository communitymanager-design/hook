window.PageContacts = {
  contacts: [],
  groups: [],
  senderIds: [],
  activeGroup: null,
  search: '',

  render: function() {
    if (!window.HookAuth.isLoggedIn()) { window.Router.navigate('/auth'); return; }
    this._startRealtime();
    window.Helpers.renderPage('<div class="page-wrapper"><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Chargement...</div></div>');
    this._load();
  },

  _startRealtime: function() {
    var self = this;
    if (window._contactsRealtimeChannel) {
      window.DB.removeChannel(window._contactsRealtimeChannel);
      window._contactsRealtimeChannel = null;
    }
    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    if (!orgId) return;
    var ch = window.DB.channel('contacts-live-' + Date.now());
    ch.on('postgres_changes', {
      event: '*', schema: 'public', table: 'contacts',
      filter: 'organization_id=eq.' + orgId
    }, function() { self._load(); });
    ch.subscribe(function(status) {
      if (status === 'SUBSCRIBED') window._contactsRealtimeChannel = ch;
    });
  },

  _load: function() {
    var self = this;
    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    var contactsQ = orgId
      ? window.DB.from('contacts').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
      : window.DB.from('contacts').select('*').is('organization_id', null).order('created_at', { ascending: false });
    var segmentsQ = orgId
      ? window.DB.from('segments').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
      : window.DB.from('segments').select('*').is('organization_id', null).order('created_at', { ascending: false });
    var sidsQ = orgId
      ? window.DB.from('sender_ids').select('id,name').eq('organization_id', orgId).eq('statut', 'approved')
      : window.DB.from('sender_ids').select('id,name').is('organization_id', null).eq('statut', 'approved');
    Promise.all([
      contactsQ,
      segmentsQ,
      sidsQ
    ]).then(function(res) {
      self.contacts  = res[0].data || [];
      self.groups    = res[1].data || [];
      self.senderIds = res[2].data || [];
      self._renderPage();
    }).catch(function() { self._renderPage(); });
  },

  _filtered: function() {
    var self = this;
    return this.contacts.filter(function(c) {
      var matchGroup = !self.activeGroup || c.segment_id === self.activeGroup;
      var name = ((c.prenom||'') + ' ' + (c.nom||'') + ' ' + (c.telephone||'')).toLowerCase();
      var matchSearch = !self.search || name.indexOf(self.search.toLowerCase()) !== -1;
      return matchGroup && matchSearch;
    });
  },

  _renderPage: function() {
    var self = this;
    var filtered = this._filtered();
    var sids = this.senderIds;

    var groupList = '<div class="contacts-group ' + (!self.activeGroup ? 'active' : '') + '" data-group="">' +
      '<span>Tous les contacts</span><span class="contacts-group-count">' + self.contacts.length + '</span>' +
    '</div>' +
    self.groups.map(function(g) {
      var count = self.contacts.filter(function(c){ return c.segment_id === g.id; }).length;
      var sidName = '';
      if (g.sender_id_id) {
        var sid = sids.find(function(s){ return s.id === g.sender_id_id; });
        if (sid) sidName = '<div style="font-size:10px;color:var(--color-text-muted);margin-top:1px">' + sid.name + '</div>';
      }
      return '<div class="contacts-group ' + (self.activeGroup === g.id ? 'active' : '') + '" data-group="' + g.id + '">' +
        '<div><span>' + window.Helpers.escapeHtml(g.nom) + '</span>' + sidName + '</div>' +
        '<span class="contacts-group-count">' + count + '</span>' +
      '<button class="contacts-del-group-btn" data-del="' + g.id + '" title="Supprimer" onclick="event.stopPropagation()">' +'<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 3h9M5 3V2h3v1M3 3l.5 7h6l.5-7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>' +'</button>' +'<button class="contacts-qr-btn" data-qr="' + g.id + '" title="QR Code" onclick="event.stopPropagation()">' +
        '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="4.5" height="4.5" rx="0.8" stroke="currentColor" stroke-width="1.1"/><rect x="7.5" y="1" width="4.5" height="4.5" rx="0.8" stroke="currentColor" stroke-width="1.1"/><rect x="1" y="7.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" stroke-width="1.1"/><rect x="9" y="9" width="2" height="2" fill="currentColor"/><rect x="7.5" y="7.5" width="2" height="2" fill="currentColor"/><rect x="11" y="7.5" width="1.5" height="1.5" fill="currentColor"/><rect x="7.5" y="11" width="2" height="1.5" fill="currentColor"/><rect x="11" y="10.5" width="1.5" height="2" fill="currentColor"/></svg>' +
      '</button>' +
      '</div>';
    }).join('') +
    '<button class="btn btn-sm contacts-new-group-btn" id="btn-new-group-side">+ Nouveau groupe</button>';

    var tableBody = filtered.length
      ? filtered.map(function(c) {
          var grp = c.segment_id ? self.groups.find(function(g){ return g.id === c.segment_id; }) : null;
          var sid = c.sender_id_id ? sids.find(function(s){ return s.id === c.sender_id_id; }) : null;
          return '<tr>' +
            '<td><div style="font-weight:500">' + window.Helpers.escapeHtml((c.prenom||'') + ' ' + (c.nom||'')) + '</div>' +
              (grp ? '<div style="font-size:11px;color:var(--color-text-muted)">' + window.Helpers.escapeHtml(grp.nom) + '</div>' : '') +
            '</td>' +
            '<td>' + window.Helpers.escapeHtml(c.telephone||'-') + '</td>' +
            '<td style="color:var(--color-text-secondary)">' + window.Helpers.escapeHtml(c.operateur||'-') + '</td>' +
            '<td>' + (grp ? '<span class="tag tag-neutral" style="font-size:10px">' + window.Helpers.escapeHtml(grp.nom) + '</span>' : '<span style="color:var(--color-text-muted)">-</span>') + '</td>' +
            '<td>' + (sid ? '<span class="tag tag-neutral" style="font-size:10px">' + sid.name + '</span>' : '<span style="color:var(--color-text-muted);font-size:12px">-</span>') + '</td>' +
            '<td>' +
              '<button class="btn btn-sm contact-edit-btn" data-id="' + c.id + '" title="Modifier"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M7.5 2l2.5 2.5L3 11H.5V8.5L7.5 2z" stroke="currentColor" stroke-width="1.1" stroke-linejoin="round"/></svg></button>' +
              '<button class="btn btn-sm contact-del-btn" data-id="' + c.id + '" title="Supprimer" style="margin-left:4px"><svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M4 3V2h4v1M5 5v4M7 5v4M2.5 3l.5 7h6l.5-7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg></button>' +
            '</td>' +
          '</tr>';
        }).join('')
      : '<tr><td colspan="5" style="text-align:center;padding:32px;color:var(--color-text-muted)">' +
          (self.contacts.length === 0
            ? 'Aucun contact. Ajoutez un contact ou importez un CSV.'
            : 'Aucun contact dans ce groupe.') +
        '</td></tr>';

    window.Helpers.renderPage(
      '<div class="page-wrapper">' +
        '<div class="row camp-page-header">' +
          '<div><div class="breadcrumb">Contacts</div><div class="page-title">Mes contacts</div>' +
          '<div class="page-subtitle">' + self.contacts.length + ' contacts · ' + self.groups.length + ' groupes</div></div>' +
          '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
            '<a class="btn btn-sm" id="btn-dl-template" href="#" onclick="window.PageContacts.downloadTemplate();return false">Modèle CSV</a>' +
            '<label class="btn btn-sm" for="csv-input" style="cursor:pointer">' +
              '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 9V2M4 5l2.5-3L9 5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M1.5 10.5h10" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' +
              'Importer contacts' +
            '</label>' +
            '<input type="file" id="csv-input" accept=".csv,.txt,.xlsx,.xls,.vcf,.json,.pdf,.doc,.docx" style="display:none">' +
            '<button class="btn btn-primary" id="btn-add-contact">' +
              '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>Ajouter un contact' +
            '</button>' +
            '<button class="btn" id="btn-global-qr" style="display:flex;align-items:center;gap:6px"><svg width="14" height="14" viewBox="0 0 13 13" fill="none"><rect x="1" y="1" width="4.5" height="4.5" rx="0.8" stroke="currentColor" stroke-width="1.1"/><rect x="7.5" y="1" width="4.5" height="4.5" rx="0.8" stroke="currentColor" stroke-width="1.1"/><rect x="1" y="7.5" width="4.5" height="4.5" rx="0.8" stroke="currentColor" stroke-width="1.1"/><rect x="9" y="9" width="2" height="2" fill="currentColor"/><rect x="7.5" y="7.5" width="2" height="2" fill="currentColor"/></svg>Mon QR Code</button>' +
          '</div>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:220px 1fr;gap:16px;align-items:start">' +
          '<div class="contacts-sidebar">' +
            '<div class="contacts-section-title">Groupes</div>' +
            '<div id="group-list">' + groupList + '</div>' +
          '</div>' +
          '<div>' +
            '<div style="margin-bottom:12px">' +
              '<div class="camp-search-wrap" style="max-width:100%"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' +
              '<input id="contact-search" type="text" placeholder="Rechercher un contact..." class="camp-search-input" value="' + window.Helpers.escapeHtml(self.search) + '"></div>' +
            '</div>' +
            '<div class="contacts-table-wrap"><table><thead><tr><th>Nom</th><th>Téléphone</th><th>Opérateur</th><th>Groupe</th><th>Sender ID</th><th></th></tr></thead><tbody>' + tableBody + '</tbody></table></div>' +
            '<div style="margin-top:8px;font-size:12px;color:var(--color-text-muted)">' + filtered.length + ' sur ' + self.contacts.length + ' contacts</div>' +
          '</div>' +
        '</div>' +
      '</div>'
    );
    this._bindEvents();
  },

  _bindEvents: function() {
    var self = this;

    document.querySelectorAll('.contacts-del-group-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var gid = btn.getAttribute('data-del');
        var grp = self.groups.find(function(g){ return g.id === gid; });
        if (!grp) return;
        window.Helpers.openModal(
          '<div class="modal-box">' +
          '<div class="modal-title">Supprimer le groupe</div>' +
          '<div class="modal-desc">Supprimer <strong>' + window.Helpers.escapeHtml(grp.nom) + '</strong> ? Les contacts ne seront pas supprimés.</div>' +
          '<div class="modal-actions">' +
          '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
          '<button class="btn" style="background:#D93636;color:#fff;border-color:#D93636" id="confirm-del-grp">Supprimer</button>' +
          '</div></div>'
        );
        document.getElementById('confirm-del-grp').addEventListener('click', function() {
          window.DB.from('contacts').update({ segment_id: null }).eq('segment_id', gid).then(function() {
            window.DB.from('segments').delete().eq('id', gid).then(function(res) {
              if (res.error) { window.Toast.error(res.error.message); return; }
              window.Helpers.closeModal();
              window.Toast.success('Groupe supprimé');
              if (self.activeGroup === gid) self.activeGroup = null;
              self._load();
            });
          });
        });
      });
    });
    document.querySelectorAll('.contacts-qr-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var gid = btn.getAttribute('data-qr');
        var grp = self.groups.find(function(g){ return g.id === gid; });
        if (grp) window.PageContacts._showQR(grp);
      });
    });
    document.querySelectorAll('.contacts-group[data-group]').forEach(function(el) {
      el.addEventListener('click', function() {
        self.activeGroup = el.getAttribute('data-group') || null;
        self._renderPage();
      });
    });

    var btnGlobalQR = document.getElementById('btn-global-qr');
    if (btnGlobalQR) {
      btnGlobalQR.addEventListener('click', function() {
        var orgId = window.HookAuth.user && window.HookAuth.user.id;
        var fullUrl = 'https://hook-by-lopango.vercel.app/join?o=' + orgId;
        window.ShortLinks.shorten(fullUrl, orgId, function(joinUrl) {
        var existing = document.getElementById('qr-sheet-overlay');
        if (existing) existing.remove();
        var overlay = document.createElement('div');
        overlay.id = 'qr-sheet-overlay';
        overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:center;justify-content:center';
        overlay.innerHTML = '<div style="background:#fff;border-radius:20px;padding:36px 32px;width:100%;max-width:420px;text-align:center;box-shadow:0 8px 48px rgba(0,0,0,0.18);position:relative">' +
          '<button id="qr-sheet-close" style="position:absolute;top:14px;right:14px;background:none;border:none;cursor:pointer;color:#AEADA9;font-size:20px;line-height:1">&#x2715;</button>' +
          '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);margin-bottom:8px">QR Code Global</div>' +
          '<div style="font-size:20px;font-weight:700;color:#1A1A1A;margin-bottom:4px">Rejoindre ma liste</div>' +
          '<div style="font-size:13px;color:#5F5E5A;margin-bottom:24px">Scannez pour vous inscrire comme contact</div>' +
          '<div id="qr-canvas-wrap" style="display:flex;justify-content:center;margin-bottom:20px"></div>' +
          '<div style="font-size:11px;color:#AEADA9;word-break:break-all;background:#F5F4EF;padding:8px 12px;border-radius:8px;margin-bottom:20px">' + joinUrl + '</div>' +
          '<div style="display:flex;gap:10px">' +
            '<button id="btn-qr-download" class="btn btn-primary" style="flex:1;justify-content:center">Télécharger</button>' +
            '<button id="btn-qr-copy" class="btn" style="flex:1;justify-content:center">Copier le lien</button>' +
          '</div>' +
        '</div>';
        document.body.appendChild(overlay);
        overlay.addEventListener('click', function(e){ if(e.target===overlay) overlay.remove(); });
        document.getElementById('qr-sheet-close').addEventListener('click', function(){ overlay.remove(); });
        setTimeout(function(){
          var wrap = document.getElementById('qr-canvas-wrap');
          if (!wrap || !window.QRCode) return;
          new window.QRCode(wrap, { text: joinUrl, width: 200, height: 200, colorDark: '#0B3828', colorLight: '#ffffff', correctLevel: window.QRCode.CorrectLevel.H });
          setTimeout(function(){
            var dl = document.getElementById('btn-qr-download');
            if (dl) dl.addEventListener('click', function(){
              var canvas = wrap.querySelector('canvas'); var img = wrap.querySelector('img');
              var a = document.createElement('a'); a.download = 'qr-global.png';
              if (canvas) a.href = canvas.toDataURL('image/png'); else if (img) a.href = img.src; else return; a.click();
            });
            var cp = document.getElementById('btn-qr-copy');
            if (cp) cp.addEventListener('click', function(){
              navigator.clipboard && navigator.clipboard.writeText(joinUrl).then(function(){ cp.textContent='Copié !'; setTimeout(function(){ cp.textContent='Copier le lien'; }, 2000); });
            });
          }, 200);
        }, 100);
        }); // end global shorten
      });
    }
    var btnAdd = document.getElementById('btn-add-contact');
    if (btnAdd) btnAdd.addEventListener('click', function(){ self._openAddContact(); });

    var btnGroup = document.getElementById('btn-new-group-side');
    if (btnGroup) btnGroup.addEventListener('click', function(){ self._openNewGroup(); });

    var csv = document.getElementById('csv-input');
    if (csv) csv.addEventListener('change', function(){ self._importCSV(csv.files[0]); csv.value=''; });

    var search = document.getElementById('contact-search');
    if (search) search.addEventListener('input', function(){
      self.search = search.value;
      self._renderPage();
    });

    document.querySelectorAll('.contact-edit-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        var c = self.contacts.find(function(x){ return x.id === id; });
        if (c) self._openEditContact(c);
      });
    });

    document.querySelectorAll('.contact-del-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var id = btn.getAttribute('data-id');
        window.DB.from('contacts').delete().eq('id', id).then(function() {
          self.contacts = self.contacts.filter(function(c){ return c.id !== id; });
          self._renderPage();
          window.Toast.success('Contact supprime');
        });
      });
    });
  },

  _contactFormHtml: function(c) {
    var v = function(f){ return c ? window.Helpers.escapeHtml(c[f]||'') : ''; };
    var groupOptions = '<option value="">Aucun groupe</option>' +
      this.groups.map(function(g){ return '<option value="' + g.id + '"' + (c && c.segment_id===g.id?' selected':'') + '>' + window.Helpers.escapeHtml(g.nom) + '</option>'; }).join('');
    var sidOptions = '<option value="">Aucun Sender ID</option>' +
      this.senderIds.map(function(s){ return '<option value="' + s.id + '"' + (c && c.sender_id_id===s.id?' selected':'') + '>' + window.Helpers.escapeHtml(s.name) + '</option>'; }).join('');

    return '<div class="sid-form-row">' +
        '<div class="campnew-field"><label>Prénom</label><input type="text" id="ct-prenom" placeholder="Exauce" value="' + v('prenom') + '"></div>' +
        '<div class="campnew-field"><label>Nom</label><input type="text" id="ct-nom" placeholder="IBAKA" value="' + v('nom') + '"></div>' +
      '</div>' +
      '<div class="campnew-field"><label>Numéro de téléphone <span class="field-req">*</span></label><input type="tel" id="ct-tel" placeholder="+242 06 000 00 00" value="' + v('telephone') + '"></div>' +
      '<div class="campnew-field"><label>Opérateur</label><div id="ct-op-display" style="padding:9px 12px;border:var(--border-thin);border-radius:var(--radius-md);font-size:13px;color:var(--color-text-muted);background:var(--color-bg)">Détecté automatiquement</div><input type="hidden" id="ct-op" value="'+(c&&c.operateur||'')+'"></div>' +
      '<div class="campnew-field"><label>Groupe (optionnel)</label><select id="ct-group">' + groupOptions + '</select></div>' +
      '<div class="campnew-field"><label>Sender ID (optionnel)</label><select id="ct-sid">' + sidOptions + '</select></div>';
  },

  _openAddContact: function() {
    var self = this;
    window.Helpers.openModal(
      '<div class="modal-box">' +
        '<div class="modal-header-row"><div class="modal-title">Ajouter un contact</div>' +
        '<button class="modal-close-btn" onclick="window.Helpers.closeModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>' +
        self._contactFormHtml(null) +
        '<div class="modal-actions"><button class="btn" onclick="window.Helpers.closeModal()">Annuler</button><button class="btn btn-primary" id="btn-save-ct">Ajouter</button></div>' +
      '</div>'
    );
        var telInput = document.getElementById('ct-tel');
    var opDisplay = document.getElementById('ct-op-display');
    var opInput = document.getElementById('ct-op');
    function detectOp(num){
      var n = num.replace(/\s/g,'');
      if(/^(\+24206|06)/.test(n)) return {name:'MTN Congo',color:'#FFCC00',text:'MTN Congo'};
      if(/^(\+24205|05|\+24204|04)/.test(n)) return {name:'Airtel Congo',color:'#FF0000',text:'Airtel Congo'};
      return null;
    }
    if(telInput){
      telInput.addEventListener('input',function(){var raw=telInput.value.replace(/\s/g,'');if(raw.length>4&&!/^\+/.test(raw)&&/^0[456]/.test(raw)){telInput.value='+242'+raw;}
        var op=detectOp(telInput.value);
        if(opDisplay){
          opDisplay.textContent=op?op.text:'Non reconnu';
          opDisplay.style.color=op?'var(--color-text-primary)':'var(--color-text-muted)';
          opDisplay.style.fontWeight=op?'500':'400';
        }
        if(opInput) opInput.value=op?op.name:'';
      });
    }
    document.getElementById('btn-save-ct').addEventListener('click', function() {
      var tel = document.getElementById('ct-tel').value.trim();
      if (!tel) { window.Toast.error('Téléphone requis'); return; }
      var n=tel.replace(/\s/g,'');if(!/^\+/.test(n)){if(/^242/.test(n)){n='+'+n;}else if(/^0[456]/.test(n)){n='+242'+n;}else if(/^[456]/.test(n)){n='+2420'+n;}else{n='+242'+n;}}tel=n;
      var orgId = window.HookAuth.user && window.HookAuth.user.id;
      window.DB.from('contacts').insert({
        prenom:       document.getElementById('ct-prenom').value.trim() || null,
        nom:          document.getElementById('ct-nom').value.trim() || null,
        telephone:    tel,
        operateur:    document.getElementById('ct-op').value || null,
        segment_id:   document.getElementById('ct-group').value || null,
        sender_id_id: document.getElementById('ct-sid').value || null,
        organization_id: orgId
      }).then(function(res) {
        if (res.error) { window.Toast.error(res.error.message); return; }
        window.Helpers.closeModal();
        window.Toast.success('Contact ajoute');
        self._load();
      });
    });
  },

  _openEditContact: function(c) {
    var self = this;
    window.Helpers.openModal(
      '<div class="modal-box">' +
        '<div class="modal-header-row"><div class="modal-title">Modifier le contact</div>' +
        '<button class="modal-close-btn" onclick="window.Helpers.closeModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>' +
        self._contactFormHtml(c) +
        '<div class="modal-actions"><button class="btn" onclick="window.Helpers.closeModal()">Annuler</button><button class="btn btn-primary" id="btn-save-ct">Enregistrer</button></div>' +
      '</div>'
    );
        var telInput = document.getElementById('ct-tel');
    var opDisplay = document.getElementById('ct-op-display');
    var opInput = document.getElementById('ct-op');
    function detectOp(num){
      var n = num.replace(/\s/g,'');
      if(/^(\+24206|06)/.test(n)) return {name:'MTN Congo',color:'#FFCC00',text:'MTN Congo'};
      if(/^(\+24205|05|\+24204|04)/.test(n)) return {name:'Airtel Congo',color:'#FF0000',text:'Airtel Congo'};
      return null;
    }
    if(telInput){
      telInput.addEventListener('input',function(){
        var op=detectOp(telInput.value);
        if(opDisplay){
          opDisplay.textContent=op?op.text:'Non reconnu';
          opDisplay.style.color=op?'var(--color-text-primary)':'var(--color-text-muted)';
          opDisplay.style.fontWeight=op?'500':'400';
        }
        if(opInput) opInput.value=op?op.name:'';
      });
    }
    document.getElementById('btn-save-ct').addEventListener('click', function() {
      var tel = document.getElementById('ct-tel').value.trim();
      if (!tel) { window.Toast.error('Téléphone requis'); return; }
      var n=tel.replace(/\s/g,'');if(!/^\+/.test(n)){if(/^242/.test(n)){n='+'+n;}else if(/^0[456]/.test(n)){n='+242'+n;}else if(/^[456]/.test(n)){n='+2420'+n;}else{n='+242'+n;}}tel=n;
      window.DB.from('contacts').update({
        prenom:       document.getElementById('ct-prenom').value.trim() || null,
        nom:          document.getElementById('ct-nom').value.trim() || null,
        telephone:    tel,
        operateur:    document.getElementById('ct-op').value || null,
        segment_id:   document.getElementById('ct-group').value || null,
        sender_id_id: document.getElementById('ct-sid').value || null
      }).eq('id', c.id).then(function(res) {
        if (res.error) { window.Toast.error(res.error.message); return; }
        window.Helpers.closeModal();
        window.Toast.success('Contact modifie');
        self._load();
      });
    });
  },

  _openNewGroup: function() {
    var self = this;
    var sidOptions = '<option value="">Choisir un Sender ID...</option>' +
      self.senderIds.map(function(s){ return '<option value="' + s.id + '">' + window.Helpers.escapeHtml(s.name) + '</option>'; }).join('');
    window.Helpers.openModal(
      '<div class="modal-box">' +
        '<div class="modal-header-row"><div class="modal-title">Nouveau groupe</div>' +
        '<button class="modal-close-btn" onclick="window.Helpers.closeModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>' +
        '<div class="campnew-field"><label>Nom du groupe <span class="field-req">*</span></label><input type="text" id="grp-nom" placeholder="Ex: Clients VIP Brazzaville"></div>' +
        '<div class="campnew-field"><label>Sender ID <span class="field-req">*</span></label><select id="grp-sid">' + sidOptions + '</select></div>' +
        '<div class="modal-actions"><button class="btn" onclick="window.Helpers.closeModal()">Annuler</button><button class="btn btn-primary" id="btn-save-grp">Créer le groupe</button></div>' +
      '</div>'
    );
    document.getElementById('btn-save-grp').addEventListener('click', function() {
      var nom = document.getElementById('grp-nom').value.trim();
      if (!nom) { window.Toast.error('Nom du groupe requis'); return; }
      var orgId = window.HookAuth.user && window.HookAuth.user.id;
      var sidVal = document.getElementById('grp-sid').value;
      if (!sidVal) { window.Toast.error('Veuillez choisir un Sender ID'); return; }
      window.DB.from('segments').insert({
        nom: nom,
        sender_id_id: sidVal,
        organization_id: orgId,
        is_group: true
      }).then(function(res) {
        if (res.error) { window.Toast.error(res.error.message); return; }
        window.Helpers.closeModal();
        window.Toast.success('Groupe cree');
        self._load();
      });
    });
  },

  _openImportModal: function(file) {
    var self = this;
    var sidOptions = '<option value="">Choisir un Sender ID...</option>' +
      self.senderIds.map(function(s){ return '<option value="' + s.id + '">' + window.Helpers.escapeHtml(s.name) + '</option>'; }).join('');
    var groupOptions = '<option value="">Aucun groupe (optionnel)</option>' +
      self.groups.map(function(g){ return '<option value="' + g.id + '">' + window.Helpers.escapeHtml(g.nom) + '</option>'; }).join('');

    window.Helpers.openModal(
      '<div class="modal-box">' +
        '<div class="modal-header-row"><div class="modal-title">Importer des contacts</div>' +
        '<button class="modal-close-btn" onclick="window.Helpers.closeModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>' +
        '<div class="sid-form-info">Fichier selectionne : <strong>' + file.name + '</strong></div>' +
        '<div class="campnew-field"><label>Assigner a un groupe (optionnel)</label><select id="import-group">' + groupOptions + '</select></div>' +
        '<div class="campnew-field"><label>Sender ID <span class=\"field-req\">*</span></label><select id="import-sid">' + sidOptions + '</select></div>' +
        '<div class="modal-actions"><button class="btn" onclick="window.Helpers.closeModal()">Annuler</button><button class="btn btn-primary" id="btn-confirm-import">Importer</button></div>' +
      '</div>'
    );
    document.getElementById('btn-confirm-import').addEventListener('click', function() {
      var groupId = document.getElementById('import-group').value || null;
      var sidId   = document.getElementById('import-sid').value   || null;
      window.Helpers.closeModal();
      self._processCSV(file, groupId, sidId);
    });
  },

  _importCSV: function(file) {
    if (!file) return;
    this._openImportModal(file);
  },

  _detectOperateur: function(num) {
    var n = (num || '').replace(/\s/g, '');
    if (/^(\+24206|06)/.test(n)) return 'MTN Congo';
    if (/^(\+24205|05|\+24204|04)/.test(n)) return 'Airtel Congo';
    return '';
  },

  _extractContacts: function(text) {
    var self = this;
    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    var contacts = [];
    var phoneRegex = /(?:\+?242\s*)?0[456]\s*(?:\d\s*){7,8}/g;
    var lines = text.split(/\r?\n/).map(function(l){ return l.trim(); }).filter(Boolean);
    var structured = false;

    if (lines.length >= 2) {
      var sep = lines[0].indexOf(';') !== -1 ? ';' : ',';
      var headers = lines[0].split(sep).map(function(h){ return h.replace(/["']/g,'').trim().toLowerCase(); });
      var telIdx = -1, prenomIdx = -1, nomIdx = -1;
      ['telephone','tel','phone','numero','mobile'].forEach(function(k){ if(telIdx===-1 && headers.indexOf(k)!==-1) telIdx = headers.indexOf(k); });
      ['prenom','firstname','first_name'].forEach(function(k){ if(prenomIdx===-1 && headers.indexOf(k)!==-1) prenomIdx = headers.indexOf(k); });
      ['nom','lastname','last_name','name'].forEach(function(k){ if(nomIdx===-1 && headers.indexOf(k)!==-1) nomIdx = headers.indexOf(k); });

      if (telIdx !== -1) {
        structured = true;
        for (var i = 1; i < lines.length; i++) {
          var cols = lines[i].split(sep).map(function(v){ return v.replace(/["']/g,'').trim(); });
          var tel = cols[telIdx] || '';
          if (!tel) continue;
          contacts.push({
            telephone: tel,
            prenom: prenomIdx !== -1 ? (cols[prenomIdx] || '') : '',
            nom: nomIdx !== -1 ? (cols[nomIdx] || '') : '',
            operateur: self._detectOperateur(tel),
            organization_id: orgId
          });
        }
      }
    }

    if (!structured) {
      // Search line by line - names must be on the SAME line as the phone number
      var stopWords = ['Tel','Nom','Prenom','Email','Contact','Congo','Airtel','Mobile','MTN','FCFA','SMS','Hook'];
      lines.forEach(function(line) {
        var m;
        var linePhoneRegex = /(?:\+?242\s*)?0[456]\s*(?:\d\s*){7,8}/g;
        while ((m = linePhoneRegex.exec(line)) !== null) {
          var phone = m[0].replace(/\s/g,'');
          // Remove the phone number from the line, look for names in what remains
          var rest = line.replace(m[0], ' ').replace(/[^a-zA-Zà-ÿ\s]/g, ' ');
          var names = (rest.match(/[A-ZÀ-ÖÀ-Ö][a-zà-ÿ]{2,20}/g) || []).filter(function(w){
            return stopWords.indexOf(w) === -1;
          });
          var pn=phone.replace(/\s/g,'');if(!/^\+/.test(pn)){if(/^242/.test(pn)){pn='+'+pn;}else if(/^0[456]/.test(pn)){pn='+242'+pn;}else if(/^[456]/.test(pn)){pn='+2420'+pn;}else{pn='+242'+pn;}}phone=pn;contacts.push({ telephone: phone, prenom: names[0]||'', nom: names[1]||'', operateur: self._detectOperateur(phone), organization_id: orgId });
        }
      });
    }

    var seen = {};
    return contacts.filter(function(ct) {
      if (!ct.telephone || seen[ct.telephone]) return false;
      seen[ct.telephone] = true;
      return true;
    });
  },

  _showQR: function(grp) {
    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    var sidParam = '';
    if (grp.sender_id_id && window.PageContacts.senderIds) {
      var _sid = window.PageContacts.senderIds.find(function(s){ return s.id === grp.sender_id_id; });
      if (_sid) sidParam = '&s=' + encodeURIComponent(_sid.name);
    }
    var fullUrl = 'https://hook-by-lopango.vercel.app/join?g=' + grp.id + '&o=' + orgId + '&n=' + encodeURIComponent(grp.nom) + sidParam;
    var self = this;
    window.ShortLinks.shorten(fullUrl, orgId, function(joinUrl) {
    var existing = document.getElementById('qr-sheet-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'qr-sheet-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:1000;display:flex;align-items:center;justify-content:center';

    overlay.innerHTML = '<div style="background:#fff;border-radius:20px;padding:36px 32px;width:100%;max-width:420px;text-align:center;box-shadow:0 8px 48px rgba(0,0,0,0.18);position:relative">' +
      '<button id="qr-sheet-close" style="position:absolute;top:14px;right:14px;background:none;border:none;cursor:pointer;color:#AEADA9;font-size:20px;line-height:1">&#x2715;</button>' +
      '<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:var(--color-text-muted);margin-bottom:8px">QR Code</div>' +
      '<div style="font-size:20px;font-weight:700;color:#1A1A1A;margin-bottom:4px">' + window.Helpers.escapeHtml(grp.nom) + '</div>' +
      '<div style="font-size:13px;color:#5F5E5A;margin-bottom:24px">Scannez pour rejoindre ce groupe</div>' +
      '<div id="qr-canvas-wrap" style="display:flex;justify-content:center;margin-bottom:20px"></div>' +
      '<div style="font-size:11px;color:#AEADA9;word-break:break-all;background:#F5F4EF;padding:8px 12px;border-radius:8px;margin-bottom:20px">' + joinUrl + '</div>' +
      '<div style="display:flex;gap:10px">' +
        '<button id="btn-qr-download" class="btn btn-primary" style="flex:1;justify-content:center">Télécharger</button>' +
        '<button id="btn-qr-copy" class="btn" style="flex:1;justify-content:center">Copier le lien</button>' +
      '</div>' +
    '</div>';

    document.body.appendChild(overlay);

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) overlay.remove();
    });
    document.getElementById('qr-sheet-close').addEventListener('click', function() { overlay.remove(); });
    setTimeout(function() {
      var wrap = document.getElementById('qr-canvas-wrap');
      if (!wrap) return;
      if (!window.QRCode) { wrap.innerHTML = '<div style="font-size:12px;color:#D93636">Erreur: librairie QR Code non chargée.</div>'; return; }
      new window.QRCode(wrap, {
        text: joinUrl,
        width: 200,
        height: 200,
        colorDark: '#0B3828',
        colorLight: '#ffffff',
        correctLevel: window.QRCode.CorrectLevel.H
      });
      setTimeout(function() {
        var dl = document.getElementById('btn-qr-download');
        if (dl) {
          dl.addEventListener('click', function() {
            var canvas = wrap.querySelector('canvas');
            var img = wrap.querySelector('img');
            var a = document.createElement('a');
            a.download = 'qr-' + grp.nom + '.png';
            if (canvas) { a.href = canvas.toDataURL('image/png'); }
            else if (img) { a.href = img.src; }
            else return;
            a.click();
          });
        }
        var cp = document.getElementById('btn-qr-copy');
        if (cp) {
          cp.addEventListener('click', function() {
            navigator.clipboard && navigator.clipboard.writeText(joinUrl).then(function() {
              cp.textContent = 'Copié !';
              setTimeout(function(){ cp.textContent = 'Copier le lien'; }, 2000);
            });
          });
        }
      }, 200);
    }, 100);
    }); // end group shorten
  },

  _processCSV: function(file, groupId, sidId) {
    var self = this;
    var reader = new FileReader();
    reader.onload = function(e) {
      var text = e.target.result;
      if (!text || !text.trim()) { window.Toast.error('Fichier vide ou illisible'); return; }
      var contacts = self._extractContacts(text);
      if (!contacts.length) { window.Toast.error('Aucun numéro trouvé dans le fichier'); return; }
      contacts = contacts.map(function(ct){ ct.segment_id = groupId||null; ct.sender_id_id = sidId||null; return ct; });
      window.Toast.info('Importation de ' + contacts.length + ' contact' + (contacts.length>1?'s':'') + '...');
      var BATCH = 50, done = 0, errors = 0;
      for (var j = 0; j < contacts.length; j += BATCH) {
        (function(batch) {
          window.DB.from('contacts').insert(batch).then(function(res) {
            done += batch.length;
            if (res.error) errors++;
            if (done >= contacts.length) {
              window.Toast.success(contacts.length + ' contact' + (contacts.length>1?'s':'') + ' importé' + (contacts.length>1?'s':'') + (errors?' ('+errors+' erreurs)':''));
              self._load();
            }
          });
        })(contacts.slice(j, j+BATCH));
      }
    };
    reader.readAsText(file, 'UTF-8');
  },

  downloadTemplate: function() {
    var csv = 'prenom,nom,téléphone,operateur\nJean,Dupont,+242060000001,MTN Congo\nMarie,Loubaki,+242050000002,Airtel Congo\n';
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    var url  = URL.createObjectURL(blob);
    var a    = document.createElement('a');
    a.href     = url;
    a.download = 'modèle-contacts-hook.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
};
