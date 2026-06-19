window.PageResetPassword = {
  render: function() {
    window.Helpers.renderPage(
      '<div class="auth-page">' +
        '<div class="auth-card">' +
          '<div class="auth-logo" style="margin-bottom:24px">' + window.Helpers.logo(56) + '</div>' +
          '<h2 class="auth-title">Nouveau mot de passe</h2>' +
          '<p class="auth-subtitle">Choisissez un mot de passe sécurisé pour votre compte.</p>' +
          '<div class="form-group">' +
            '<label>Nouveau mot de passe</label>' +
            '<input type="password" id="reset-pwd" placeholder="Minimum 8 caractères" autocomplete="new-password">' +
          '</div>' +
          '<div class="form-group">' +
            '<label>Confirmer le mot de passe</label>' +
            '<input type="password" id="reset-pwd-confirm" placeholder="Minimum 8 caractères" autocomplete="new-password">' +
          '</div>' +
          '<div id="reset-strength" style="margin-bottom:12px;font-size:12px;color:var(--color-text-muted)"></div>' +
          '<div id="reset-error" class="auth-error-msg" style="display:none"></div>' +
          '<button class="btn btn-primary" style="width:100%;justify-content:center;margin-top:4px" id="btn-reset-submit">Enregistrer le mot de passe</button>' +
        '</div>' +
      '</div>'
    );
    this._bind();
  },

  _strength: function(pwd) {
    var score = 0;
    if (pwd.length >= 8)  score++;
    if (pwd.length >= 12) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    var labels = ['', 'Faible', 'Faible', 'Moyen', 'Fort', 'Très fort'];
    var colors = ['', '#D93636', '#D93636', '#C07A00', '#1D9E75', '#0B3828'];
    return { score: score, label: labels[score] || '', color: colors[score] || '' };
  },

  _bind: function() {
    var pwd     = document.getElementById('reset-pwd');
    var confirm = document.getElementById('reset-pwd-confirm');
    var errBox  = document.getElementById('reset-error');
    var strength= document.getElementById('reset-strength');
    var btn     = document.getElementById('btn-reset-submit');

    function showErr(msg) {
      if (errBox) { errBox.textContent = msg; errBox.style.display = 'block'; }
    }
    function hideErr() {
      if (errBox) errBox.style.display = 'none';
    }

    if (pwd) {
      pwd.addEventListener('input', function() {
        var s = window.PageResetPassword._strength(pwd.value);
        if (strength) {
          strength.innerHTML = pwd.value
            ? '<span style="color:' + s.color + '">' + s.label + '</span>'
            : '';
        }
      });
    }

    if (btn) {
      btn.addEventListener('click', function() {
        hideErr();
        var p = pwd ? pwd.value : '';
        var c = confirm ? confirm.value : '';
        if (!p) return showErr('Entrez un mot de passe.');
        if (p.length < 8) return showErr('Minimum 8 caractères.');
        if (p !== c) return showErr('Les mots de passe ne correspondent pas.');

        btn.textContent = 'Enregistrement...';
        btn.disabled = true;

        window.DB.auth.updateUser({ password: p }).then(function(res) {
          if (res.error) {
            showErr(res.error.message);
            btn.textContent = 'Enregistrer le mot de passe';
            btn.disabled = false;
            return;
          }
          window.Toast.success('Mot de passe mis à jour.');
          window.HookAuth.signOut(function() {
            setTimeout(function() { window.Router.navigate('/auth'); }, 1500);
          });
        });
      });
    }
  }
};
