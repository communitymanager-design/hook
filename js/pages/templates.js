window.PageTemplates = {
  activeTab: 'publics',
  activeSecteur: 'Tous',
  activeCategorie: 'Toutes',
  publics: [],
  mes: [],
  secteurs: ['Tous','Banque','Assurance','E-commerce','Commerce','Multi-secteurs'],
  categories: ['Toutes','Bienvenue','Promotionnel','Transactionnel','Rappel','Alerte','Voeux','Enquete','Recouvrement','OTP'],
  sectorTagClass: { Banque:'tag-info', Assurance:'tag-warning', 'E-commerce':'tag-purple', Commerce:'tag-success', 'Multi-secteurs':'tag-neutral' },

  render: function() {
    var self = this;
    if (!window.HookAuth.isLoggedIn()) { window.Router.navigate('/auth'); return; }
    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    window.DB.from('templates').select('*, users(prenom,nom)').order('created_at', { ascending: true })
      .then(function(res) {
        var all = res.data || [];
        self.publics = all.filter(function(t){ return t.is_public; });
        self.mes = all.filter(function(t){ return !t.is_public && t.organization_id === orgId; });
        window.Helpers.renderPage(self.buildHtml());
        self.bindEvents();
      })
      .catch(function() {
        window.Helpers.renderPage(self.buildHtml());
        self.bindEvents();
      });
  },

  buildHtml: function() {
    var self = this;
    var list = this.activeTab === 'publics' ? this.publics : this.mes;
    var filtered = list;

    if (this.activeSecteur !== 'Tous') {
      filtered = filtered.filter(function(t){ return t.secteur === self.activeSecteur; });
    }
    if (this.activeCategorie !== 'Toutes') {
      filtered = filtered.filter(function(t){ return t.categorie === self.activeCategorie; });
    }

    var chips1 = this.secteurs.map(function(s) {
      return '<button class="filter-chip ' + (self.activeSecteur===s?'active':'') + '" data-secteur="' + s + '">' + s + '</button>';
    }).join('');

    var chips2 = this.categories.map(function(c) {
      return '<button class="filter-chip ' + (self.activeCategorie===c?'active':'') + '" data-categorie="' + c + '">' + c + '</button>';
    }).join('');

    var shown = filtered.slice(0, 6);
    var remaining = filtered.length - shown.length;

    var cards = shown.map(function(t) {
      var chars = t.contenu ? t.contenu.length : (t.caracteres_count || 0);
      var sms   = t.sms_count || 1;
      var creator = '';
      if (!t.is_public && t.users) {
        var name = ((t.users.prenom||'') + ' ' + (t.users.nom||'')).trim();
        if (name) creator = '<div class="tpl-creator">Par ' + window.Helpers.escapeHtml(name) + '</div>';
      }
      return '<div class="template-card">' +
        '<div class="template-card-header">' +
          '<div class="template-tags"><span class="tag ' + (self.sectorTagClass[t.secteur]||'tag-neutral') + '">' + (t.secteur||'') + '</span><span class="tag tag-neutral">' + (t.categorie||'') + '</span></div>' +
          '<span class="template-lang">FR</span>' +
        '</div>' +
        '<div class="template-name">' + window.Helpers.escapeHtml(t.nom) + '</div>' +
        '<div class="template-preview">' + window.Helpers.escapeHtml(t.contenu) + '</div>' +
        creator +
        '<div class="template-meta">' +
          '<span class="template-chars">' + chars + ' car. · ' + sms + ' SMS</span>' +
          '<button class="btn btn-sm tpl-copy-btn" data-content="' + window.Helpers.escapeHtml(t.contenu) + '">Copier</button>' +
        '</div>' +
      '</div>';
    }).join('');

    var moreBtn = remaining > 0
      ? '<div class="templates-more"><button class="btn" id="btn-more-templates">Voir les ' + remaining + ' autres templates</button></div>'
      : '';

    var emptyState = '';
    if (!filtered.length) {
      emptyState = '<div style="padding:40px 24px;text-align:center;color:var(--color-text-muted)">' +
        (this.activeTab === 'mes' ? 'Vous n\'avez pas encore créé de template. Cliquez sur "Créer un template" pour commencer.' : 'Aucun template pour cette selection.') +
      '</div>';
    }

    return '<div class="page-wrapper"><div class="page-card">' +
      '<div class="page-header">' +
        '<div><div class="breadcrumb">Templates</div><div class="page-title">Bibliotheque de templates</div>' +
        '<div class="page-subtitle">' + this.publics.length + ' templates publics · ' + this.mes.length + ' personnels</div></div>' +
        '<button class="btn" id="btn-new-tpl">Créer un template</button>' +
      '</div>' +
      '<div class="templates-tabs">' +
        '<div class="templates-tab ' + (this.activeTab==='publics'?'active':'') + '" data-tab="publics">Templates publics</div>' +
        '<div class="templates-tab ' + (this.activeTab==='mes'?'active':'') + '" data-tab="mes">Mes templates</div>' +
      '</div>' +
      '<div class="template-filters"><div class="filter-label">Secteur</div><div class="filter-chips">' + chips1 + '</div></div>' +
      '<div class="template-filters"><div class="filter-label">Categorie</div><div class="filter-chips">' + chips2 + '</div></div>' +
      '<div class="template-grid" id="templates-grid">' + cards + emptyState + '</div>' +
      moreBtn +
    '</div></div>';
  },

  bindEvents: function() {
    var self = this;

    document.querySelectorAll('.templates-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        self.activeTab = tab.getAttribute('data-tab');
        self.render();
      });
    });

    document.querySelectorAll('[data-secteur]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self.activeSecteur = btn.getAttribute('data-secteur');
        window.Helpers.renderPage(self.buildHtml());
        self.bindEvents();
      });
    });

    document.querySelectorAll('[data-categorie]').forEach(function(btn) {
      btn.addEventListener('click', function() {
        self.activeCategorie = btn.getAttribute('data-categorie');
        window.Helpers.renderPage(self.buildHtml());
        self.bindEvents();
      });
    });

    document.querySelectorAll('.tpl-copy-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var text = btn.getAttribute('data-content');
        if (navigator.clipboard) {
          navigator.clipboard.writeText(text).then(function(){ window.Toast.success('Template copie !'); });
        } else {
          var ta = document.createElement('textarea');
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          document.body.removeChild(ta);
          window.Toast.success('Template copie !');
        }
      });
    });

    var btnNew = document.getElementById('btn-new-tpl');
    if (btnNew) btnNew.addEventListener('click', function(){ window.PageTemplateEditor.openSheet(); });

    var moreBtn = document.getElementById('btn-more-templates');
    if (moreBtn) moreBtn.addEventListener('click', function() {
      var list = self.activeTab === 'publics' ? self.publics : self.mes;
      var filtered = list.filter(function(t){
        var okS = self.activeSecteur === 'Tous' || t.secteur === self.activeSecteur;
        var okC = self.activeCategorie === 'Toutes' || t.categorie === self.activeCategorie;
        return okS && okC;
      });
      var grid = document.getElementById('templates-grid');
      if (grid) {
        grid.innerHTML = filtered.map(function(t) {
          var chars = t.contenu ? t.contenu.length : (t.caracteres_count || 0);
          var creator = '';
          if (!t.is_public && t.users) {
            var name = ((t.users.prenom||'') + ' ' + (t.users.nom||'')).trim();
            if (name) creator = '<div class="tpl-creator">Par ' + window.Helpers.escapeHtml(name) + '</div>';
          }
          return '<div class="template-card">' +
            '<div class="template-card-header"><div class="template-tags"><span class="tag ' + (self.sectorTagClass[t.secteur]||'tag-neutral') + '">' + (t.secteur||'') + '</span><span class="tag tag-neutral">' + (t.categorie||'') + '</span></div><span class="template-lang">FR</span></div>' +
            '<div class="template-name">' + window.Helpers.escapeHtml(t.nom) + '</div>' +
            '<div class="template-preview">' + window.Helpers.escapeHtml(t.contenu) + '</div>' +
            creator +
            '<div class="template-meta"><span class="template-chars">' + chars + ' car. · ' + (t.sms_count||1) + ' SMS</span><button class="btn btn-sm tpl-copy-btn" data-content="' + window.Helpers.escapeHtml(t.contenu) + '">Copier</button></div>' +
          '</div>';
        }).join('');
        moreBtn.parentElement.remove();
        self.bindEvents();
      }
    });
  }
};

