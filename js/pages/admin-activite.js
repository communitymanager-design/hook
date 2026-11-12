// Suivi d'activite des clients : qui s'est connecte, qui a commence a utiliser Hook
window.AdminActivity = {
  STEPS: [
    { key: 'confirmed', label: 'Email confirmé' },
    { key: 'connected', label: 'Première connexion' },
    { key: 'sid_submitted', label: 'Sender ID soumis' },
    { key: 'sid_approved', label: 'Sender ID validé' },
    { key: 'contacts', label: 'Contacts importés' },
    { key: 'campaign_sent', label: 'Première campagne envoyée' }
  ],

  STATUS: {
    jamais: { label: 'Jamais connecté', cls: 'admin-tag-danger' },
    connecte: { label: 'Connecté, sans usage', cls: 'admin-tag-warn' },
    demarre: { label: 'A démarré', cls: 'admin-tag-blue' },
    actif: { label: 'Actif', cls: 'admin-tag-success' },
    inactif: { label: 'Inactif', cls: 'admin-tag-neutral' }
  },

  ACTIVE_DAYS: 30,

  // Charge tous les clients et calcule leur niveau d'activation
  load: function(cb) {
    var self = this;
    window.DB.from('users')
      .select('id, prenom, nom, email, telephone, entreprise, organization_id, created_at, last_login_at, is_blocked')
      .eq('role', 'client')
      .order('created_at', { ascending: false })
      .then(function(res) {
        if (res.error) { cb(res.error, []); return; }
        var users = res.data || [];
        var orgIds = users.map(function(u) { return u.organization_id; }).filter(Boolean);
        orgIds = orgIds.filter(function(id, i) { return orgIds.indexOf(id) === i; });

        var empty = Promise.resolve({ data: [] });
        var authQ = window.DB.rpc('admin_users_activity').then(function(r) { return r; }, function() { return { data: null }; });

        Promise.all([
          orgIds.length ? window.DB.from('sender_ids').select('organization_id,statut,submitted_at').in('organization_id', orgIds) : empty,
          orgIds.length ? window.DB.from('campaigns').select('organization_id,statut,created_at,sent_at,contacts_count').in('organization_id', orgIds) : empty,
          orgIds.length ? window.DB.from('organizations').select('id,nom,ville,secteur').in('id', orgIds) : empty,
          Promise.all(orgIds.map(function(id) {
            return window.DB.from('contacts').select('id', { count: 'exact', head: true }).eq('organization_id', id)
              .then(function(r) { return { id: id, count: r.count || 0 }; }, function() { return { id: id, count: 0 }; });
          })),
          authQ
        ]).then(function(r) {
          var authRows = (r[4] && !r[4].error && r[4].data) || null;
          cb(null, self._compute(users, {
            sids: r[0].data || [],
            camps: r[1].data || [],
            orgs: r[2].data || [],
            contacts: r[3] || [],
            auth: authRows
          }), !!authRows);
        }).catch(function(err) { cb(err, []); });
      }, function(err) { cb(err, []); });
  },

  _compute: function(users, d) {
    var self = this;
    var authById = {};
    (d.auth || []).forEach(function(a) { authById[a.id] = a; });
    var orgById = {};
    d.orgs.forEach(function(o) { orgById[o.id] = o; });
    var contactsByOrg = {};
    d.contacts.forEach(function(c) { contactsByOrg[c.id] = c.count; });

    return users.map(function(u) {
      var org = u.organization_id;
      var sids = org ? d.sids.filter(function(s) { return s.organization_id === org; }) : [];
      var camps = org ? d.camps.filter(function(c) { return c.organization_id === org; }) : [];
      var sent = camps.filter(function(c) { return c.statut === 'sent' || c.statut === 'sending'; });
      var contacts = org ? (contactsByOrg[org] || 0) : 0;
      var auth = authById[u.id] || null;

      var lastSeen = self._max([u.last_login_at, auth && auth.last_sign_in_at]);
      var lastCampaign = self._max(sent.map(function(c) { return c.sent_at || c.created_at; }));
      var hasUsage = sids.length > 0 || contacts > 0 || camps.length > 0;
      var connected = !!lastSeen || hasUsage;
      var confirmed = d.auth ? !!(auth && auth.email_confirmed_at) : connected;

      var steps = {
        confirmed: confirmed,
        connected: connected,
        sid_submitted: sids.length > 0,
        sid_approved: sids.some(function(s) { return s.statut === 'approved'; }),
        contacts: contacts > 0,
        campaign_sent: sent.length > 0
      };

      var status;
      if (!connected) status = 'jamais';
      else if (steps.campaign_sent) {
        var recent = Math.min(window.AdminUI.daysSince(lastSeen), window.AdminUI.daysSince(lastCampaign));
        status = recent <= self.ACTIVE_DAYS ? 'actif' : 'inactif';
      } else if (hasUsage) status = 'demarre';
      else status = 'connecte';

      var done = self.STEPS.filter(function(s) { return steps[s.key]; }).length;
      var next = self.STEPS.filter(function(s) { return !steps[s.key]; })[0] || null;

      return {
        user: u,
        org: org ? orgById[org] || null : null,
        lastSeen: lastSeen,
        lastCampaign: lastCampaign,
        contacts: contacts,
        campaigns: camps.length,
        campaignsSent: sent.length,
        sids: sids.length,
        steps: steps,
        done: done,
        next: next,
        status: status
      };
    });
  },

  _max: function(dates) {
    var best = null;
    (dates || []).forEach(function(d) {
      if (d && (!best || new Date(d) > new Date(best))) best = d;
    });
    return best;
  },

  counts: function(rows) {
    var c = { total: rows.length, jamais: 0, connecte: 0, demarre: 0, actif: 0, inactif: 0, seen7: 0 };
    rows.forEach(function(r) {
      c[r.status]++;
      if (window.AdminUI.daysSince(r.lastSeen) <= 7) c.seen7++;
    });
    return c;
  },

  stepsHtml: function(r) {
    return '<div class="aact-steps">' + this.STEPS.map(function(s) {
      return '<span class="aact-dot ' + (r.steps[s.key] ? 'done' : '') + '" title="' + s.label + (r.steps[s.key] ? ' : oui' : ' : pas encore') + '"></span>';
    }).join('') + '<span class="aact-steps-count">' + r.done + '/' + this.STEPS.length + '</span></div>';
  },

  // Message de relance adapte a l'etape suivante
  nudgeText: function(r) {
    var prenom = r.user.prenom || '';
    var hello = 'Bonjour' + (prenom ? ' ' + prenom : '') + ',\n\n';
    var key = r.next ? r.next.key : null;
    var body = {
      confirmed: 'Votre compte Hook est créé mais votre adresse email n\'est pas encore confirmée. Cliquez sur le lien reçu par email pour l\'activer, puis connectez-vous.',
      connected: 'Votre compte Hook est pret. Connectez-vous pour découvrir la plateforme et préparer votre première campagne SMS.',
      sid_submitted: 'Pour envoyer vos premiers SMS, la première étape est de demander votre Sender ID (le nom qui s\'affiche chez vos clients). Cela prend 2 minutes depuis l\'onglet Sender ID.',
      sid_approved: 'Votre demande de Sender ID est en cours d\'examen. Nous revenons vers vous très vite ; pendant ce temps vous pouvez déjà importer vos contacts.',
      contacts: 'Votre Sender ID est actif. Importez maintenant vos contacts (fichier Excel/CSV ou ajout manuel) pour préparer votre première campagne.',
      campaign_sent: 'Tout est prêt : votre Sender ID est actif et vos contacts sont importés. Lancez votre première campagne SMS depuis l\'onglet Campagnes.'
    }[key] || 'Nous avons remarqué que vous n\'avez pas utilisé Hook récemment. Avez-vous besoin d\'aide pour votre prochaine campagne ?';
    return hello + body + '\n\nL\'équipe Hook\nsupport@hookplateform.com';
  },

  openNudge: function(r, onDone) {
    var self = this;
    var name = window.AdminUI.name(r.user);
    var text = this.nudgeText(r);
    window.Helpers.openModal(
      '<div class="modal-box">' +
      '<div class="modal-header-row"><div class="modal-title">Relancer ' + window.AdminUI.esc(name) + '</div>' +
      '<button class="modal-close-btn" onclick="window.Helpers.closeModal()"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M3 3l10 10M13 3L3 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></div>' +
      '<div class="modal-desc">Étape suivante : <strong>' + (r.next ? r.next.label : 'reprendre l\'activité') + '</strong></div>' +
      '<div class="campnew-field"><label>Message</label><textarea id="nudge-text" rows="7" style="width:100%">' + window.AdminUI.esc(text) + '</textarea></div>' +
      '<div class="modal-actions">' +
      '<button class="btn" id="nudge-mail">Envoyer par email</button>' +
      '<button class="btn btn-primary" id="nudge-notif">Notification Hook</button>' +
      '</div>' +
      (r.status === 'jamais' ? '<div style="font-size:11px;color:var(--admin-text-muted);margin-top:10px">Ce client ne s\'est jamais connecté : il ne verra la notification Hook qu\'à sa première connexion. L\'email est plus adapté.</div>' : '') +
      '</div>'
    );
    document.getElementById('nudge-mail').addEventListener('click', function() {
      var msg = document.getElementById('nudge-text').value;
      window.HookEvents.log('client_nudged', 'user', r.user.id, r.user.id, { canal: 'email', etape: r.next ? r.next.key : 'reactivation' });
      window.location.href = 'mailto:' + encodeURIComponent(r.user.email || '') +
        '?subject=' + encodeURIComponent('Hook : votre prochaine étape') + '&body=' + encodeURIComponent(msg);
      window.Helpers.closeModal();
    });
    document.getElementById('nudge-notif').addEventListener('click', function() {
      var msg = document.getElementById('nudge-text').value.trim();
      if (!msg) { window.Toast.error('Le message est vide'); return; }
      var link = { sid_submitted: '/sender-id', sid_approved: '/sender-id', contacts: '/contacts', campaign_sent: '/campagnes/new' }[r.next ? r.next.key : ''] || '/dashboard';
      window.HookEvents.notify(r.user.id, 'campagne', 'Votre prochaine étape sur Hook', msg, link, { source: 'relance_admin' });
      window.HookEvents.log('client_nudged', 'user', r.user.id, r.user.id, { canal: 'notification', etape: r.next ? r.next.key : 'reactivation' });
      window.Helpers.closeModal();
      window.Toast.success('Notification envoyée à ' + name);
      if (onDone) onDone();
    });
  }
};

