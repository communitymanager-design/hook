// Analytics globales : croissance, envois, livraison, répartition des entreprises
window.PageAdminAnalytics = {
  render: function() {
    var self = this;
    window.Helpers.renderPage(window.AdminUI.loading());
    Promise.all([
      window.DB.from('users').select('id,created_at,organization_id').eq('role', 'client'),
      window.DB.from('campaigns').select('id,organization_id,statut,contacts_count,delivered_count,failed_count,created_at,sent_at'),
      window.DB.from('organizations').select('id,nom,ville,secteur'),
      window.DB.from('credit_transactions').select('type,montant_fcfa,statut,created_at')
    ]).then(function(r) {
      self._render({
        users: r[0].data || [],
        camps: r[1].data || [],
        orgs: r[2].data || [],
        tx: r[3].data || []
      });
    }).catch(function() {
      self._render({ users: [], camps: [], orgs: [], tx: [] });
    });
  },

  _group: function(list, key) {
    var m = {};
    list.forEach(function(x) {
      var k = (x[key] || '').trim() || 'Non renseigné';
      k = k.charAt(0).toUpperCase() + k.slice(1);
      m[k] = (m[k] || 0) + 1;
    });
    return Object.keys(m).map(function(k) { return { label: k, value: m[k] }; })
      .sort(function(a, b) { return b.value - a.value; }).slice(0, 8);
  },

  _render: function(d) {
    var UI = window.AdminUI;
    var sent = d.camps.filter(function(c) { return c.statut === 'sent' || c.statut === 'sending'; });
    var smsSent = sent.reduce(function(a, c) { return a + (c.contacts_count || 0); }, 0);
    var delivered = sent.reduce(function(a, c) { return a + (c.delivered_count || 0); }, 0);
    var failed = sent.reduce(function(a, c) { return a + (c.failed_count || 0); }, 0);
    var deliveryRate = (delivered + failed) ? Math.round(delivered / (delivered + failed) * 1000) / 10 : null;

    var d30 = function(x) { return UI.daysSince(x) <= 30; };
    var d60 = function(x) { return UI.daysSince(x) > 30 && UI.daysSince(x) <= 60; };
    var newUsers30 = d.users.filter(function(u) { return d30(u.created_at); }).length;
    var newUsersPrev = d.users.filter(function(u) { return d60(u.created_at); }).length;
    var growth = newUsersPrev ? Math.round((newUsers30 - newUsersPrev) / newUsersPrev * 100) : null;

    var activeOrgs = {};
    sent.forEach(function(c) { if (d30(c.sent_at || c.created_at)) activeOrgs[c.organization_id] = true; });
    var activeCount = Object.keys(activeOrgs).length;

    var orgById = {};
    d.orgs.forEach(function(o) { orgById[o.id] = o; });
    var smsByOrg = {};
    sent.forEach(function(c) { smsByOrg[c.organization_id] = (smsByOrg[c.organization_id] || 0) + (c.contacts_count || 0); });
    var topOrgs = Object.keys(smsByOrg).map(function(id) {
      return { label: (orgById[id] && orgById[id].nom) || 'Organisation inconnue', value: smsByOrg[id] };
    }).sort(function(a, b) { return b.value - a.value; }).slice(0, 8);

    var revenue = UI.weekly(d.tx.filter(function(t) { return window.PageAdminBilling.isRevenue(t); }), function(t) { return t.created_at; }, function(t) { return t.montant_fcfa || 0; }, 12);

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
      UI.header('Services', 'Analytics globales', 'Croissance et usage de la plateforme',
        '<button class="admin-btn" onclick="window.PageAdminAnalytics.render()">Actualiser</button>') +
      '<div class="admin-kpi-grid">' +
      UI.kpi('Nouveaux clients (30j)', UI.num(newUsers30), growth == null ? '' : (growth >= 0 ? '+' : '') + growth + '% vs 30j précédents', growth == null ? '' : growth >= 0 ? 'up' : 'down', '/Nkololopangohook/activite') +
      UI.kpi('Entreprises actives (30j)', UI.num(activeCount), 'ont envoyé au moins une campagne', '', '/Nkololopangohook/activite') +
      UI.kpi('SMS envoyés', UI.num(smsSent), sent.length + ' campagne' + (sent.length > 1 ? 's' : ''), '', '/Nkololopangohook/campagnes') +
      UI.kpi('Taux de livraison', deliveryRate == null ? '-' : deliveryRate.toLocaleString('fr-FR') + ' %', deliveryRate == null ? 'pas encore de rapports' : UI.num(failed) + ' SMS en échec', deliveryRate == null ? '' : deliveryRate >= 95 ? 'up' : 'warn') +
      UI.kpi('Clients inscrits', UI.num(d.users.length), '', '', '/Nkololopangohook/clients') +
      UI.kpi('Campagnes créées', UI.num(d.camps.length), '', '', '/Nkololopangohook/campagnes') +
      '</div>' +
      '<div class="admin-grid-2">' +
      '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Inscriptions par semaine</div><span style="font-size:11px;color:var(--admin-text-muted)">12 semaines</span></div>' +
      UI.columns(UI.weekly(d.users, function(u) { return u.created_at; }, null, 12)) + '</div>' +
      '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">SMS envoyés par semaine</div><span style="font-size:11px;color:var(--admin-text-muted)">12 semaines</span></div>' +
      UI.columns(UI.weekly(sent, function(c) { return c.sent_at || c.created_at; }, function(c) { return c.contacts_count || 0; }, 12)) + '</div>' +
      '</div>' +
      '<div class="admin-grid-2 admin-mt">' +
      '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Revenus par semaine</div><span style="font-size:11px;color:var(--admin-text-muted)">FCFA</span></div>' +
      UI.columns(revenue) + '</div>' +
      '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Top entreprises (SMS envoyés)</div></div>' +
      UI.bars(topOrgs, { empty: 'Aucune campagne envoyée.' }) + '</div>' +
      '</div>' +
      '<div class="admin-grid-2 admin-mt">' +
      '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Répartition par ville</div></div>' +
      UI.bars(this._group(d.orgs, 'ville')) + '</div>' +
      '<div class="admin-card"><div class="admin-card-header"><div class="admin-card-title">Répartition par secteur</div></div>' +
      UI.bars(this._group(d.orgs, 'secteur')) + '</div>' +
      '</div>' +
      '</div>'
    );
  }
};