window.PageTemplateEditor = {
  openSheet: function() {
    var self = this;
    var orgId = window.HookAuth.user && window.HookAuth.user.id;

    var sheet = document.createElement('div');
    sheet.id = 'tpl-sheet-overlay';
    sheet.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:300;display:flex;align-items:flex-end;justify-content:center;animation:fadeIn 0.18s ease';
    sheet.innerHTML =
      '<div class="tpl-sheet" id="tpl-sheet-box">' +
        '<div class="tpl-sheet-handle"></div>' +
        '<div class="tpl-sheet-header">' +
          '<div class="tpl-sheet-title">Nouveau template</div>' +
          '<button class="tpl-sheet-close" id="tpl-sheet-close"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button>' +
        '</div>' +
        '<div class="tpl-sheet-body">' +
          '<div class="campnew-field"><label>Nom du template <span class="field-req">*</span></label><input type="text" id="ts-nom" placeholder="Ex: Rappel échéance client"></div>' +
          '<div class="sid-form-row">' +
            '<div class="campnew-field"><label>Secteur</label><select id="ts-secteur"><option value="">Choisir...</option>' +
            ['Banque','Assurance','E-commerce','Commerce','Multi-secteurs','Autre'].map(function(s){ return '<option value="'+s+'">'+s+'</option>'; }).join('') +
            '</select></div>' +
            '<div class="campnew-field"><label>Categorie</label><select id="ts-cat"><option value="">Choisir...</option>' +
            ['Bienvenue','Promotionnel','Transactionnel','Rappel','Alerte','Voeux','Enquete','Recouvrement','OTP'].map(function(c){ return '<option value="'+c+'">'+c+'</option>'; }).join('') +
            '</select></div>' +
          '</div>' +
          '<div class="campnew-field">' +
            '<label>Message <span class="field-req">*</span></label>' +
            '<div class="msg-editor-wrap">' +
              '<textarea id="ts-content" rows="5" placeholder="Bonjour {prénom}, votre contrat..."></textarea>' +
              '<div class="msg-editor-footer">' +
                '<div class="msg-vars">' +
                  ['prenom','entreprise','date','montant','lien_court','code_otp'].map(function(v){ return '<span class="msg-var-btn" data-var="{'+v+'}">{'+v+'}</span>'; }).join('') +
                '</div>' +
                '<div class="msg-counters"><span id="ts-chars">0</span> car.</div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="tpl-sheet-preview">' +
            '<div class="tpl-preview-label">Apercu</div>' +
            '<div class="msg-preview-phone">' +
              '<div class="msg-preview-sender">SENDER_ID</div>' +
              '<div class="msg-preview-bubble" id="ts-preview">Votre message apparaitra ici...</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tpl-sheet-footer">' +
          '<button class="btn" id="tpl-sheet-cancel">Annuler</button>' +
          '<button class="btn btn-primary" id="tpl-sheet-save">Enregistrer le template</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(sheet);

    var close = function() {
      sheet.style.animation = 'fadeOut 0.15s ease forwards';
      setTimeout(function(){ if(sheet.parentNode) sheet.parentNode.removeChild(sheet); }, 150);
    };

    document.getElementById('tpl-sheet-close').addEventListener('click', close);
    document.getElementById('tpl-sheet-cancel').addEventListener('click', close);
    sheet.addEventListener('click', function(e){ if(e.target === sheet) close(); });

    var textarea = document.getElementById('ts-content');
    var preview  = document.getElementById('ts-preview');
    var counter  = document.getElementById('ts-chars');

    textarea.addEventListener('input', function() {
      preview.textContent = textarea.value || 'Votre message apparaitra ici...';
      counter.textContent = textarea.value.length;
    });

    document.querySelectorAll('.msg-var-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var v = btn.getAttribute('data-var');
        var pos = textarea.selectionStart;
        textarea.value = textarea.value.slice(0, pos) + v + textarea.value.slice(pos);
        textarea.dispatchEvent(new Event('input'));
      });
    });

    document.getElementById('tpl-sheet-save').addEventListener('click', function() {
      var nom     = document.getElementById('ts-nom').value.trim();
      var contenu = document.getElementById('ts-content').value.trim();
      if (!nom)    { window.Toast.error('Nom requis'); return; }
      if (!contenu){ window.Toast.error('Message requis'); return; }
      window.DB.from('templates').insert({
        nom: nom,
        contenu: contenu,
        secteur: document.getElementById('ts-secteur').value || null,
        categorie: document.getElementById('ts-cat').value || null,
        caracteres_count: contenu.length,
        sms_count: Math.ceil(contenu.length / 160) || 1,
        is_public: false,
        organization_id: orgId
      }).then(function(res) {
        if (res.error) { window.Toast.error(res.error.message); return; }
        close();
        window.Toast.success('Template créé !');
        window.PageTemplates.render();
      });
    });
  },

  render: function() {
    window.PageTemplates.render();
  }
};
