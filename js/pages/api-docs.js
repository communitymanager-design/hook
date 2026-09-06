window.PageApiDocs = {
  BASE: 'https://api.hookplateform.com/functions/v1/api',

  render: function() {
    if (!window.HookAuth.isLoggedIn()) { window.Router.navigate('/auth'); return; }
    var b = this.BASE;
    var html = '<div class="page-wrapper doc-wrapper">'
      + '<div class="doc-back" id="doc-back">' + this._i('back') + 'Retour aux developpeurs</div>'
      + '<div class="page-title">Documentation API</div>'
      + '<div class="page-subtitle">Envoyez des SMS depuis vos applications avec l\'API Hook</div>'

      + this._section('Introduction',
          '<p class="doc-p">L\'API Hook vous permet d\'envoyer des SMS a vos contacts directement depuis votre code, en utilisant vos credits et vos Sender ID approuves. Toutes les requetes utilisent HTTPS et retournent du JSON.</p>'
          + '<div class="doc-base"><span class="doc-base-label">URL de base</span><code>' + b + '</code></div>')

      + this._section('Authentification',
          '<p class="doc-p">Chaque requete doit inclure votre cle API dans l\'en-tete <code>Authorization</code>. Generez une cle depuis la page Developpeurs.</p>'
          + this._code('Authorization: Bearer hook_live_votre_cle_ici')
          + '<p class="doc-note">' + this._i('warn') + 'Gardez votre cle secrete. Ne la publiez jamais cote client (navigateur, application mobile visible). Utilisez-la uniquement depuis vos serveurs.</p>')

      + this._section('Envoyer un SMS',
          '<div class="doc-endpoint"><span class="doc-method doc-post">POST</span><code>/sms/send</code></div>'
          + '<p class="doc-p">Envoie un SMS a un ou plusieurs destinataires. Chaque destinataire consomme 1 credit.</p>'
          + '<div class="doc-table-title">Parametres (corps JSON)</div>'
          + this._params([
              ['to', 'string ou array', 'Numero(s) au format international, ex +242061234567. Accepte une chaine ou une liste.'],
              ['text', 'string', 'Le contenu du message.'],
              ['sender', 'string', 'Optionnel. Nom d\'un de vos Sender ID approuves. Si omis, votre Sender ID approuve le plus recent est utilise.']
            ])
          + '<div class="doc-table-title">Exemple</div>'
          + this._tabs('send', {
              curl: 'curl -X POST "' + b + '/sms/send" \\\n  -H "Authorization: Bearer hook_live_votre_cle" \\\n  -H "Content-Type: application/json" \\\n  -d \'{\n    "to": "+242061234567",\n    "sender": "MONENTREPRISE",\n    "text": "Votre code de verification est 4821"\n  }\'',
              js: 'const res = await fetch("' + b + '/sms/send", {\n  method: "POST",\n  headers: {\n    "Authorization": "Bearer hook_live_votre_cle",\n    "Content-Type": "application/json"\n  },\n  body: JSON.stringify({\n    to: "+242061234567",\n    sender: "MONENTREPRISE",\n    text: "Votre code de verification est 4821"\n  })\n});\nconst data = await res.json();',
              php: '$ch = curl_init("' + b + '/sms/send");\ncurl_setopt($ch, CURLOPT_RETURNTRANSFER, true);\ncurl_setopt($ch, CURLOPT_POST, true);\ncurl_setopt($ch, CURLOPT_HTTPHEADER, [\n  "Authorization: Bearer hook_live_votre_cle",\n  "Content-Type: application/json"\n]);\ncurl_setopt($ch, CURLOPT_POSTFIELDS, json_encode([\n  "to" => "+242061234567",\n  "sender" => "MONENTREPRISE",\n  "text" => "Votre code de verification est 4821"\n]));\n$response = curl_exec($ch);'
            })
          + '<div class="doc-table-title">Reponse</div>'
          + this._code('{\n  "success": true,\n  "messages": [\n    { "id": "a1b2...", "to": "+242061234567", "status": "sent", "message_id": "36f8..." }\n  ],\n  "credits_consumed": 1,\n  "balance": 29999\n}'))

      + this._section('Statut d\'un message',
          '<div class="doc-endpoint"><span class="doc-method doc-get">GET</span><code>/sms/{id}</code></div>'
          + '<p class="doc-p">Recupere le statut d\'un message envoye, avec l\'identifiant <code>id</code> retourne lors de l\'envoi.</p>'
          + this._code('curl "' + b + '/sms/a1b2c3d4" \\\n  -H "Authorization: Bearer hook_live_votre_cle"')
          + '<div class="doc-table-title">Reponse</div>'
          + this._code('{\n  "id": "a1b2c3d4",\n  "to": "+242061234567",\n  "sender": "MONENTREPRISE",\n  "status": "delivered",\n  "sent_at": "2026-01-15T10:30:00Z",\n  "delivered_at": "2026-01-15T10:30:04Z"\n}')
          + '<p class="doc-p">Les statuts possibles sont : <code>sent</code> (transmis a l\'operateur), <code>delivered</code> (recu par le destinataire), <code>failed</code> (echec).</p>')

      + this._section('Consulter le solde',
          '<div class="doc-endpoint"><span class="doc-method doc-get">GET</span><code>/balance</code></div>'
          + '<p class="doc-p">Retourne le nombre de SMS restants sur votre compte.</p>'
          + this._code('curl "' + b + '/balance" \\\n  -H "Authorization: Bearer hook_live_votre_cle"')
          + this._code('{\n  "sms_remaining": 29999,\n  "balance_fcfa": 2999900\n}'))

      + this._section('Codes d\'erreur',
          '<p class="doc-p">En cas d\'erreur, l\'API retourne un code HTTP et un objet <code>error</code> avec un <code>code</code> et un <code>message</code>.</p>'
          + this._errors([
              ['401', 'unauthorized', 'Cle API manquante, invalide ou revoquee.'],
              ['402', 'insufficient_credits', 'Solde de credits insuffisant pour l\'envoi.'],
              ['403', 'sender_not_approved', 'Le Sender ID demande n\'existe pas ou n\'est pas approuve.'],
              ['400', 'bad_request', 'Parametres manquants ou invalides.'],
              ['429', 'rate_limited', 'Plus de 60 requetes en une minute.'],
              ['502', 'provider_error', 'Echec cote operateur SMS.']
            ]))

      + this._section('Limites',
          '<p class="doc-p">L\'API est limitee a <strong>60 requetes par minute</strong> par cle. Au dela, les requetes reçoivent un code <code>429</code>. Chaque SMS envoye consomme 1 credit, quel que soit le nombre de destinataires : un envoi a 10 numeros consomme 10 credits.</p>')

    + '</div>';
    window.Helpers.renderPage(html);
    this._bind();
  },

  _bind: function() {
    var back = document.getElementById('doc-back');
    if (back) back.addEventListener('click', function() { window.Router.navigate('/developers'); });

    document.querySelectorAll('.doc-copy').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var code = btn.parentNode.querySelector('code, pre');
        var txt = code ? code.textContent : '';
        navigator.clipboard.writeText(txt).then(function() {
          var old = btn.innerHTML;
          btn.innerHTML = 'Copie';
          setTimeout(function() { btn.innerHTML = old; }, 1500);
        });
      });
    });

    document.querySelectorAll('.doc-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        var group = tab.getAttribute('data-group');
        var lang = tab.getAttribute('data-lang');
        document.querySelectorAll('.doc-tab[data-group="' + group + '"]').forEach(function(t) { t.classList.remove('active'); });
        tab.classList.add('active');
        document.querySelectorAll('.doc-tab-panel[data-group="' + group + '"]').forEach(function(p) {
          p.style.display = p.getAttribute('data-lang') === lang ? 'block' : 'none';
        });
      });
    });
  },

  _section: function(title, body) {
    return '<div class="doc-section"><div class="doc-section-title">' + title + '</div>' + body + '</div>';
  },

  _code: function(txt) {
    return '<div class="doc-code"><button class="doc-copy">' + this._i('copy') + '</button><pre>' + window.Helpers.escapeHtml(txt) + '</pre></div>';
  },

  _tabs: function(group, langs) {
    var names = { curl: 'cURL', js: 'JavaScript', php: 'PHP' };
    var tabs = Object.keys(langs).map(function(l, idx) {
      return '<button class="doc-tab' + (idx === 0 ? ' active' : '') + '" data-group="' + group + '" data-lang="' + l + '">' + names[l] + '</button>';
    }).join('');
    var panels = Object.keys(langs).map(function(l, idx) {
      return '<div class="doc-tab-panel" data-group="' + group + '" data-lang="' + l + '" style="display:' + (idx === 0 ? 'block' : 'none') + '">'
        + '<div class="doc-code"><button class="doc-copy">' + window.PageApiDocs._i('copy') + '</button><pre>' + window.Helpers.escapeHtml(langs[l]) + '</pre></div></div>';
    }).join('');
    return '<div class="doc-tabs">' + tabs + '</div>' + panels;
  },

  _params: function(rows) {
    return '<div class="doc-table">' + rows.map(function(r) {
      return '<div class="doc-param"><div class="doc-param-name">' + r[0] + '<span class="doc-param-type">' + r[1] + '</span></div>'
        + '<div class="doc-param-desc">' + r[2] + '</div></div>';
    }).join('') + '</div>';
  },

  _errors: function(rows) {
    return '<div class="doc-table">' + rows.map(function(r) {
      return '<div class="doc-err"><span class="doc-err-code">' + r[0] + '</span><code class="doc-err-slug">' + r[1] + '</code><span class="doc-err-desc">' + r[2] + '</span></div>';
    }).join('') + '</div>';
  },

  _i: function(name) {
    var i = {
      back: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
      copy: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="4.5" y="4.5" width="7.5" height="7.5" rx="1.4" stroke="currentColor" stroke-width="1.2"/><path d="M9.5 4.5V3A1.5 1.5 0 0 0 8 1.5H3A1.5 1.5 0 0 0 1.5 3v5A1.5 1.5 0 0 0 3 9.5h1.5" stroke="currentColor" stroke-width="1.2"/></svg>',
      warn: '<svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M8 2l6 11H2L8 2z" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/><path d="M8 6.5v3M8 11.2v.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>'
    };
    return i[name] || '';
  }
};
