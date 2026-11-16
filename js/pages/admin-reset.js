// Nouveau mot de passe — back-office (back.hookplateform.com)
// Atteinte depuis le lien « Mot de passe oublié ? » reçu par email.
// Après enregistrement : l'administrateur reste connecté et arrive sur le tableau de bord admin.

(function () {
  // Lien expiré ou déjà utilisé : Supabase renvoie #error=...&error_code=otp_expired
  // On affiche un message clair sur la page de connexion, en mode « renvoyer un lien ».
  var h = window.location.hash || '';
  var isBack = window.location.hostname.indexOf('back.') === 0 || window.HOOK_BACKOFFICE === true;
  if (isBack && /error_code=|error=access_denied/.test(h)) {
    window.HOOK_RESET_LINK_ERROR = true;
    if (window.PageAdminLogin) {
      window.PageAdminLogin.mode = 'reset';
      window.PageAdminLogin._pendingError = 'Ce lien a expiré ou a déjà été utilisé. Saisissez votre email pour en recevoir un nouveau.';
    }
    window.history.replaceState({}, '', window.location.pathname + '#/auth');
  }
})();

window.PageAdminReset = {
  _shell: function (inner) {
    return '<div class="alog-page">' +
      '<div class="alog-card">' +
        '<div class="alog-brand">' +
          '<img src="https://ik.imagekit.io/dkeqnflsg/HOOK%20ICON%20COLOR%20(1).png?updatedAt=1781142267098" alt="Hook" class="alog-icon" draggable="false">' +
          '<div><div class="alog-name">Hook</div><div class="alog-badge">Back-office</div></div>' +
        '</div>' +
        '<div id="alog-body">' + inner + '</div>' +
      '</div>' +
    '</div>';
  },

  _hideChrome: function () {
    var nav = document.getElementById('navbar-container');
    var adm = document.getElementById('admin-navbar-container');
    var main = document.getElementById('main-content');
    if (nav) { nav.innerHTML = ''; nav.style.display = 'none'; }
    if (adm) adm.style.display = 'none';
    if (window.AdminNavbar) window.AdminNavbar._rendered = false;
    if (main) main.style.marginLeft = '0';
  },

  render: function () {
    var self = this;
    this._hideChrome();
    window.Helpers.renderPage(this._shell('<div class="alog-sub">Vérification du lien…</div>'));
    // Le lien de l'email ouvre une session temporaire : sans elle, le lien est invalide ou expiré.
    window.DB.auth.getSession().then(function (res) {
      var session = res && res.data && res.data.session;
      if (!session) { self._expired(); return; }
      self._form(session.user && session.user.email);
    });
  },

  _expired: function () {
    document.getElementById('alog-body').innerHTML =
      '<div class="alog-title">Lien expiré</div>' +
      '<div class="alog-sub">Ce lien de réinitialisation n\'est plus valide : il a expiré ou a déjà été utilisé. Demandez-en un nouveau.</div>' +
      '<button class="alog-btn" id="alog-again">Recevoir un nouveau lien</button>' +
      '<div class="alog-link" id="alog-back">Retour à la connexion</div>';
    document.getElementById('alog-again').addEventListener('click', function () {
      if (window.PageAdminLogin) window.PageAdminLogin.mode = 'reset';
      window.Router.navigate('/auth');
    });
    document.getElementById('alog-back').addEventListener('click', function () {
      if (window.PageAdminLogin) window.PageAdminLogin.mode = 'login';
      window.Router.navigate('/auth');
    });
  },

  _form: function (email) {
    var self = this;
    document.getElementById('alog-body').innerHTML =
      '<div class="alog-title">Nouveau mot de passe</div>' +
      '<div class="alog-sub">' + (email ? 'Compte <strong>' + window.Helpers.escapeHtml(email) + '</strong>. ' : '') +
        'Choisissez un nouveau mot de passe d\'au moins 8 caractères.</div>' +
      '<div class="alog-error" id="alog-error"></div>' +
      '<label class="alog-label" for="alog-pwd">Nouveau mot de passe</label>' +
      '<input class="alog-input" type="password" id="alog-pwd" autocomplete="new-password" placeholder="••••••••">' +
      '<label class="alog-label" for="alog-pwd2">Confirmer le mot de passe</label>' +
      '<input class="alog-input" type="password" id="alog-pwd2" autocomplete="new-password" placeholder="••••••••">' +
      '<div id="alog-strength" style="font-size:12px;margin:-6px 0 12px;min-height:16px"></div>' +
      '<button class="alog-btn" id="alog-submit">Enregistrer et accéder au back-office</button>';

    var pwd = document.getElementById('alog-pwd');
    var pwd2 = document.getElementById('alog-pwd2');
    var submit = document.getElementById('alog-submit');
    var strength = document.getElementById('alog-strength');

    pwd.addEventListener('input', function () {
      var s = window.PageResetPassword && window.PageResetPassword._strength
        ? window.PageResetPassword._strength(pwd.value) : null;
      strength.innerHTML = pwd.value && s && s.label
        ? '<span style="color:' + s.color + ';font-weight:600">Sécurité : ' + s.label + '</span>' : '';
    });
    [pwd, pwd2].forEach(function (el) {
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit.click(); });
    });
    submit.addEventListener('click', function () { self._save(pwd.value, pwd2.value); });
    pwd.focus();
  },

  _error: function (msg) {
    var el = document.getElementById('alog-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  },

  _busy: function (on) {
    var b = document.getElementById('alog-submit');
    if (!b) return;
    b.disabled = on;
    b.textContent = on ? 'Enregistrement...' : 'Enregistrer et accéder au back-office';
  },

  _translate: function (msg) {
    msg = msg || '';
    if (/different from the old password/i.test(msg)) return 'Le nouveau mot de passe doit être différent de l\'ancien.';
    if (/at least|should be|weak|characters/i.test(msg)) return 'Mot de passe trop faible : utilisez au moins 8 caractères, avec des chiffres et des lettres.';
    if (/session|jwt|expired|not authenticated/i.test(msg)) return 'Le lien a expiré. Demandez un nouveau lien depuis la page de connexion.';
    return msg || 'Une erreur est survenue. Réessayez.';
  },

  _save: function (p, c) {
    var self = this;
    this._error('');
    if (!p) return this._error('Entrez un mot de passe.');
    if (p.length < 8) return this._error('Minimum 8 caractères.');
    if (p !== c) return this._error('Les deux mots de passe ne correspondent pas.');
    this._busy(true);

    window.DB.auth.updateUser({ password: p }).then(function (res) {
      if (res.error) {
        self._busy(false);
        self._error(self._translate(res.error.message));
        return;
      }
      var user = res.data && res.data.user;
      if (user) window.HookAuth.user = user;
      window.HookAuth._loadProfile(user.id, function () {
        if (!window.HookAuth.isAdmin()) {
          if (window.PageAdminLogin) window.PageAdminLogin.deny();
          return;
        }
        if (window.Toast) window.Toast.success('Mot de passe mis à jour.');
        window.Router.navigate('/Nkololopangohook');
      });
    });
  }
};
