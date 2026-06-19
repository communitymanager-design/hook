window.PageCampagnes = {
  activeTab: 'toutes',
  searchQ: '',
  camps: [],

  render: function() {
    if (!window.HookAuth.isLoggedIn()) { window.Router.navigate('/auth'); return; }
    if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null; }
    this.activeTab = 'toutes';
    this.searchQ = '';
    window.Helpers.renderPage('<div class="page-wrapper"><div style="padding:40px;text-align:center;color:var(--color-text-muted)">Chargement...</div></div>');
    this._load();
  },

  _load: function() {
    var self = this;
    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    if (!orgId) { self.camps = []; self._renderPage(); return; }
    window.DB.from('campaigns').select('*').eq('organization_id', orgId).order('created_at', { ascending: false })
      .then(function(res) {
        self.camps = res.data || [];
        self._renderPage();
        var hasSending = self.camps.some(function(c){ return c.statut === 'sending'; });
        if (hasSending && window.Router.current === '/campagnes') {
          self._pollTimer = setTimeout(function() {
            if (window.Router.current === '/campagnes') self._load();
          }, 6000);
        }
      })
      .catch(function() { self.camps = []; self._renderPage(); });
  },

  _renderPage: function() {
    var self = this;
    var camps = this.camps;
    var counts = {
      toutes:    camps.length,
      en_cours:  camps.filter(function(c){ return c.statut === 'sending'; }).length,
      programme: camps.filter(function(c){ return c.statut === 'scheduled'; }).length,
      terminé:   camps.filter(function(c){ return c.statut === 'sent' || c.statut === 'cancelled'; }).length,
      draft:     camps.filter(function(c){ return c.statut === 'draft'; }).length
    };

    window.Helpers.renderPage(
      '<div class="page-wrapper">' +
      '<div class="row camp-page-header">' +
        '<div>' +
          '<div class="breadcrumb">Campagnes</div>' +
          '<div class="page-title">Mes campagnes</div>' +
          '<div class="page-subtitle">' + camps.length + ' campagne' + (camps.length > 1 ? 's' : '') + '</div>' +
        '</div>' +
        '<button class="btn btn-primary btn-new-campagne" id="btn-new-camp">' +
          '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5v10M1.5 6.5h10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>' +
          'Nouvelle campagne' +
        '</button>' +
      '</div>' +
      '<div class="camp-tabs-bar">' +
        self._tab('toutes',    'Toutes',       counts.toutes) +
        self._tab('en_cours',  'En cours',     counts.en_cours) +
        self._tab('programme', 'Programmees',  counts.programme) +
        self._tab('draft',     'Brouillons',   counts.draft) +
        self._tab('terminé',   'Terminées',    counts.terminé) +
      '</div>' +
      '<div class="camp-search-row"><div class="camp-search-wrap">' +
        '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke="currentColor" stroke-width="1.3"/><path d="M10 10l2.5 2.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>' +
        '<input id="camp-search" type="text" placeholder="Rechercher une campagne..." class="camp-search-input">' +
      '</div></div>' +
      '<div id="camp-list">' + self._renderList(camps, 'toutes', '') + '</div>' +
      '</div>'
    );
    self._bindEvents();
  },

  _tab: function(id, label, count) {
    var active = this.activeTab === id ? 'active' : '';
    return '<button class="camp-tab ' + active + '" data-tab="' + id + '">' +
      label + (count > 0 ? '<span class="camp-tab-badge">' + count + '</span>' : '') +
    '</button>';
  },

  _renderList: function(camps, tab, search) {
    var statusMap = { sending: 'en_cours', scheduled: 'programme', sent: 'terminé', cancelled: 'terminé', draft: 'draft' };
    var filtered = camps.filter(function(c) {
      var mapped = statusMap[c.statut] || c.statut;
      var matchTab = tab === 'toutes' || mapped === tab;
      var matchSearch = !search || (c.nom||'').toLowerCase().indexOf(search.toLowerCase()) !== -1;
      return matchTab && matchSearch;
    });

    if (!filtered.length) {
      return '<div class="camp-empty">' +
        '<svg width="40" height="40" viewBox="0 0 40 40" fill="none"><rect x="6" y="8" width="28" height="24" rx="4" stroke="var(--color-text-muted)" stroke-width="1.5"/><path d="M13 16h14M13 21h10M13 26h7" stroke="var(--color-text-muted)" stroke-width="1.3" stroke-linecap="round"/></svg>' +
        '<div class="camp-empty-title">' + (this.camps.length === 0 ? 'Aucune campagne' : 'Aucun résultat') + '</div>' +
        '<div class="camp-empty-sub">' + (this.camps.length === 0 ? 'Crééz votre première campagne pour commencer a envoyér des SMS.' : 'Aucune campagne ne correspond a cette selection.') + '</div>' +
      '</div>';
    }

    return filtered.map(function(c) { return window.PageCampagnes._card(c); }).join('');
  },

  _card: function(c) {
    var statusMap = {
      sending:   { label: 'En cours',   cls: 'tag-info' },
      scheduled: { label: 'Programme',  cls: 'tag-warning' },
      sent:      { label: 'Terminé',    cls: 'tag-neutral' },
      cancelled: { label: 'Annule',     cls: 'tag-danger' },
      draft:     { label: 'Brouillon',  cls: 'tag-neutral' }
    };
    var st = statusMap[c.statut] || { label: c.statut, cls: 'tag-neutral' };
    var date = c.scheduled_at ? c.scheduled_at.slice(0,10) : (c.created_at ? c.created_at.slice(0,10) : '');
    var heure = c.scheduled_at ? c.scheduled_at.slice(11,16) : '';
    var envoyés = c.contacts_count || 0;
    var livrés = c.delivered_count || 0;
    var echecs = c.failed_count || 0;
    var traites = livrés + echecs;
    var pct = envoyés > 0 ? Math.round((traites / envoyés) * 100) : 0;
    var tauxLivraison = envoyés > 0 ? Math.round((livrés / envoyés) * 100) : 0;

    var progressBar = (c.statut === 'sending' && envoyés > 0)
      ? '<div class="camp-progress"><div class="camp-progress-bar"><div class="camp-progress-fill" style="width:' + pct + '%"></div></div><span class="camp-progress-label">' + traites.toLocaleString('fr-FR') + ' / ' + envoyés.toLocaleString('fr-FR') + ' traites (' + pct + '%)</span></div>'
      : '';

    var metrics = (c.statut === 'sent')
      ? '<div class="camp-metrics">' +
          window.PageCampagnes._metric(envoyés > 0 ? envoyés.toLocaleString('fr-FR') : '-', 'SMS envoyés', '') +
          window.PageCampagnes._metric(envoyés > 0 ? tauxLivraison + '%' : '-', 'Taux livraison', 'green') +
          window.PageCampagnes._metric(echecs > 0 ? echecs.toLocaleString('fr-FR') : '0', 'Échecs', echecs > 0 ? 'red' : '') +
          window.PageCampagnes._metric('-', 'Taux de clic', 'blue') +
          window.PageCampagnes._metric('-', 'Conversions', '') +
          window.PageCampagnes._metric('-', 'CPL', '') +
        '</div>'
      : '';

    return '<div class="camp-card" data-id="' + c.id + '">' +
      '<div class="camp-card-top">' +
        '<div class="camp-card-left">' +
          '<div class="camp-card-name">' + window.Helpers.escapeHtml(c.nom) + '</div>' +
          '<div class="camp-card-meta">' +
            '<span class="tag ' + st.cls + '">' + st.label + '</span>' +
            (date ? '<span class="camp-meta-sep"></span><span class="camp-time">' + date + (heure ? ' · ' + heure : '') + '</span>' : '') +
            (envoyés > 0 ? '<span class="camp-meta-sep"></span><span class="camp-segment">' + envoyés.toLocaleString('fr-FR') + ' contacts</span>' : '') +
          '</div>' +
        '</div>' +
        '<div class="camp-card-actions">' +
          '<button class="btn btn-sm camp-action-btn" data-action="dup" data-id="' + c.id + '" title="Dupliquer">' +
            '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.1"/><path d="M2 9V2h7" stroke="currentColor" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
          '</button>' +
        '</div>' +
      '</div>' +
      progressBar + metrics +
    '</div>';
  },

  _metric: function(val, label, cls) {
    return '<div class="camp-metric"><div class="camp-metric-val ' + cls + '">' + val + '</div><div class="camp-metric-lbl">' + label + '</div></div>';
  },

  _bindEvents: function() {
    var self = this;
    var newBtn = document.getElementById('btn-new-camp');
    if (newBtn) newBtn.addEventListener('click', function() { window.Helpers.requireActiveSender(function(){ window.Router.navigate('/campagnes/new'); }); });

    document.querySelectorAll('.camp-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        self.activeTab = tab.getAttribute('data-tab');
        document.querySelectorAll('.camp-tab').forEach(function(t){ t.classList.remove('active'); });
        tab.classList.add('active');
        document.getElementById('camp-list').innerHTML = self._renderList(self.camps, self.activeTab, self.searchQ);
        self._bindCardEvents();
      });
    });

    var searchInput = document.getElementById('camp-search');
    if (searchInput) {
      searchInput.addEventListener('input', function() {
        self.searchQ = searchInput.value;
        document.getElementById('camp-list').innerHTML = self._renderList(self.camps, self.activeTab, self.searchQ);
        self._bindCardEvents();
      });
    }

    this._bindCardEvents();
  },

  _bindCardEvents: function() {
    document.querySelectorAll('.camp-action-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        window.Toast.info('Campagne dupliquee');
      });
    });
    document.querySelectorAll('.camp-card').forEach(function(card) {
      card.addEventListener('click', function(e) {
        if (e.target.closest('.camp-action-btn')) return;
        var id = card.getAttribute('data-id'); if(id){ window.PageCampagneDetail && (window.PageCampagneDetail._currentId = id); window.Router.navigate('/campagnes/detail/' + id); }
      });
    });
  }
};
