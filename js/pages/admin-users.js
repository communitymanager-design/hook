// Utilisateurs : équipe d'administration (admins et super admins)
window.PageAdminUsers = {
  members: [],

  ROLES: {
    super_admin: { label: 'Super Admin', cls: 'admin-tag-blue' },
    admin: { label: 'Admin', cls: 'admin-tag-warn' }
  },

  render: function() {
    var self = this;
    window.Helpers.renderPage(window.AdminUI.loading());
    window.DB.from('users').select('id,prenom,nom,email,role,created_at,last_login_at').in('role', ['admin', 'super_admin'])
      .order('created_at', { ascending: true })
      .then(function(res) {
        self.members = res.data || [];
        self.error = res.error;
        self._render();
      }, function(err) {
        self.members = [];
        self.error = err;
        self._render();
      });
  },

  _render: function() {
    var UI = window.AdminUI;
    var self = this;
    var me = window.HookAuth.user ? window.HookAuth.user.id : null;
    var manage = UI.canManage();
    var supers = this.members.filter(function(m) { return m.role === 'super_admin'; }).length;

    var rows = this.members.map(function(m) {
      var isMe = m.id === me;
      return '<tr>' +
        '<td>' + UI.identity(m) + '</td>' +
        '<td>' + UI.statusTag(self.ROLES, m.role) + (isMe ? ' <span class="admin-tag admin-tag-info">Vous</span>' : '') + '</td>' +
        '<td style="color:var(--admin-text-secondary)">' + (m.last_login_at ? UI.ago(m.last_login_at) : '-') + '</td>' +
        '<td style="color:var(--admin-text-secondary)">' + UI.date(m.created_at) + '</td>' +
        '<td style="white-space:nowrap;text-align:right">' +
        (manage && !isMe ?
          '<select class="admin-select-sm ausr-role" data-id="' + m.id + '">' +
          '<option value="admin"' + (m.role === 'admin' ? ' selected' : '') + '>Admin</option>' +
          '<option value="super_admin"' + (m.role === 'super_admin' ? ' selected' : '') + '>Super Admin</option>' +
          '</select> <button class="admin-btn-sm ausr-remove" data-id="' + m.id + '">Retirer</button>' : '') +
        '</td>' +
        '</tr>';
    }).join('');

    window.Helpers.renderPage(
      '<div class="admin-page-wrapper">' +
      UI.header('Services', 'Utilisateurs et rôles', 'Les personnes qui ont accès à ce back-office',
        manage ? '<button class="admin-btn" id="ausr-add" style="background:#0B3828;color:#fff;border-color:#0B3828">Ajouter un membre</button>' : '') +
      '<div class="admin-kpi-grid">' +
      UI.kpi('Membres de l\'équipe', UI.num(this.members.length), '', '') +
      UI.kpi('Super Admins', UI.num(supers), 'Tous les droits', '') +
      UI.kpi('Admins', UI.num(this.members.length - supers), 'Validation, support, suivi', '') +
      '</div>' +
      '<div class="admin-card">' +
      '<div class="admin-card-header"><div class="admin-card-title">Équipe</div></div>' +
      (this.error ? UI.empty('Lecture impossible : ' + UI.esc(this.error.message)) :
        !rows ? UI.empty('Aucun membre.') :
        '<div class="admin-table-scroll"><table class="admin-table"><thead><tr><th>Membre</th><th>Rôle</th><th>Dernière connexion</th><th>Depuis</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>') +
      '</div>' +
      '<div class="admin-card admin-mt">' +
      '<div class="admin-card-title" style="margin-bottom:10px">Ce que chaque rôle peut faire</div>' +
      '<div class="ausr-roles">' +
      '<div><span class="admin-tag admin-tag-blue">Super Admin</span><p>Accès complet : gère l\'équipe, ajuste les crédits, envoie les notifications système, supprime des comptes.</p></div>' +
      '<div><span class="admin-tag admin-tag-warn">Admin</span><p>Accède au back-office : valide les Sender ID, suit l\'activité des clients, traite le support et consulte les logs.</p></div>' +
      '</div>' +
      (manage ? '' : '<div style="font-size:12px;color:var(--admin-text-muted);margin-top:10px">Seul un Super Admin peut modifier l\'équipe.</div>') +
      '</div>' +
      '</div>'
    );

    var add = document.getElementById('ausr-add');
    if (add) add.addEventListener('click', function() { self._openAdd(); });

    document.querySelectorAll('.ausr-role').forEach(function(sel) {
      sel.addEventListener('change', function() {
        var m = self._get(sel.getAttribute('data-id'));
        if (!m) return;
        var newRole = sel.value;
        window.DB.from('users').update({ role: newRole }).eq('id', m.id).then(function(res) {
          if (res.error) { window.Toast.error(res.error.message); sel.value = m.role; return; }
          window.HookEvents.clientRoleChanged(m, m.role, newRole);
          window.Toast.success('Rôle mis à jour');
          self.render();
        });
      });
    });

    document.querySelectorAll('.ausr-remove').forEach(function(b) {
      b.addEventListener('click', function() {
        var m = self._get(b.getAttribute('data-id'));
        if (!m) return;
        UI.confirm({
          title: 'Retirer de l\'équipe',
          message: '<strong>' + UI.esc(UI.name(m)) + '</strong> perdra l\'accès au back-office et redeviendra un compte client.',
          ok: 'Retirer',
          danger: true
        }, function(btn) {
          btn.disabled = true;
          window.DB.from('users').update({ role: 'client' }).eq('id', m.id).then(function(res) {
            if (res.error) { btn.disabled = false; window.Toast.error(res.error.message); return; }
            window.HookEvents.log('team_member_removed', 'user', m.id, m.id, { email: m.email, old_role: m.role, new_role: 'client' });
            window.Helpers.closeModal();
            window.Toast.success('Membre retiré');
            self.render();
          });
        });
      });
    });
  },

  _get: function(id) {
    return this.members.filter(function(m) { return m.id === id; })[0];
  },

  _openAdd: function() {
    var self = this;
    var UI = window.AdminUI;
    window.Helpers.openModal(
      '<div class="modal-box">' +
      '<div class="modal-title">Ajouter un membre</div>' +
      '<div class="modal-desc">La personne doit déjà avoir un compte Hook. Indiquez l\'email utilisé pour s\'inscrire.</div>' +
      '<div class="campnew-field"><label>Email</label><input type="email" id="ausr-email" placeholder="prenom@lopango.io"></div>' +
      '<div class="campnew-field"><label>Rôle</label><select id="ausr-newrole"><option value="admin">Admin</option><option value="super_admin">Super Admin</option></select></div>' +
      '<div class="modal-actions">' +
      '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
      '<button class="btn btn-primary" id="ausr-save">Ajouter</button>' +
      '</div>' +
      '</div>'
    );
    document.getElementById('ausr-save').addEventListener('click', function() {
      var btn = this;
      var email = document.getElementById('ausr-email').value.trim().toLowerCase();
      var role = document.getElementById('ausr-newrole').value;
      if (!email) { window.Toast.error('Indiquez un email'); return; }
      btn.disabled = true;
      window.DB.from('users').select('id,prenom,nom,email,role').ilike('email', email).limit(1).then(function(res) {
        var u = res.data && res.data[0];
        if (!u) { btn.disabled = false; window.Toast.error('Aucun compte Hook avec cet email'); return; }
        if (u.role === 'admin' || u.role === 'super_admin') { btn.disabled = false; window.Toast.info(UI.name(u) + ' fait déjà partie de l\'équipe'); return; }
        window.DB.from('users').update({ role: role }).eq('id', u.id).then(function(r2) {
          if (r2.error) { btn.disabled = false; window.Toast.error(r2.error.message); return; }
          window.HookEvents.log('team_member_added', 'user', u.id, u.id, { email: u.email, old_role: u.role || 'client', new_role: role });
          window.HookEvents.notify(u.id, 'alerte', 'Accès administration', 'Vous avez maintenant accès au back-office Hook en tant que ' + self.ROLES[role].label + '.', null, { role: role });
          window.Helpers.closeModal();
          window.Toast.success(UI.name(u) + ' a rejoint l\'équipe');
          self.render();
        });
      });
    });
  }
};