window.PageAdminActivity = {
  rows: [],
  hasAuth: false,
  filter: 'tous',
  search: '',
  WATCH_KEY: 'hook_admin_watchlist',

  render: function() {
    var self = this;
    window.Helpers.renderPage(window.AdminUI.loading());
    window.AdminActivity.load(function(err, rows, hasAuth) {
      if (err) {
        window.Helpers.renderPage('<div class="admin-page-wrapper">' + window.AdminUI.header('Administration', 'Suivi d\'activité', '') +
          window.AdminUI.empty('Impossible de charger les clients : ' + window.AdminUI.esc(err.message || 'erreur inconnue')) + '</div>');
        return;
      }
      self.rows = rows;
      self.hasAuth = hasAuth;
      self._render();
    });
  },

  _watchlist: function() {
    try { return JSON.parse(localStorage.getItem(this.WATCH_KEY) || '[]') || []; } catch (e) { return []; }
  },

  _saveWatchlist: function(list) {
    try { localStorage.setItem(this.WATCH_KEY, JSON.stringify(list)); } catch (e) {}
  },

  _match: function(entry) {
    var q = entry.toLowerCase().trim();
    if (!q) return null;
    var digits = q.replace(/[^0-9]/g, '');
    return this.rows.filter(function(r) {
      var u = r.user;
      if ((u.email || '').toLowerCase() === q) return true;
      if (q.indexOf('@') !== -1) return false;
      if (digits.length >= 6 && (u.telephone || '').replace(/[^0-9]/g, '').indexOf(digits) !== -1) return true;
      var hay = (window.AdminUI.name(u) + ' ' + (u.entreprise || '') + ' ' + (r.org ? r.org.nom || '' : '')).toLowerCase();
      return hay.indexOf(q) !== -1;
    })[0] || null;
  },

  _filtered: function() {
    var f = this.filter;
    var s = this.search.toLowerCase();
    return this.rows.filter(function(r) {
      if (f !== 'tous' && r.status !== f) return false;
      if (!s) return true;
      var u = r.user;
      return (window.AdminUI.name(u) + ' ' + (u.email || '') + ' ' + (u.entreprise || '') + ' ' + (r.org ? r.org.nom || '' : '')).toLowerCase().indexOf(s) !== -1;
    });
  },

  _render: function() {
    var UI = window.AdminUI;
    var A = window.AdminActivity;
    var c = A.counts(this.rows);
    var pct = function(n) { return c.total ? Math.round(n / c.total * 100) + '% des inscrits' : ''; };

    var html = '<div class="admin-page-wrapper">' +
      UI.header('Administration', 'Suivi d\'activité',
        'Qui s\'est connecté et qui a commencé à utiliser Hook',
        '<button class="admin-btn" id="aact-export">Exporter CSV</button><button class="admin-btn" id="aact-refresh">Actualiser</button>') +

      (this.hasAuth ? '' :
        '<div class="admin-notice">Les dates de connexion s\'enregistrent à partir de cette version. Pour récupérer l\'historique des connexions déjà faites, exécutez la migration <code>supabase/migrations/20261112090000_admin_users_activity.sql</code> dans Supabase.</div>') +

      '<div class="admin-kpi-grid">' +
      UI.kpi('Clients inscrits', UI.num(c.total), c.seen7 + ' connectés ces 7 derniers jours', 'up') +
      UI.kpi('Jamais connectés', UI.num(c.jamais), pct(c.jamais), c.jamais ? 'down' : '') +
      UI.kpi('Connectés sans usage', UI.num(c.connecte), pct(c.connecte), c.connecte ? 'warn' : '') +
      UI.kpi('Ont démarré', UI.num(c.demarre), 'Sender ID, contacts ou brouillon', '') +
      UI.kpi('Actifs (30j)', UI.num(c.actif), pct(c.actif), 'up') +
      UI.kpi('Inactifs', UI.num(c.inactif), 'Ont déjà envoyé, plus rien depuis 30j', c.inactif ? 'warn' : '') +
      '</div>' +

      '<div class="admin-grid-2">' +
      '<div class="admin-card">' +
      '<div class="admin-card-header"><div class="admin-card-title">Parcours d\'activation</div>' +
      '<span style="font-size:11px;color:var(--admin-text-muted)">sur ' + UI.num(c.total) + ' inscrits</span></div>' +
      this._funnel() +
      '</div>' +
      '<div class="admin-card">' +
      '<div class="admin-card-header"><div class="admin-card-title">Ma liste de suivi</div>' +
      '<span style="font-size:11px;color:var(--admin-text-muted)">Emails, noms ou entreprises</span></div>' +
      '<div class="aact-watch-form">' +
      '<textarea id="aact-watch-input" rows="2" placeholder="ex : marie@entreprise.cg, Brasserie du Congo, 06 123 45 67"></textarea>' +
      '<button class="admin-btn" id="aact-watch-add">Suivre</button>' +
      '</div>' +
      '<div id="aact-watch-list">' + this._watchHtml() + '</div>' +
      '</div>' +
      '</div>' +

      '<div class="admin-card admin-mt">' +
      '<div class="admin-card-header"><div class="admin-card-title">Tous les clients</div></div>' +
      UI.tabs([
        { key: 'tous', label: 'Tous', count: c.total },
        { key: 'jamais', label: 'Jamais connectés', count: c.jamais },
        { key: 'connecte', label: 'Sans usage', count: c.connecte },
        { key: 'demarre', label: 'Ont démarré', count: c.demarre },
        { key: 'actif', label: 'Actifs', count: c.actif },
        { key: 'inactif', label: 'Inactifs', count: c.inactif }
      ], this.filter, 'data-afilter') +
      '<div class="acc-toolbar"><input class="acc-search" id="aact-search" type="text" placeholder="Rechercher un client, un email, une entreprise..." value="' + UI.esc(this.search) + '"></div>' +
      '<div id="aact-table">' + this._tableHtml(this._filtered()) + '</div>' +
      '</div>' +
      '</div>';

    window.Helpers.renderPage(html);
    this._bind();
  },

  _funnel: function() {
    var rows = this.rows;
    var total = rows.length || 1;
    var steps = [{ key: 'inscrit', label: 'Inscription' }].concat(window.AdminActivity.STEPS);
    return '<div class="aact-funnel">' + steps.map(function(s) {
      var n = s.key === 'inscrit' ? rows.length : rows.filter(function(r) { return r.steps[s.key]; }).length;
      var p = Math.round(n / total * 100);
      return '<div class="aact-funnel-row">' +
        '<div class="aact-funnel-label">' + s.label + '</div>' +
        '<div class="admin-bar-track"><div class="admin-bar-fill" style="width:' + (n ? Math.max(2, p) : 0) + '%"></div></div>' +
        '<div class="aact-funnel-val"><strong>' + n + '</strong> <span>' + (rows.length ? p : 0) + '%</span></div>' +
        '</div>';
    }).join('') + '</div>';
  },

  _watchHtml: function() {
    var self = this;
    var UI = window.AdminUI;
    var list = this._watchlist();
    if (!list.length) return UI.empty('Ajoutez les personnes que vous voulez surveiller : vous verrez si elles se sont connectées et où elles en sont.');
    return '<table class="admin-table"><tbody>' + list.map(function(entry, i) {
      var r = self._match(entry);
      var remove = '<button class="acc-icon-btn aact-watch-del" data-i="' + i + '" title="Retirer de la liste"><svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M3 3l9 9M12 3L3 12" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg></button>';
      if (!r) {
        return '<tr><td><div class="admin-identity-name">' + UI.esc(entry) + '</div><div class="admin-identity-sub">Aucun compte trouvé</div></td>' +
          '<td><span class="admin-tag admin-tag-neutral">Pas inscrit</span></td><td></td><td style="width:30px">' + remove + '</td></tr>';
      }
      return '<tr class="aact-row" data-uid="' + r.user.id + '">' +
        '<td>' + UI.identity(r.user) + '</td>' +
        '<td>' + UI.statusTag(window.AdminActivity.STATUS, r.status) + '<div class="admin-identity-sub" style="margin-top:4px">' + (r.lastSeen ? 'Vu ' + UI.ago(r.lastSeen).toLowerCase() : (r.status === 'jamais' ? 'Inscrit ' + UI.ago(r.user.created_at).toLowerCase() : 'Date de connexion inconnue')) + '</div></td>' +
        '<td>' + window.AdminActivity.stepsHtml(r) + '</td>' +
        '<td style="width:30px">' + remove + '</td>' +
        '</tr>';
    }).join('') + '</tbody></table>';
  },

  _tableHtml: function(rows) {
    var UI = window.AdminUI;
    if (!rows.length) return UI.empty('Aucun client dans cette catégorie.');
    return '<div class="admin-table-scroll"><table class="admin-table"><thead><tr>' +
      '<th>Client</th><th>Statut</th><th>Dernière connexion</th><th>Progression</th><th>Usage</th><th>Inscrit</th><th></th>' +
      '</tr></thead><tbody>' + rows.map(function(r) {
        var u = r.user;
        var sub = (r.org && r.org.nom) || u.entreprise || u.email;
        return '<tr class="aact-row" data-uid="' + u.id + '">' +
          '<td>' + UI.identity(u, sub) + (u.is_blocked ? ' <span class="admin-tag admin-tag-danger" style="margin-top:4px">Bloqué</span>' : '') + '</td>' +
          '<td>' + UI.statusTag(window.AdminActivity.STATUS, r.status) + '</td>' +
          '<td style="white-space:nowrap">' + (r.lastSeen ? UI.ago(r.lastSeen) : '<span style="color:var(--admin-text-muted)">' + (r.status === 'jamais' ? 'Jamais' : 'Inconnue') + '</span>') + '</td>' +
          '<td>' + window.AdminActivity.stepsHtml(r) + '<div class="admin-identity-sub">' + (r.next ? 'Prochaine : ' + r.next.label : 'Parcours complet') + '</div></td>' +
          '<td style="white-space:nowrap;font-size:11px;color:var(--admin-text-secondary)">' + UI.num(r.contacts) + ' contact' + (r.contacts > 1 ? 's' : '') + '<br>' + r.campaignsSent + ' campagne' + (r.campaignsSent > 1 ? 's' : '') + ' envoyée' + (r.campaignsSent > 1 ? 's' : '') + '</td>' +
          '<td style="white-space:nowrap;color:var(--admin-text-secondary)">' + UI.date(u.created_at) + '</td>' +
          '<td style="white-space:nowrap;text-align:right">' +
          (r.status !== 'actif' ? '<button class="admin-btn-sm aact-nudge" data-uid="' + u.id + '">Relancer</button> ' : '') +
          '</td>' +
          '</tr>';
      }).join('') + '</tbody></table></div>';
  },

  _find: function(uid) {
    return this.rows.filter(function(r) { return r.user.id === uid; })[0];
  },

  _openClient: function(uid) {
    var clients = this.rows.map(function(r) {
      var u = r.user;
      return { id: u.id, prenom: u.prenom || '', nom: u.nom || '', email: u.email || '', role: 'client', organization_id: u.organization_id, created_at: u.created_at, is_blocked: !!u.is_blocked };
    });
    window.PageAdminClientDetail.openClient(uid, clients);
  },

  _bindRows: function(root) {
    var self = this;
    root.querySelectorAll('.aact-row').forEach(function(tr) {
      tr.addEventListener('click', function(e) {
        if (e.target.closest('button')) return;
        self._openClient(tr.getAttribute('data-uid'));
      });
    });
    root.querySelectorAll('.aact-nudge').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var r = self._find(btn.getAttribute('data-uid'));
        if (r) window.AdminActivity.openNudge(r);
      });
    });
    root.querySelectorAll('.aact-watch-del').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var list = self._watchlist();
        list.splice(parseInt(btn.getAttribute('data-i'), 10), 1);
        self._saveWatchlist(list);
        self._refreshWatch();
      });
    });
  },

  _refreshWatch: function() {
    var el = document.getElementById('aact-watch-list');
    if (!el) return;
    el.innerHTML = this._watchHtml();
    this._bindRows(el);
  },

  _bind: function() {
    var self = this;
    document.getElementById('aact-refresh').addEventListener('click', function() { self.render(); });
    document.getElementById('aact-export').addEventListener('click', function() { self._export(); });

    document.querySelectorAll('[data-afilter]').forEach(function(tab) {
      tab.addEventListener('click', function() {
        self.filter = tab.getAttribute('data-afilter');
        document.querySelectorAll('[data-afilter]').forEach(function(t) { t.classList.toggle('active', t === tab); });
        self._refreshTable();
      });
    });

    var search = document.getElementById('aact-search');
    search.addEventListener('input', function() {
      self.search = search.value;
      self._refreshTable();
    });

    var add = function() {
      var input = document.getElementById('aact-watch-input');
      var entries = input.value.split(/[\n,;]+/).map(function(x) { return x.trim(); }).filter(Boolean);
      if (!entries.length) return;
      var list = self._watchlist();
      entries.forEach(function(e) {
        if (list.map(function(x) { return x.toLowerCase(); }).indexOf(e.toLowerCase()) === -1) list.push(e);
      });
      self._saveWatchlist(list);
      input.value = '';
      self._refreshWatch();
    };
    document.getElementById('aact-watch-add').addEventListener('click', add);
    document.getElementById('aact-watch-input').addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); }
    });

    this._bindRows(document.getElementById('main-content'));
  },

  _refreshTable: function() {
    var el = document.getElementById('aact-table');
    if (!el) return;
    el.innerHTML = this._tableHtml(this._filtered());
    this._bindRows(el);
  },

  _export: function() {
    var A = window.AdminActivity;
    var head = ['Prénom', 'Nom', 'Email', 'Téléphone', 'Entreprise', 'Statut', 'Dernière connexion', 'Inscrit le', 'Contacts', 'Campagnes envoyées', 'Prochaine étape'];
    var lines = [head].concat(this._filtered().map(function(r) {
      var u = r.user;
      return [u.prenom, u.nom, u.email, u.telephone, (r.org && r.org.nom) || u.entreprise,
        A.STATUS[r.status].label, r.lastSeen ? new Date(r.lastSeen).toISOString() : '', u.created_at ? u.created_at.slice(0, 10) : '',
        r.contacts, r.campaignsSent, r.next ? r.next.label : 'Parcours complet'];
    })).map(function(row) {
      return row.map(function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
    });
    var blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hook-suivi-activite-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
};
