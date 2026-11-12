// Support : file des clients à accompagner, construite à partir des signaux de la plateforme
window.PageAdminSupport = {
  tab: 'tous',
  items: [],

  KINDS: {
    bloque: { label: 'Compte bloqué', cls: 'admin-tag-danger', prio: 1 },
    sid_refuse: { label: 'Sender ID refusé', cls: 'admin-tag-danger', prio: 2 },
    erreurs: { label: 'Erreurs d\'envoi', cls: 'admin-tag-warn', prio: 3 },
    sid_attente: { label: 'Sender ID en attente', cls: 'admin-tag-warn', prio: 4 },
    bloque_parcours: { label: 'Bloqué dans le parcours', cls: 'admin-tag-blue', prio: 5 },
    jamais: { label: 'Jamais connecté', cls: 'admin-tag-neutral', prio: 6 }
  },

  render: function() {
    var self = this;
    window.Helpers.renderPage(window.AdminUI.loading());
    window.AdminActivity.load(function(err, rows) {
      if (err) { self.items = []; self._render(); return; }
      var orgIds = rows.map(function(r) { return r.user.organization_id; }).filter(Boolean);
      var since = new Date(Date.now() - 7 * 86400000).toISOString();
      Promise.all([
        orgIds.length ? window.DB.from('sender_ids').select('id,organization_id,name,statut,submitted_at').in('organization_id', orgIds).in('statut', ['rejected', 'pending']) : Promise.resolve({ data: [] }),
        window.DB.from('api_errors').select('organization_id,type,created_at').gte('created_at', since)
      ]).then(function(r) {
        self.items = self._build(rows, r[0].data || [], r[1].data || []);
        self._render();
      }).catch(function() {
        self.items = self._build(rows, [], []);
        self._render();
      });
    });
  },

  _build: function(rows, sids, errors) {
    var UI = window.AdminUI;
    var items = [];
    rows.forEach(function(r) {
      var u = r.user, org = u.organization_id;
      var push = function(kind, detail, since) { items.push({ kind: kind, row: r, detail: detail, since: since }); };

      if (u.is_blocked) push('bloque', 'Le client ne peut plus accéder à Hook.', null);

      sids.filter(function(s) { return s.organization_id === org; }).forEach(function(s) {
        if (s.statut === 'rejected') push('sid_refuse', 'Sender ID « ' + s.name + ' » refusé : aidez-le à soumettre une nouvelle demande.', s.submitted_at);
        else if (UI.daysSince(s.submitted_at) > 2) push('sid_attente', '« ' + s.name + ' » attend une validation depuis ' + Math.floor(UI.daysSince(s.submitted_at)) + ' jours.', s.submitted_at);
      });

      var errs = errors.filter(function(e) { return org && e.organization_id === org; });
      if (errs.length) push('erreurs', errs.length + ' erreur' + (errs.length > 1 ? 's' : '') + ' API ces 7 derniers jours (' + errs[0].type + ').', errs[0].created_at);

      if (!u.is_blocked) {
        if (r.status === 'jamais' && UI.daysSince(u.created_at) > 2) {
          push('jamais', 'Inscrit ' + UI.ago(u.created_at).toLowerCase() + ', ne s\'est jamais connecté.', u.created_at);
        } else if ((r.status === 'connecte' || r.status === 'demarre') && UI.daysSince(u.created_at) > 3 && r.next) {
          push('bloque_parcours', 'Étape suivante : ' + r.next.label + ' (' + r.done + '/' + window.AdminActivity.STEPS.length + ').', u.created_at);
        }
      }
    });
    var K = this.KINDS;
    return items.sort(function(a, b) { return K[a.kind].prio - K[b.kind].prio; });
  },

  _render: function() {
    var UI = window.AdminUI;
    var self = this;
    var counts = { tous: this.items.length };
    Object.keys(this.KINDS).forEach(function(k) { counts[k] = self.items.filter(function(i) { return i.kind === k; }).length; });
    var list = this.tab === 'tous' ? this.items : this.items.filter(function(i) { return i.kind === self.tab; });
    var urgent = counts.bloque + counts.sid_refuse + counts.erreurs;

    var tabs = [{ key: 'tous', label: 'Tous', count: counts.tous }].concat(Object.keys(this.KINDS).filter(function(k) { return counts[k]; }).map(function(k) {
      return { key: k, label: self.KINDS[k].label, count: counts[k] };
    }));

    var body = !list.length ? UI.empty('Rien à signaler : aucun client ne semble avoir besoin d\'aide.') :
      '<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Client</th><th>Signal</th><th>Détail</th><th>Contact</th><th></th></tr></thead><tbody>' +
      list.map(function(it, idx) {
        var u = it.row.user;
        var tel = (u.telephone || '').replace(/[^0-9+]/g, '');
        var wa = tel.replace(/^\+/, '');
        if (wa && wa.indexOf('242') !== 0 && wa.length <= 9) wa = '242' + wa.replace(/^0/, '');
        return '<tr>' +
          '<td>' + UI.identity(u, (it.row.org && it.row.org.nom) || u.entreprise || u.email) + '</td>' +
          '<td>' + UI.statusTag(self.KINDS, it.kind) + '</td>' +
          '<td style="color:var(--admin-text-secondary);max-width:360px">' + UI.esc(it.detail) + '</td>' +
          '<td style="white-space:nowrap">' +
          (u.email ? '<a class="admin-link" href="mailto:' + UI.esc(u.email) + '">Email</a>' : '') +
          (tel ? ' · <a class="admin-link" href="tel:' + UI.esc(tel) + '">Appeler</a>' : '') +
          (wa ? ' · <a class="admin-link" target="_blank" rel="noopener" href="https://wa.me/' + UI.esc(wa) + '">WhatsApp</a>' : '') +
          '</td>' +
          '<td style="white-space:nowrap;text-align:right">' +
          '<button class="admin-btn-sm asup-nudge" data-i="' + idx + '">Relancer</button> ' +
          '<button class="admin-btn-sm asup-open" data-i="' + idx + '">Fiche</button>' +
          '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
      UI.header('Services', 'Support', 'Clients qui ont probablement besoin d\'un coup de main',
        '<a class="admin-btn" href="mailto:support@hookplateform.com" style="text-decoration:none">Boîte support</a><button class="admin-btn" id="asup-refresh">Actualiser</button>') +
      '<div class="admin-kpi-grid">' +
      UI.kpi('À traiter en priorité', UI.num(urgent), 'Blocages, refus, erreurs', urgent ? 'down' : 'up') +
      UI.kpi('Bloqués dans le parcours', UI.num(counts.bloque_parcours), 'Inscrits depuis plus de 3 jours', counts.bloque_parcours ? 'warn' : '', '/Nkololopangohook/activite') +
      UI.kpi('Jamais connectés', UI.num(counts.jamais), 'Inscrits depuis plus de 2 jours', counts.jamais ? 'warn' : '', '/Nkololopangohook/activite') +
      '</div>' +
      '<div class="admin-card">' +
      UI.tabs(tabs, this.tab, 'data-stab') +
      body +
      '</div>' +
      '</div>'
    );

    document.getElementById('asup-refresh').addEventListener('click', function() { self.render(); });
    document.querySelectorAll('[data-stab]').forEach(function(t) {
      t.addEventListener('click', function() { self.tab = t.getAttribute('data-stab'); self._render(); });
    });
    document.querySelectorAll('.asup-nudge').forEach(function(b) {
      b.addEventListener('click', function() { window.AdminActivity.openNudge(list[parseInt(b.getAttribute('data-i'), 10)].row); });
    });
    document.querySelectorAll('.asup-open').forEach(function(b) {
      b.addEventListener('click', function() {
        var u = list[parseInt(b.getAttribute('data-i'), 10)].row.user;
        window.PageAdminClientDetail.openClient(u.id, [{ id: u.id, prenom: u.prenom || '', nom: u.nom || '', email: u.email || '', role: 'client', organization_id: u.organization_id, created_at: u.created_at, is_blocked: !!u.is_blocked }]);
      });
    });
  }
};
