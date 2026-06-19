window.PageAnalytics = {
  camps: [],
  selectedCamp: 'all',
  period: '30',

  render: function() {
    if (!window.HookAuth.isLoggedIn()) { window.Router.navigate('/auth'); return; }
    var orgId = window.HookAuth.user && window.HookAuth.user.id;
    if (!orgId) { window.PageAnalytics._renderNoData(); return; }
    var self = this;
    window.DB.from('campaigns').select('id,nom,contacts_count,statut,created_at').eq('organization_id', orgId).order('created_at', { ascending: false })
      .then(function(res) {
        self.camps = res.data || [];
        if (!self.camps.length) { window.PageAnalytics._renderNoData(); return; }
        window.Helpers.renderPage(self._buildHtml());
        self._bindEvents();
      })
      .catch(function() { window.PageAnalytics._renderNoData(); });
  },

  _renderNoData: function() {
    window.Helpers.renderPage(
      '<div class="page-wrapper"><div class="page-card">' +
        '<div class="page-header"><div><div class="breadcrumb">Analytics</div><div class="page-title">Performance des campagnes</div></div></div>' +
        '<div style="padding:72px 24px;text-align:center">' +
          '<svg width="48" height="48" viewBox="0 0 48 48" fill="none" style="margin:0 auto 16px"><rect x="4" y="28" width="8" height="14" rx="2" stroke="var(--color-text-muted)" stroke-width="1.5"/><rect x="20" y="18" width="8" height="24" rx="2" stroke="var(--color-text-muted)" stroke-width="1.5"/><rect x="36" y="8" width="8" height="34" rx="2" stroke="var(--color-text-muted)" stroke-width="1.5"/></svg>' +
          '<div style="font-size:16px;font-weight:600;margin-bottom:8px">Aucune donnee disponible</div>' +
          '<div style="font-size:13px;color:var(--color-text-secondary);max-width:360px;margin:0 auto 24px;line-height:1.6">Les analytics s\'afficheront ici une fois que vous aurez envoyé vos premières campagnes.</div>' +
          '<div style="display:flex;gap:10px;justify-content:center">' +
            '<button class="btn" onclick="window.Router.navigate(\'/sender-id\')">Créer un Sender ID</button>' +
            '<button class="btn btn-primary" onclick="window.Router.navigate(\'/campagnes/new\')">Créer une campagne</button>' +
          '</div>' +
        '</div>' +
      '</div></div>'
    );
  },

  _buildHtml: function() {
    var self = this;
    var camps = this.camps;
    var selected = this.selectedCamp;
    var filtered = selected === 'all' ? camps : camps.filter(function(c){ return c.id === selected; });

    var totalSent = 0;
    filtered.forEach(function(c){ totalSent += (c.contacts_count || 0); });

    var campOptions = '<option value="all">Toutes les campagnes</option>' +
      camps.map(function(c){ return '<option value="' + c.id + '"' + (selected === c.id ? ' selected' : '') + '>' + window.Helpers.escapeHtml(c.nom) + '</option>'; }).join('');

    var cohorteRows = filtered.slice(0, 5).map(function(c) {
      var count = (c.contacts_count || 0).toLocaleString('fr-FR');
      var date = c.created_at ? c.created_at.slice(0,10) : '-';
      return '<tr>' +
        '<td>' + window.Helpers.escapeHtml(c.nom) + '</td>' +
        '<td style="text-align:right">' + count + '</td>' +
        '<td style="text-align:right;color:var(--color-text-muted)">N/A</td>' +
        '<td style="text-align:right">N/A</td>' +
        '<td style="text-align:right">N/A</td>' +
        '<td style="text-align:right">N/A</td>' +
      '</tr>';
    }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--color-text-muted);padding:20px">Aucune campagne pour cette période</td></tr>';

    var templateRows = filtered.slice(0, 4).map(function(c, i) {
      return self.barRow(window.Helpers.escapeHtml(c.nom.slice(0,22)), 'N/A', 0);
    }).join('');

    return '<div class="page-wrapper"><div class="page-card">' +
      '<div class="page-header">' +
        '<div><div class="breadcrumb">Analytics</div><div class="page-title">Performance des campagnes</div>' +
        '<div class="page-subtitle">Donnees de vos campagnes</div></div>' +
        '<div class="page-header-actions">' +
          '<select id="filter-camp" style="width:auto;font-size:12px">' + campOptions + '</select>' +
          '<select id="filter-period" style="width:auto;font-size:12px">' +
            '<option value="30"' + (self.period==='30'?' selected':'') + '>30 derniers jours</option>' +
            '<option value="7"' + (self.period==='7'?' selected':'') + '>7 derniers jours</option>' +
            '<option value="90"' + (self.period==='90'?' selected':'') + '>90 derniers jours</option>' +
            '<option value="all"' + (self.period==='all'?' selected':'') + '>Tout</option>' +
          '</select>' +
          '<button class="btn">Exporter</button>' +
        '</div>' +
      '</div>' +

      '<div class="kpi-grid-5">' +
        '<div class="kpi-card"><div class="kpi-label">SMS envoyés</div><div class="kpi-value">' + (totalSent > 0 ? totalSent.toLocaleString('fr-FR') : '0') + '</div></div>' +
        '<div class="kpi-card"><div class="kpi-label">CPL moyen</div><div class="kpi-value">N/A</div></div>' +
        '<div class="kpi-card"><div class="kpi-label">Taux clic</div><div class="kpi-value">N/A</div></div>' +
        '<div class="kpi-card"><div class="kpi-label">Conversions</div><div class="kpi-value">N/A</div></div>' +
        '<div class="kpi-card"><div class="kpi-label">Désabonnés</div><div class="kpi-value">N/A</div></div>' +
      '</div>' +

      '<div class="card">' +
        '<div class="row" style="margin-bottom:12px">' +
          '<div><div class="card-title" style="margin-bottom:4px">Heure optimale d\'envoi</div>' +
          '<div style="font-size:11px;color:var(--color-text-secondary)">Disponible après 10 envois</div></div>' +
          '<div style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--color-text-secondary)">' +
            '<span>Faible</span>' +
            '<div style="display:flex;gap:2px">' +
              '<div style="width:14px;height:10px;background:#E4F0E8;border-radius:2px"></div>' +
              '<div style="width:14px;height:10px;background:#A8D4B5;border-radius:2px"></div>' +
              '<div style="width:14px;height:10px;background:#6BAF85;border-radius:2px"></div>' +
              '<div style="width:14px;height:10px;background:#2E8B57;border-radius:2px"></div>' +
              '<div style="width:14px;height:10px;background:#0B5C32;border-radius:2px"></div>' +
            '</div><span>Fort</span>' +
          '</div>' +
        '</div>' +
        '<div style="overflow-x:auto">' +
          self._buildHeatmap(filtered) +
        '</div>' +
      '</div>' +

      '<div class="grid-2" style="margin-bottom:12px">' +
        '<div class="card" style="margin-bottom:0">' +
          '<div class="card-title">Performance par campagne</div>' +
          (templateRows || '<div style="font-size:13px;color:var(--color-text-muted);padding:8px 0">Aucune donnee.</div>') +
        '</div>' +
        '<div class="card" style="margin-bottom:0">' +
          '<div class="card-title">Repartition geographique</div>' +
          '<div style="font-size:13px;color:var(--color-text-muted);padding:16px 0">Disponible après les premiers envois.</div>' +
        '</div>' +
      '</div>' +

      '<div class="card" style="margin-bottom:0">' +
        '<div class="row" style="margin-bottom:12px">' +
          '<div class="card-title" style="margin-bottom:0">Comparaison de cohortes</div>' +
          '<span style="font-size:12px;color:var(--color-text-muted)">' + filtered.length + ' campagne' + (filtered.length > 1 ? 's' : '') + '</span>' +
        '</div>' +
        '<div class="table-wrapper">' +
          '<table><thead><tr>' +
            '<th>Campagne</th>' +
            '<th style="text-align:right">Envoyés</th>' +
            '<th style="text-align:right">Livraison</th>' +
            '<th style="text-align:right">Clics</th>' +
            '<th style="text-align:right">Conv.</th>' +
            '<th style="text-align:right">CPL</th>' +
          '</tr></thead><tbody>' + cohorteRows + '</tbody></table>' +
        '</div>' +
      '</div>' +

    '</div></div>';
  },

  _buildHeatmap: function(camps) {
    var days = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
    var hours = ['06h','09h','12h','15h','18h','21h'];
    var w = 600; var h = 180;

    var rects = '';
    for (var d = 0; d < 7; d++) {
      for (var slot = 0; slot < 15; slot++) {
        var x = 40 + slot * 24;
        var y = 24 + d * 20;
        rects += '<rect x="' + x + '" y="' + y + '" width="22" height="14" fill="#E4F0E8" rx="2"/>';
      }
    }

    var labels = '';
    hours.forEach(function(h, i){ labels += '<text x="' + (40 + i*70) + '" y="14" font-size="10" fill="#4A6355">' + h + '</text>'; });
    days.forEach(function(d, i){ labels += '<text x="0" y="' + (34 + i*20) + '" font-size="10" fill="#4A6355">' + d + '</text>'; });

    var note = '<rect x="430" y="55" width="155" height="80" fill="#0B3828" rx="6"/>' +
      '<text x="445" y="80" font-size="11" fill="#E4F0E8" font-weight="500">Recommandation IA</text>' +
      '<text x="445" y="100" font-size="10" fill="#A8D4B5">Disponible après</text>' +
      '<text x="445" y="118" font-size="10" fill="#A8D4B5">10 envois</text>';

    return '<svg viewBox="0 0 600 180" style="min-width:400px;width:100%;height:180px">' + labels + rects + note + '</svg>';
  },

  barRow: function(label, value, pct) {
    return '<div style="margin-bottom:12px">' +
      '<div class="row" style="font-size:12px;margin-bottom:4px"><span>' + label + '</span><span style="font-weight:500">' + value + '</span></div>' +
      '<div class="bar-bg"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
    '</div>';
  },

  _bindEvents: function() {
    var self = this;
    var campFilter = document.getElementById('filter-camp');
    var periodFilter = document.getElementById('filter-period');

    if (campFilter) campFilter.addEventListener('change', function() {
      self.selectedCamp = campFilter.value;
      window.Helpers.renderPage(self._buildHtml());
      self._bindEvents();
    });

    if (periodFilter) periodFilter.addEventListener('change', function() {
      self.period = periodFilter.value;
      var cutoff = null;
      if (self.period !== 'all') {
        var d = new Date();
        d.setDate(d.getDate() - parseInt(self.period));
        cutoff = d.toISOString();
      }
      var orgId = window.HookAuth.user && window.HookAuth.user.id;
      var q = window.DB.from('campaigns').select('id,nom,contacts_count,statut,created_at').eq('organization_id', orgId).order('created_at', { ascending: false });
      if (cutoff) q = q.gte('created_at', cutoff);
      q.then(function(res) {
        self.camps = res.data || [];
        self.selectedCamp = 'all';
        window.Helpers.renderPage(self._buildHtml());
        self._bindEvents();
      });
    });
  }
};
