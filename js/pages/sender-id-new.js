window.PageSenderIdNew = {
  editId: null,

  render: function(editId) {
    this.editId = editId || null;
    this._selfieBlob = null;
    this._stream = null;
    var self = this;

    if (editId) {
      window.DB.from('sender_ids').select('*').eq('id', editId).single()
        .then(function(res) { self._renderPage(res.data || {}); });
    } else {
      this._renderPage({});
    }
  },

  _renderPage: function(s) {
    var self = this;
    var v = function(f) { return s[f] ? window.Helpers.escapeHtml(s[f]) : ''; };
    var isEdit = !!this.editId;

    var sectorOpts = ['Banque','Assurance','E-commerce','Commerce','Santé','Éducation','ONG','Autre'].map(function(o) {
      return '<option value="' + o + '"' + (s.secteur === o ? ' selected' : '') + '>' + o + '</option>';
    }).join('');

    window.Helpers.renderPage(
      '<div class="page-wrapper sid-new-wrapper">' +

        '<div class="row sid-new-header">' +
          '<div>' +
            '<button class="sid-back-btn" id="sid-new-back">' +
              '<svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M10 3L5 7.5l5 4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
              'Mes Sender IDs' +
            '</button>' +
            '<div class="page-title" style="margin-top:8px">' + (isEdit ? 'Modifier le Sender ID' : 'Demander un Sender ID') + '</div>' +
            '<div class="page-subtitle">La validation prend entre 24 et 48h. Vous recevrez un email de confirmation.</div>' +
          '</div>' +
        '</div>' +

        '<div class="sid-new-grid">' +

          '<div class="sid-new-left">' +

            '<div class="sid-new-section">' +
              '<div class="sid-new-section-title">Identifiant</div>' +
              '<div class="campnew-field">' +
                '<label>Nom du Sender ID <span class="field-req">*</span></label>' +
                '<input type="text" id="sf-nom"  style="text-transform:uppercase;font-size:18px;font-weight:700;letter-spacing:1px" placeholder="EX: MONENTREPRISE" value="' + (s.name ? window.Helpers.escapeHtml(s.name) : '') + '">' +
                '<div class="field-hint">11 caractères max, sans espaces ni caractères spéciaux. Ce nom sera affiché à la place du numéro dans les SMS reçus par vos clients.</div>' +
              '</div>' +
              '<div class="sid-form-row">' +
                '<div class="campnew-field">' +
                  '<label>Secteur d\'activité <span class="field-req">*</span></label>' +
                  '<select id="sf-secteur"><option value="">Choisir...</option>' + sectorOpts + '</select>' +
                '</div>' +
                '<div class="campnew-field">' +
                  '<label>Usage principal <span class="field-req">*</span></label>' +
                  '<input type="text" id="sf-usage" placeholder="Ex: Rappels d\'échéance et alertes clients" value="' + v('usage_principal') + '">' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="sid-new-section">' +
              '<div class="sid-new-section-title">Représentant légal</div>' +
              '<div class="sid-form-row">' +
                '<div class="campnew-field">' +
                  '<label>Nom complet <span class="field-req">*</span></label>' +
                  '<input type="text" id="sf-rep" placeholder="Nom et prénom" value="' + v('representant_legal') + '">' +
                '</div>' +
                '<div class="campnew-field">' +
                  '<label>Téléphone <span class="field-req">*</span></label>' +
                  '<input type="tel" id="sf-tel" placeholder="+242 06 000 00 00" value="' + v('telephone') + '">' +
                '</div>' +
              '</div>' +
              '<div class="campnew-field">' +
                '<label>Email de contact <span class="field-req">*</span></label>' +
                '<input type="email" id="sf-email" placeholder="contact@entreprise.cg" value="' + v('email_contact') + '">' +
              '</div>' +
            '</div>' +

            '<div class="sid-new-section">' +
              '<div class="sid-new-section-title">Informations légales</div>' +
              '<div class="sid-form-row">' +
                '<div class="campnew-field">' +
                  '<label>RCCM <span class="field-req">*</span></label>' +
                  '<input type="text" id="sf-rccm" placeholder="CG-BZV-01-2025-B12-00000" value="' + v('rccm') + '">' +
                '</div>' +
                '<div class="campnew-field">' +
                  '<label>NIU <span style="font-size:11px;color:var(--color-text-muted)">(optionnel)</span></label>' +
                  '<input type="text" id="sf-niu" placeholder="P20250000000R" value="' + v('niu') + '">' +
                '</div>' +
              '</div>' +
            '</div>' +

            '<div class="sid-new-section">' +
              '<div class="sid-new-section-title">Photo du représentant <span class="field-req">*</span></div>' +
              '<div class="selfie-section">' +
                '<div class="selfie-camera" id="selfie-camera">' +
                  '<div class="selfie-placeholder" id="selfie-placeholder">' +
                    '<svg width="44" height="44" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="18" r="7" stroke="var(--color-text-muted)" stroke-width="1.5"/><path d="M8 38c0-7.732 6.268-14 14-14s14 6.268 14 14" stroke="var(--color-text-muted)" stroke-width="1.5" stroke-linecap="round"/></svg>' +
                    '<p style="font-size:13px;color:var(--color-text-secondary);margin:8px 0 14px;text-align:center">La photo doit être prise directement avec votre caméra, pas importée depuis la galerie.</p>' +
                    '<button class="btn btn-primary" id="btn-open-cam">Ouvrir la caméra</button>' +
                  '</div>' +
                  '<video id="selfie-video" autoplay playsinline style="width:100%;border-radius:var(--radius-md);display:none"></video>' +
                  '<div id="selfie-controls" style="display:none;text-align:center;margin-top:12px;display:none">' +
                    '<button class="btn btn-primary" id="btn-take-photo">Prendre la photo</button>' +
                    '<button class="btn btn-sm" id="btn-stop-cam" style="margin-left:8px">Annuler</button>' +
                  '</div>' +
                  '<canvas id="selfie-canvas" style="display:none"></canvas>' +
                '</div>' +
                '<div class="selfie-preview" id="selfie-preview" style="display:none">' +
                  '<img id="selfie-img" src="" alt="Photo" style="width:100%;max-width:280px;border-radius:var(--radius-md);border:var(--border-thin);display:block;margin:0 auto">' +
                  '<button class="btn btn-sm" id="btn-retake" style="display:block;margin:10px auto 0">Reprendre la photo</button>' +
                '</div>' +
              '</div>' +
            '</div>' +

          '</div>' +

          '<div class="sid-new-right">' +

            '<div class="sid-new-docs-header">Documents à fournir</div>' +
            '<p style="font-size:13px;color:var(--color-text-secondary);margin:0 0 20px;line-height:1.6">Tous les documents doivent être lisibles. Les formats acceptés sont PDF, JPG et PNG. Taille maximale : 10 Mo par fichier.</p>' +

            this._docCard('doc-rccm',   'Attestation RCCM',       true,  'Document officiel d\'enregistrement de votre société au registre du commerce.') +
            this._docCard('doc-statut', 'Statut de la société',   true,  'Statuts constitutifs ou tout document légal attestant de l\'existence de votre entreprise.') +
            this._docCard('doc-fiscal', 'Attestation fiscale',    true,  'Attestation en cours de validité délivrée par la Direction Générale des Impôts.') +
            this._docCard('doc-cni',    'CNI du représentant',    true,  'Pièce d\'identité nationale en cours de validité du représentant légal signataire.') +
            this._docCard('doc-lettre', 'Lettre d\'engagement',   false, 'Optionnel. Lettre sur papier à en-tête déclarant l\'usage prévu du Sender ID.') +

            '<div class="sid-new-notice">' +
              '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="7" cy="7" r="6" stroke="currentColor" stroke-width="1.2"/><path d="M7 5v4M7 10v.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>' +
              '<span>Vos documents sont transmis de manière sécurisée et ne sont consultés que par l\'équipe Hook pour validation.</span>' +
            '</div>' +

          '</div>' +

        '</div>' +

        '<div class="sid-new-footer">' +
          '<button class="btn" id="sid-new-cancel">Annuler</button>' +
          '<button class="btn btn-primary" id="sid-new-submit">' + (isEdit ? 'Soumettree la modification' : 'Soumettree la demande') + '</button>' +
        '</div>' +

      '</div>'
    );

    this._bindPage();
  },

  _docCard: function(id, label, required, hint) {
    return '<div class="sid-doc-card" id="card-' + id + '">' +
      '<div class="sid-doc-label">' + label + (required ? ' <span class="field-req">*</span>' : ' <span class="sid-doc-optional">optionnel</span>') + '</div>' +
      '<div class="sid-doc-hint">' + hint + '</div>' +
      '<label class="sid-dropzone" id="zone-' + id + '" for="' + id + '">' +
        '<div class="sid-dropzone-inner" id="inner-' + id + '">' +
          '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><path d="M14 18V8M9 13l5-5 5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 22h20" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>' +
          '<div class="sid-dropzone-text">Glisser-déposer ou <span class="sid-dropzone-link">choisir un fichier</span></div>' +
          '<div class="sid-dropzone-formats">PDF, JPG, PNG — max 10 Mo</div>' +
        '</div>' +
      '</label>' +
      '<input type="file" id="' + id + '" accept=".pdf,.jpg,.jpeg,.png,.webp" style="display:none">' +
    '</div>';
  },

  _bindPage: function() {
    var self = this;

    document.getElementById('sid-new-back').addEventListener('click', function() { window.Router.navigate('/sender-id'); });
    document.getElementById('sid-new-cancel').addEventListener('click', function() { window.Router.navigate('/sender-id'); });
    document.getElementById('sid-new-submit').addEventListener('click', function() { self._submit(); });

    document.querySelectorAll('.sid-doc-card input[type=file]').forEach(function(input) {
      var zone = document.getElementById('zone-' + input.id);
      var inner = document.getElementById('inner-' + input.id);

      function setFile(file) {
        if (!file) return;
        var card = document.getElementById('card-' + input.id);
        if (card) card.classList.add('uploaded');
        if (zone) zone.classList.add('zone-uploaded');
        if (inner) inner.innerHTML =
          '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M4 12l6 6L20 6" stroke="#1D9E75" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '<div class="sid-dropzone-text" style="color:#1D9E75;font-weight:600">' + file.name.slice(0,28) + (file.name.length > 28 ? '...' : '') + '</div>' +
          '<div class="sid-dropzone-formats" style="color:#1D9E75">Cliquer pour remplacer</div>';
      }

      input.addEventListener('change', function() {
        if (input.files && input.files[0]) setFile(input.files[0]);
      });

      if (zone) {
        zone.addEventListener('dragover', function(e) {
          e.preventDefault();
          zone.classList.add('zone-drag');
        });
        zone.addEventListener('dragleave', function(e) {
          e.preventDefault();
          zone.classList.remove('zone-drag');
        });
        zone.addEventListener('drop', function(e) {
          e.preventDefault();
          zone.classList.remove('zone-drag');
          var files = e.dataTransfer && e.dataTransfer.files;
          if (files && files[0]) {
            var dt = new DataTransfer();
            dt.items.add(files[0]);
            input.files = dt.files;
            setFile(files[0]);
          }
        });
      }
    });

    var btnOpenCam = document.getElementById('btn-open-cam');
    var video      = document.getElementById('selfie-video');
    var canvas     = document.getElementById('selfie-canvas');
    var placeholder = document.getElementById('selfie-placeholder');
    var controls   = document.getElementById('selfie-controls');
    var preview    = document.getElementById('selfie-preview');
    var selfieImg  = document.getElementById('selfie-img');
    var btnTake    = document.getElementById('btn-take-photo');
    var btnStop    = document.getElementById('btn-stop-cam');
    var btnRetake  = document.getElementById('btn-retake');

    if (btnOpenCam) btnOpenCam.addEventListener('click', function() {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(function(stream) {
          self._stream = stream;
          video.srcObject = stream;
          video.style.display = 'block';
          placeholder.style.display = 'none';
          controls.style.display = 'block';
        })
        .catch(function() { window.Toast.error('Impossible d\'accéder à la caméra'); });
    });

    if (btnTake) btnTake.addEventListener('click', function() {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      canvas.getContext('2d').drawImage(video, 0, 0);
      canvas.toBlob(function(blob) {
        self._selfieBlob = blob;
        selfieImg.src = URL.createObjectURL(blob);
        preview.style.display = 'block';
        document.getElementById('selfie-camera').style.display = 'none';
        if (self._stream) { self._stream.getTracks().forEach(function(t){ t.stop(); }); self._stream = null; }
      }, 'image/jpeg', 0.88);
    });

    if (btnStop) btnStop.addEventListener('click', function() {
      if (self._stream) { self._stream.getTracks().forEach(function(t){ t.stop(); }); self._stream = null; }
      video.style.display = 'none';
      controls.style.display = 'none';
      placeholder.style.display = 'flex';
    });

    if (btnRetake) btnRetake.addEventListener('click', function() {
      self._selfieBlob = null;
      preview.style.display = 'none';
      document.getElementById('selfie-camera').style.display = 'block';
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(function(stream) {
          self._stream = stream;
          video.srcObject = stream;
          video.style.display = 'block';
          placeholder.style.display = 'none';
          controls.style.display = 'block';
        });
    });
  },

  _submit: function() {
    var g = function(id) { return document.getElementById(id); };
    var nom    = g('sf-nom')    && g('sf-nom').value.trim().toUpperCase();
    var secteur= g('sf-secteur')&& g('sf-secteur').value;
    var usage  = g('sf-usage') && g('sf-usage').value.trim();
    var rep    = g('sf-rep')   && g('sf-rep').value.trim();
    var tel    = g('sf-tel')   && g('sf-tel').value.trim();
    var email  = g('sf-email') && g('sf-email').value.trim();
    var rccm   = g('sf-rccm') && g('sf-rccm').value.trim();

    if (!nom)    { window.Toast.error('Nom du Sender ID requis'); return; }
    if (!secteur){ window.Toast.error('Secteur requis'); return; }
    if (!usage)  { window.Toast.error('Usage principal requis'); return; }
    if (!rep)    { window.Toast.error('Représentant légal requis'); return; }
    if (!tel)    { window.Toast.error('Téléphone requis'); return; }
    if (!email)  { window.Toast.error('Email requis'); return; }
    if (!rccm)   { window.Toast.error('RCCM requis'); return; }

    var docRccm   = g('doc-rccm');
    var docStatut = g('doc-statut');
    var docFiscal = g('doc-fiscal');
    var docCni    = g('doc-cni');
    if (!docRccm   || !docRccm.files   || !docRccm.files[0])   { window.Toast.error('Attestation RCCM requise'); return; }
    if (!docStatut || !docStatut.files || !docStatut.files[0]) { window.Toast.error('Statut de la société requis'); return; }
    if (!docFiscal || !docFiscal.files || !docFiscal.files[0]) { window.Toast.error('Attestation fiscale requise'); return; }
    if (!docCni    || !docCni.files    || !docCni.files[0])    { window.Toast.error('CNI du représentant requis'); return; }
    if (!this._selfieBlob) { window.Toast.error('Photo du représentant requise'); return; }

    var btn = g('sid-new-submit');
    if (btn) { btn.textContent = 'Envoi en cours...'; btn.disabled = true; }

    var self = this;
    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    var uid   = window.HookAuth.user    && window.HookAuth.user.id;

    var data = {
      name: nom, secteur: secteur, usage_principal: usage,
      representant_legal: rep, telephone: tel, email_contact: email,
      rccm: rccm, niu: g('sf-niu') ? g('sf-niu').value.trim() : '',
      statut: 'pending', activity_status: 'actif', organization_id: orgId
    };

    var q = this.editId
      ? window.DB.from('sender_ids').update(data).eq('id', this.editId).select().single()
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
      var lettre = g('doc-lettre');
      if (lettre && lettre.files && lettre.files[0]) docs.push({ el: lettre, type: 'lettre' });
      docs.push({ file: new File([self._selfieBlob], 'selfie.jpg', { type: 'image/jpeg' }), type: 'selfie', bucket: 'selfies' });

      var done = 0;
      docs.forEach(function(d) {
        var file   = d.file || d.el.files[0];
        var bucket = d.bucket || 'kyc-documents';
        var path   = uid + '/' + sidId + '/' + d.type + '_' + Date.now();
        window.DB.storage.from(bucket).upload(path, file, { upsert: true }).then(function() {
          if (d.type !== 'selfie') {
            window.DB.from('sender_id_documents').insert({ sender_id_id: sidId, type: d.type, file_url: path }).then(function(){});
          } else {
            window.DB.from('sender_ids').update({ selfie_url: path }).eq('id', sidId).then(function(){});
          }
          done++;
          if (done >= docs.length) {
            window.Router.navigate('/sender-id');
            window.Toast.success('Demande envoyée. Validation sous 24 à 48h.');
          }
        }).catch(function() {
          done++;
          if (done >= docs.length) {
            window.Router.navigate('/sender-id');
            window.Toast.success('Demande envoyée.');
          }
        });
      });
    });
  },

  _selfieBlob: null,
  _stream: null
};
