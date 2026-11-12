// Connexion au back-office (back.hookplateform.com) : distincte de la connexion client
window.HOOK_CLIENT_URL = 'https://app.hookplateform.com';

window.HookAuth.isBackOffice = function() {
  return window.location.hostname.indexOf('back.') === 0 || window.HOOK_BACKOFFICE === true;
};

window.PageAdminLogin = {
  mode: 'login',

  render: function(error) {
    error = error || this._pendingError;
    this._pendingError = null;
    // Déjà connecté avec un compte admin : direction le tableau de bord
    if (window.HookAuth.isLoggedIn() && window.HookAuth.isAdmin()) {
      window.Router.navigate('/Nkololopangohook');
      return;
    }
    var nav = document.getElementById('navbar-container');
    var adm = document.getElementById('admin-navbar-container');
    var main = document.getElementById('main-content');
    if (nav) { nav.innerHTML = ''; nav.style.display = 'none'; }
    if (adm) adm.style.display = 'none';
    if (window.AdminNavbar) window.AdminNavbar._rendered = false;
    if (main) main.style.marginLeft = '0';

    window.Helpers.renderPage(
      '<div class="alog-page">' +
      '<div class="alog-card">' +
      '<div class="alog-brand">' +
      '<img src="https://ik.imagekit.io/dkeqnflsg/HOOK%20ICON%20COLOR%20(1).png?updatedAt=1781142267098" alt="Hook" class="alog-icon" draggable="false">' +
      '<div><div class="alog-name">Hook</div><div class="alog-badge">Back-office</div></div>' +
      '</div>' +
      '<div id="alog-body">' + (this.mode === 'reset' ? this._resetForm() : this._loginForm()) + '</div>' +
      '</div>' +
      '<div class="alog-foot">Vous êtes client ? <a href="' + window.HOOK_CLIENT_URL + '/#/auth">Accéder à votre espace</a></div>' +
      '</div>'
    );
    this._bind();
    if (error) this._error(error);
  },

  _loginForm: function() {
    return '<div class="alog-title">Connexion administration</div>' +
      '<div class="alog-sub">Accès réservé à l\'équipe Hook.</div>' +
      '<div class="alog-error" id="alog-error"></div>' +
      '<label class="alog-label" for="alog-email">Email</label>' +
      '<input class="alog-input" type="email" id="alog-email" autocomplete="username" placeholder="prenom@lopango.io">' +
      '<label class="alog-label" for="alog-pwd">Mot de passe</label>' +
      '<input class="alog-input" type="password" id="alog-pwd" autocomplete="current-password" placeholder="••••••••">' +
      '<button class="alog-btn" id="alog-submit">Se connecter</button>' +
      '<div class="alog-link" id="alog-forgot">Mot de passe oublié ?</div>';
  },

  _resetForm: function() {
    return '<div class="alog-title">Mot de passe oublié</div>' +
      '<div class="alog-sub">Indiquez votre email : vous recevrez un lien pour choisir un nouveau mot de passe.</div>' +
      '<div class="alog-error" id="alog-error"></div>' +
      '<label class="alog-label" for="alog-email">Email</label>' +
      '<input class="alog-input" type="email" id="alog-email" autocomplete="username" placeholder="prenom@lopango.io">' +
      '<button class="alog-btn" id="alog-submit">Envoyer le lien</button>' +
      '<div class="alog-link" id="alog-back">Retour à la connexion</div>';
  },

  _bind: function() {
    var self = this;
    var submit = document.getElementById('alog-submit');
    submit.addEventListener('click', function() {
      if (self.mode === 'reset') self._reset(); else self._login();
    });
    document.querySelectorAll('.alog-input').forEach(function(el) {
      el.addEventListener('keydown', function(e) { if (e.key === 'Enter') submit.click(); });
    });
    var forgot = document.getElementById('alog-forgot');
    if (forgot) forgot.addEventListener('click', function() { self.mode = 'reset'; self.render(); });
    var back = document.getElementById('alog-back');
    if (back) back.addEventListener('click', function() { self.mode = 'login'; self.render(); });
    var email = document.getElementById('alog-email');
    if (email) email.focus();
  },

  _error: function(msg) {
    var el = document.getElementById('alog-error');
    if (!el) return;
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
  },

  _busy: function(on, label) {
    var b = document.getElementById('alog-submit');
    if (!b) return;
    b.disabled = on;
    b.textContent = label;
  },

  _login: function() {
    var self = this;
    var email = document.getElementById('alog-email').value.trim();
    var pwd = document.getElementById('alog-pwd').value;
    this._error('');
    if (!email || !pwd) { this._error('Email et mot de passe requis'); return; }
    this._busy(true, 'Connexion...');
    window.HookAuth.signIn(email, pwd, function(err, data) {
      if (err) {
        self._busy(false, 'Se connecter');
        self._error(err.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : err.message);
        return;
      }
      window.HookAuth._loadProfile(data.user.id, function() {
        if (!window.HookAuth.isAdmin()) {
          self.deny();
          return;
        }
        window.Router.navigate('/Nkololopangohook');
      });
    });
  },

  _reset: function() {
    var self = this;
    var email = document.getElementById('alog-email').value.trim();
    this._error('');
    if (!email) { this._error('Email requis'); return; }
    this._busy(true, 'Envoi...');
    window.HookAuth.resetPassword(email, function(err) {
      self._busy(false, 'Envoyer le lien');
      if (err) { self._error(err.message); return; }
      document.getElementById('alog-body').innerHTML =
        '<div class="alog-title">Email envoyé</div>' +
        '<div class="alog-sub">Si un compte existe pour <strong>' + window.Helpers.escapeHtml(email) + '</strong>, un lien de réinitialisation vient de lui être envoyé.</div>' +
        '<div class="alog-link" id="alog-back">Retour à la connexion</div>';
      document.getElementById('alog-back').addEventListener('click', function() { self.mode = 'login'; self.render(); });
    });
  },

  // Compte valide mais sans droits admin : on le déconnecte du back-office
  deny: function() {
    var self = this;
    window.HookAuth.signOut(function() {
      self.mode = 'login';
      self._pendingError = 'Ce compte n\'a pas accès au back-office. Les clients se connectent sur app.hookplateform.com.';
      if (window.location.hash !== '#/auth') window.location.hash = '/auth';
      else self.render();
    });
  }
};
