window.PagePlans = {
  render: function() {
    if (!window.HookAuth.isLoggedIn()) { window.Router.navigate('/auth'); return; }
    var html = '<div class="page-wrapper plans-wrapper">'
      + '<div class="plans-header">'
        + '<div class="breadcrumb">Compte</div>'
        + '<div class="page-title">Passer Pro</div>'
        + '<div class="page-subtitle">Choisissez l\'offre qui accompagne votre croissance</div>'
      + '</div>'
      + '<div class="pricing-grid plans-grid">'
        + this._plans().map(function(p, i) { return window.PagePlans._card(p, i+1); }).join('')
      + '</div>'
    + '</div>';
    window.Helpers.renderPage(html);
    setTimeout(function() { window.PagePlans._initSliders(); }, 0);
  },

  _plans: function() {
    return [
      {
        code: 'essentiel', name: 'Essentiel', price: '55 000',
        included: '+200 SMS inclus', featured: false,
        features: [
          {ok:true, label:'1 nom d\'expéditeur validé'},
          {ok:true, label:'Tableau de bord simple'},
          {ok:true, label:'10 templates'},
          {ok:true, label:'Désabonnement STOP géré pour vous'},
          {ok:true, label:'Réponse par email sous 48h'},
          {ok:false, label:'Automatisations'},
          {ok:false, label:'Statistiques avancées'}
        ]
      },
      {
        code: 'croissance', name: 'Croissance', price: '150 000',
        included: '+600 SMS inclus', featured: true,
        features: [
          {ok:true, label:'3 noms d\'expéditeur validés'},
          {ok:true, label:'Tableau de bord complet'},
          {ok:true, label:'10 templates FR + LN'},
          {ok:true, label:'Automatisations'},
          {ok:true, label:'Statistiques avancées'},
          {ok:true, label:'1 connecteur CRM (Zoho)'},
          {ok:true, label:'Accès API REST'},
          {ok:true, label:'Réponse prioritaire sous 24h'}
        ]
      },
      {
        code: 'performance', name: 'Performance', price: '380 000',
        included: '+1 000 SMS inclus', featured: false,
        features: [
          {ok:true, label:'Noms d\'expéditeur illimités'},
          {ok:true, label:'Tableau de bord complet'},
          {ok:true, label:'Tous les templates'},
          {ok:true, label:'Automatisations avancées'},
          {ok:true, label:'Statistiques avancées et heures fortes'},
          {ok:true, label:'Tous les connecteurs CRM'},
          {ok:true, label:'Accès API complet'},
          {ok:true, label:'Un interlocuteur dédié, réponse le jour même'}
        ]
      }
    ];
  },

  _card: function(p, idx) {
    var check = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M2 6.5l3 3 6-6" stroke="#1A5C3C" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var cross = '<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3.5 3.5l6 6M9.5 3.5l-6 6" stroke="#B0B8B0" stroke-width="1.3" stroke-linecap="round"/></svg>';
    var feats = p.features.map(function(f) {
      return '<div class="pf-item'+(f.ok?'':' pf-off')+'">'+(f.ok?check:cross)+f.label+'</div>';
    }).join('');
    var cls = p.featured ? 'pricing-card featured' : 'pricing-card';
    var badge = p.featured ? '<div class="pricing-badge">Recommandé</div>' : '';
    var btnCls = p.featured ? 'btn pricing-btn pricing-btn-featured' : 'btn pricing-btn';
    return '<div class="'+cls+'">'
      + badge
      + '<div class="pricing-plan-name">'+p.name+'</div>'
      + '<div class="pricing-price">'+p.price+' <span class="pricing-currency">FCFA/mois</span></div>'
      + '<div class="pricing-included">'+p.included+'</div>'
      + '<div class="pricing-features">'+feats+'</div>'
      + '<div class="pricing-slider-wrap">'
        + '<div class="pricing-slider-label">Au-delà : <span class="pricing-sms-rate">100 FCFA par SMS</span></div>'
        + '<div class="pricing-slider-track-wrap">'
          + '<input type="range" class="pricing-slider" id="plans-slider-'+idx+'" min="0" max="10000" step="100" value="0">'
          + '<span class="pricing-slider-bubble" id="plans-bubble-'+idx+'">0</span>'
        + '</div>'
        + '<div class="pricing-pack-tier" id="plans-pack-'+idx+'"></div>'
      + '</div>'
      + '<button class="'+btnCls+'" onclick="window.PagePlans._choose(\''+p.code+'\',\''+p.name+'\')">Choisir ce plan</button>'
    + '</div>';
  },

  _initSliders: function() {
    function fmt(n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
    [1,2,3].forEach(function(i) {
      var slider = document.getElementById('plans-slider-'+i);
      var bubble = document.getElementById('plans-bubble-'+i);
      var pack = document.getElementById('plans-pack-'+i);
      if (!slider || !bubble) return;
      function update() {
        var extra = parseInt(slider.value) || 0;
        var pct = Math.round((extra/10000)*100);
        slider.style.setProperty('--pct', pct+'%');
        bubble.textContent = fmt(extra);
        bubble.style.left = pct+'%';
        if (pack) {
          if (extra >= 10000) pack.textContent = 'Pack à '+Math.round(100/3)+' FCFA/SMS';
          else if (extra >= 5000) pack.textContent = 'Pack à '+Math.round(100/2)+' FCFA/SMS';
          else pack.textContent = '';
        }
      }
      slider.addEventListener('input', update);
      update();
    });
  },

  _choose: function(code, name) {
    window.Helpers.openModal(
      '<div class="modal-box">'
        + '<div class="modal-title">Passer au plan '+name+'</div>'
        + '<div class="modal-desc">Notre équipe vous contactera dans les 24h pour finaliser votre abonnement au plan <strong>'+name+'</strong> et vous transmettre les instructions de paiement.</div>'
        + '<div class="modal-actions">'
          + '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>'
          + '<button class="btn btn-primary" onclick="window.Helpers.closeModal();window.Toast.success(\'Demande envoyée. Nous vous contactons sous 24h.\')">Confirmer la demande</button>'
        + '</div>'
      + '</div>'
    );
  }
};
