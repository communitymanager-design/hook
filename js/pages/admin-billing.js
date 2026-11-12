// Facturation : transactions de crédits et soldes SMS des clients
window.PageAdminBilling = {
  tab: 'transactions',
  search: '',
  data: null,

  PAID: ['completed', 'complete', 'success', 'succeeded', 'paid', 'paye', 'payé', 'valide', 'validé', 'confirmed', 'approved'],
  PENDING: ['pending', 'en_attente', 'processing', 'initiated'],

  TYPES: { purchase: 'Achat', usage: 'Consommation', refund: 'Remboursement', bonus: 'Bonus' },
  METHODS: { mtn_momo: 'MTN MoMo', airtel_money: 'Airtel Money', virement: 'Virement', autre: 'Autre' },

  // Un achat payé = un revenu
  isRevenue: function(t) {
    var s = (t.statut || '').toLowerCase();
    return t.type === 'purchase' && (!s || this.PAID.indexOf(s) !== -1) && (t.montant_fcfa || 0) > 0;
  },

  render: function() {
    this.search = '';
    window.Helpers.renderPage(window.AdminUI.loading());
    this._load();
  },

  _load: function() {
    var self = this;
    Promise.all([
      window.DB.from('credit_transactions').select('*').order('created_at', { ascending: false }).limit(1000),
      window.DB.from('credit_accounts').select('*'),
      window.DB.from('users').select('id,prenom,nom,email,organization_id').eq('role', 'client'),
      window.DB.from('organizations').select('id,nom')
    ]).then(function(r) {
      var orgs = {};
      (r[3].data || []).forEach(function(o) { orgs[o.id] = o; });
      var owners = {};
      (r[2].data || []).forEach(function(u) { if (u.organization_id && !owners[u.organization_id]) owners[u.organization_id] = u; });
      self.data = {
        tx: r[0].data || [],
        txError: r[0].error,
        accounts: r[1].data || [],
        orgs: orgs,
        owners: owners
      };
      self._render();
    }).catch(function() {
      self.data = { tx: [], accounts: [], orgs: {}, owners: {} };
      self._render();
    });
  },

  _state: function(t) {
    var s = (t.statut || '').toLowerCase();
    if (this.PAID.indexOf(s) !== -1) return 'paid';
    if (this.PENDING.indexOf(s) !== -1) return 'pending';
    if (!s) return 'paid';
    return 'failed';
  },

  _client: function(orgId) {
    var o = this.data.orgs[orgId], u = this.data.owners[orgId];
    return {
      title: (o && o.nom) || (u ? window.AdminUI.name(u) : 'Organisation inconnue'),
      sub: u ? u.email : ''
    };
  },

  _render: function() {
    var UI = window.AdminUI;
    var self = this;
    var d = this.data;
    var s = this.search.toLowerCase();

    var monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    var paid = d.tx.filter(function(t) { return self.isRevenue(t); });
    var revMonth = paid.filter(function(t) { return new Date(t.created_at) >= monthStart; })
      .reduce(function(a, t) { return a + (t.montant_fcfa || 0); }, 0);
    var revTotal = paid.reduce(function(a, t) { return a + (t.montant_fcfa || 0); }, 0);
    var pending = d.tx.filter(function(t) { return t.type === 'purchase' && self._state(t) === 'pending'; });
    var smsLeft = d.accounts.reduce(function(a, c) { return a + (c.sms_remaining || 0); }, 0);

    var stateMap = {
      paid: { label: 'Payé', cls: 'admin-tag-success' },
      pending: { label: 'En attente', cls: 'admin-tag-warn' },
      failed: { label: 'Échoué', cls: 'admin-tag-danger' }
    };

    var body;
    if (this.tab === 'transactions') {
      var list = d.tx.filter(function(t) {
        if (!s) return true;
        var c = self._client(t.organization_id);
        return (c.title + ' ' + c.sub + ' ' + (t.type || '') + ' ' + (t.description || '')).toLowerCase().indexOf(s) !== -1;
      });
      body = d.txError ? UI.empty('Lecture des transactions impossible : ' + UI.esc(d.txError.message)) :
        !list.length ? UI.empty('Aucune transaction pour le moment.') :
        '<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Montant</th><th>SMS</th><th>Statut</th></tr></thead><tbody>' +
        list.map(function(t) {
          var c = self._client(t.organization_id);
          var st = self._state(t);
          return '<tr>' +
            '<td style="white-space:nowrap;color:var(--admin-text-secondary)">' + UI.dateTime(t.created_at) + '</td>' +
            '<td><strong>' + UI.esc(c.title) + '</strong><div class="admin-identity-sub">' + UI.esc(c.sub) + '</div></td>' +
            '<td>' + UI.esc(self.TYPES[t.type] || t.type || '-') + (t.payment_method ? ' · ' + UI.esc(self.METHODS[t.payment_method] || t.payment_method) : '') +
            ((t.description || t.payment_reference) ? '<div class="admin-identity-sub">' + UI.esc(t.description || ('Réf. ' + t.payment_reference)) + '</div>' : '') + '</td>' +
            '<td style="white-space:nowrap;font-weight:600">' + (t.montant_fcfa ? UI.fcfa(t.montant_fcfa) : '-') + '</td>' +
            '<td style="white-space:nowrap">' + (t.sms_count ? (t.sms_count > 0 ? '+' : '') + UI.num(t.sms_count) : '-') + '</td>' +
            '<td><span class="admin-tag ' + stateMap[st].cls + '" title="' + UI.esc(t.statut || '') + '">' + stateMap[st].label + '</span></td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    } else {
      var accounts = d.accounts.slice().sort(function(a, b) { return (b.sms_remaining || 0) - (a.sms_remaining || 0); })
        .filter(function(a) {
          if (!s) return true;
          var c = self._client(a.organization_id);
          return (c.title + ' ' + c.sub).toLowerCase().indexOf(s) !== -1;
        });
      body = !accounts.length ? UI.empty('Aucun compte de crédits.') :
        '<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Client</th><th>SMS restants</th><th>Solde</th><th>Mis à jour</th><th></th></tr></thead><tbody>' +
        accounts.map(function(a) {
          var c = self._client(a.organization_id);
          var low = (a.sms_remaining || 0) < 50;
          return '<tr>' +
            '<td><strong>' + UI.esc(c.title) + '</strong><div class="admin-identity-sub">' + UI.esc(c.sub) + '</div></td>' +
            '<td style="font-weight:700">' + UI.num(a.sms_remaining) + (low ? ' <span class="admin-tag admin-tag-warn">Faible</span>' : '') + '</td>' +
            '<td>' + UI.fcfa(a.balance_fcfa) + '</td>' +
            '<td style="color:var(--admin-text-secondary)">' + UI.ago(a.updated_at) + '</td>' +
            '<td style="text-align:right">' + (UI.canManage() ? '<button class="admin-btn-sm abil-adjust" data-org="' + a.organization_id + '">Ajuster</button>' : '') + '</td>' +
            '</tr>';
        }).join('') + '</tbody></table></div>';
    }

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
      UI.header('Technique', 'Facturation', 'Achats de crédits SMS et soldes clients',
        '<button class="admin-btn" id="abil-export">Exporter CSV</button><button class="admin-btn" id="abil-refresh">Actualiser</button>') +
      '<div class="admin-kpi-grid">' +
      UI.kpi('Revenus du mois', UI.fcfa(revMonth), monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }), revMonth ? 'up' : '') +
      UI.kpi('Revenus cumulés', UI.fcfa(revTotal), paid.length + ' paiement' + (paid.length > 1 ? 's' : ''), '') +
      UI.kpi('Paiements en attente', UI.num(pending.length), pending.length ? 'À vérifier' : '', pending.length ? 'warn' : '') +
      '</div>' +
      '<div class="admin-card">' +
      UI.tabs([
        { key: 'transactions', label: 'Transactions', count: d.tx.length },
        { key: 'soldes', label: 'Soldes clients', count: d.accounts.length }
      ], this.tab, 'data-btab') +
      '<div class="acc-toolbar"><input class="acc-search" id="abil-search" type="text" placeholder="Rechercher un client..." value="' + UI.esc(this.search) + '">' +
      '<div style="font-size:12px;color:var(--admin-text-secondary);align-self:center">' + UI.num(smsLeft) + ' SMS en circulation</div></div>' +
      body +
      '</div>' +
      '</div>'
    );

    document.getElementById('abil-refresh').addEventListener('click', function() { self.render(); });
    document.getElementById('abil-export').addEventListener('click', function() { self._export(); });
    document.querySelectorAll('[data-btab]').forEach(function(t) {
      t.addEventListener('click', function() { self.tab = t.getAttribute('data-btab'); self._render(); });
    });
    var search = document.getElementById('abil-search');
    search.addEventListener('input', function() {
      self.search = search.value;
      self._render();
      var el = document.getElementById('abil-search');
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    });
    document.querySelectorAll('.abil-adjust').forEach(function(b) {
      b.addEventListener('click', function() { self._adjust(b.getAttribute('data-org')); });
    });
  },

  _adjust: function(orgId) {
    var self = this;
    var UI = window.AdminUI;
    var acc = this.data.accounts.filter(function(a) { return a.organization_id === orgId; })[0];
    if (!acc) return;
    var c = this._client(orgId);
    window.Helpers.openModal(
      '<div class="modal-box">' +
      '<div class="modal-title">Ajuster les crédits</div>' +
      '<div class="modal-desc"><strong>' + UI.esc(c.title) + '</strong> dispose de ' + UI.num(acc.sms_remaining) + ' SMS.</div>' +
      '<div class="campnew-field"><label>SMS à ajouter (négatif pour retirer)</label><input type="number" id="abil-delta" value="0" step="1"></div>' +
      '<div class="campnew-field"><label>Motif (visible dans le journal)</label><input type="text" id="abil-reason" placeholder="ex : paiement Mobile Money reçu, geste commercial..."></div>' +
      '<div class="modal-actions">' +
      '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
      '<button class="btn btn-primary" id="abil-save">Appliquer</button>' +
      '</div>' +
      '</div>'
    );
    document.getElementById('abil-save').addEventListener('click', function() {
      var delta = parseInt(document.getElementById('abil-delta').value, 10) || 0;
      var reason = document.getElementById('abil-reason').value.trim();
      if (!delta) { window.Toast.error('Indiquez un nombre de SMS'); return; }
      if (!reason) { window.Toast.error('Indiquez un motif'); return; }
      var before = acc.sms_remaining || 0;
      var after = Math.max(0, before + delta);
      var btn = this;
      btn.disabled = true;
      window.DB.from('credit_accounts').update({ sms_remaining: after, updated_at: new Date().toISOString() }).eq('organization_id', orgId).then(function(res) {
        if (res.error) { btn.disabled = false; window.Toast.error(res.error.message); return; }
        var owner = self.data.owners[orgId];
        window.HookEvents.log('credits_adjusted', 'organization', orgId, owner ? owner.id : null, { avant: before, apres: after, motif: reason });
        if (owner && delta > 0) {
          window.HookEvents.notify(owner.id, 'credit', 'Crédits ajoutés', UI.num(delta) + ' SMS ont été ajoutés à votre compte. Nouveau solde : ' + UI.num(after) + ' SMS.', '/settings', { delta: delta });
        }
        window.Helpers.closeModal();
        window.Toast.success('Solde mis à jour : ' + UI.num(after) + ' SMS');
        self._load();
      });
    });
  },

  _export: function() {
    var self = this;
    var rows = [['Date', 'Client', 'Email', 'Type', 'Moyen de paiement', 'Référence', 'Description', 'Montant FCFA', 'SMS', 'Statut']].concat(this.data.tx.map(function(t) {
      var c = self._client(t.organization_id);
      return [t.created_at, c.title, c.sub, self.TYPES[t.type] || t.type, self.METHODS[t.payment_method] || t.payment_method, t.payment_reference, t.description, t.montant_fcfa, t.sms_count, t.statut];
    })).map(function(r) {
      return r.map(function(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(';');
    });
    var blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'hook-transactions-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    setTimeout(function() { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
};
