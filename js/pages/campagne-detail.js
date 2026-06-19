window.PageCampagneDetail = {
  _currentId: null,

  render: function() {
    var self = this;
    if (this._pollTimer) { clearTimeout(this._pollTimer); this._pollTimer = null; }
    var hash = window.location.hash.replace('#/', '');
    var parts = hash.split('/');
    var id = parts[parts.length - 1];
    if (!id || id === 'detail' || id === '') id = this._currentId;
    if (!id || id === 'detail') { window.Router.navigate('/campagnes'); return; }
    this._currentId = id;

    window.Helpers.renderPage(
      '<div class="page-wrapper">' +
        '<a href="#/campagnes" class="breadcrumb-back"><svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M9 2L4 7l5 5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>Campagnes</a>' +
        '<div class="page-title" id="cd-name">Chargement...</div>' +
        '<div id="cd-body" style="margin-top:24px"><div class="cd-loading"><div class="cd-spinner"></div><span>Chargement...</span></div></div>' +
      '</div>'
    );
    window.PageCampagneDetail._load(id);
  },

  _load: function(id) {
    var self = this;
    window.DB.from('campaigns').select('*, sender_ids(id,name,statut)').eq('id', id).single()
      .then(function(res) {
        if (res.error || !res.data) { window.Toast.error('Campagne introuvable'); window.Router.navigate('/campagnes'); return; }
        var camp = res.data;
        var title = document.getElementById('cd-name');
        if (title) title.textContent = camp.nom;

        window.DB.from('campaign_messages').select('statut').eq('campaign_id', id)
          .then(function(mr) {
            var msgs = mr.data || [];
            var total = camp.contacts_count || msgs.length || 0;
            var livres = msgs.filter(function(m){ return m.statut==='delivered'; }).length;
            var echecs = msgs.filter(function(m){ return m.statut==='failed'; }).length;
            var enAttente = msgs.filter(function(m){ return m.statut==='pending'||m.statut==='sent'; }).length;
            var taux = total > 0 ? Math.round(livres/total*100) : 0;
            window.PageCampagneDetail._draw(camp, { total:total, livres:livres, echecs:echecs, enAttente:enAttente, taux:taux });

            if (camp.statut === 'sending' && window.location.hash.indexOf(id) !== -1) {
              if (self._pollTimer) clearTimeout(self._pollTimer);
              self._pollTimer = setTimeout(function() {
                if (window.location.hash.indexOf(id) !== -1) self._load(id);
              }, 5000);
            }
          });
      });
  },

  _statusInfo: function(s) {
    var m = { sending:{l:'En cours',c:'#1D9E75',bg:'rgba(29,158,117,0.1)'}, scheduled:{l:'Programmée',c:'#C07A00',bg:'rgba(192,122,0,0.1)'}, sent:{l:'Terminée',c:'#0B3828',bg:'rgba(11,56,40,0.08)'}, draft:{l:'Brouillon',c:'#AEADA9',bg:'rgba(174,173,169,0.12)'}, cancelled:{l:'Annulée',c:'#D93636',bg:'rgba(217,54,54,0.1)'} };
    return m[s] || {l:s,c:'#5F5E5A',bg:'rgba(95,94,90,0.08)'};
  },

  _draw: function(camp, stats) {
    var si = this._statusInfo(camp.statut);
    var sender = camp.sender_ids ? camp.sender_ids.name : '-';
    var msg = camp.message || camp.message_final || '-';
    var date = camp.created_at ? new Date(camp.created_at).toLocaleDateString('fr-FR',{day:'2-digit',month:'long',year:'numeric',hour:'2-digit',minute:'2-digit'}) : '-';
    var taux = stats.taux;
    var tauxEchec = stats.total > 0 ? Math.round(stats.echecs/stats.total*100) : 0;
    var tauxAttente = stats.total > 0 ? Math.round(stats.enAttente/stats.total*100) : 0;

    var html =
    '<div class="cd-layout">' +

      // ── LEFT ──
      '<div class="cd-left">' +

        '<div class="cd-status-pill" style="background:'+si.bg+';color:'+si.c+'">'+
          ''+si.l+
          '<span class="cd-status-date">'+date+'</span>'+
        '</div>'+

        '<div class="cd-card">' +
          '<div class="cd-card-label">Message envoyé</div>' +
          '<div class="cd-message-bubble">'+window.Helpers.escapeHtml(msg)+'</div>' +
          '<div class="cd-msg-footer">' +
            '<span>'+msg.length+' car.</span>'+
            '<span class="cd-dot">·</span>'+
            '<span>'+Math.ceil(msg.length/160 || 1)+' SMS</span>'+
          '</div>'+
        '</div>'+

        '<div class="cd-card cd-sender-card">' +
          '<div class="cd-card-label">Expéditeur</div>' +
          '<div class="cd-sender-row">' +
            '<div class="cd-sender-badge">'+sender.charAt(0).toUpperCase()+'</div>' +
            '<div>' +
              '<div class="cd-sender-name">'+window.Helpers.escapeHtml(sender)+'</div>' +
              '<div class="cd-sender-sub">Sender ID · Validé</div>' +
            '</div>' +
          '</div>' +
        '</div>'+

        '<div class="cd-card">' +
          '<div class="cd-card-label">Actions</div>' +
          '<button id="btn-cd-delete" class="cd-btn-danger">'+
            '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 3.5h10M5 3.5V2.5h4v1M6 6v4M8 6v4M3 3.5l.6 7.5h6.8l.6-7.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'+
            'Supprimer la campagne'+
          '</button>'+
        '</div>'+

      '</div>'+

      // ── RIGHT ──
      '<div class="cd-right">' +

        // KPI row
        '<div class="cd-kpi-row">' +
          this._kpi('SMS envoyés', stats.total, '#0B3828', '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 11v2h12v-2M8 2v8M5 5l3-3 3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>') +
          this._kpi('Livrés', stats.livres, '#1D9E75', '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2.5 8.5l3.5 3.5 7.5-7.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>') +
          this._kpi('Échecs', stats.echecs, '#D93636', '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>') +
          this._kpi('Taux livraison', taux+'%', taux>=70?'#1D9E75':taux>=40?'#C07A00':'#D93636', '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="2" y="9" width="3" height="5" rx="1" fill="currentColor"/><rect x="6.5" y="6" width="3" height="8" rx="1" fill="currentColor"/><rect x="11" y="3" width="3" height="11" rx="1" fill="currentColor"/></svg>') +
        '</div>'+

        // Delivery chart
        '<div class="cd-card">' +
          '<div class="cd-card-label">Répartition des envois</div>' +

          // Big donut-style bar
          (stats.total > 0 ?
          '<div class="cd-donut-wrap">' +
            '<div class="cd-donut-bar">' +
              (taux>0?'<div class="cd-donut-seg cd-seg-green" style="width:'+taux+'%" title="Livrés '+taux+'%"></div>':'') +
              (tauxEchec>0?'<div class="cd-donut-seg cd-seg-red" style="width:'+tauxEchec+'%" title="Échecs '+tauxEchec+'%"></div>':'') +
              (tauxAttente>0?'<div class="cd-donut-seg cd-seg-grey" style="width:'+tauxAttente+'%" title="En attente '+tauxAttente+'%"></div>':'') +
            '</div>' +
            '<div class="cd-donut-nums">' +
              '<div class="cd-donut-big" style="color:'+(taux>=70?'#1D9E75':taux>=40?'#C07A00':'#D93636')+'">'+taux+'%</div>' +
              '<div class="cd-donut-label">taux de livraison</div>' +
            '</div>' +
          '</div>' :
          '<div class="cd-empty-chart">Aucune donnée de livraison disponible.<br>Les stats s\'afficheront après l\'envoi.</div>') +

          // Legend
          '<div class="cd-legend">' +
            '<div class="cd-legend-item"><span class="cd-legend-dot" style="background:#1D9E75"></span>Livrés <strong>'+stats.livres+'</strong></div>' +
            '<div class="cd-legend-item"><span class="cd-legend-dot" style="background:#D93636"></span>Échecs <strong>'+stats.echecs+'</strong></div>' +
            '<div class="cd-legend-item"><span class="cd-legend-dot" style="background:#AEADA9"></span>En attente <strong>'+stats.enAttente+'</strong></div>' +
          '</div>' +
        '</div>'+

        // Timeline mini
        (stats.total > 0 ?
        '<div class="cd-card">' +
          '<div class="cd-card-label">Performance</div>' +
          '<div class="cd-perf-grid">' +
            '<div class="cd-perf-item"><div class="cd-perf-num">'+Math.round(stats.total*37).toLocaleString('fr-FR')+' F</div><div class="cd-perf-label">Coût total</div></div>' +
            '<div class="cd-perf-item"><div class="cd-perf-num">37 F</div><div class="cd-perf-label">Coût / SMS</div></div>' +
            '<div class="cd-perf-item"><div class="cd-perf-num">'+(stats.livres>0?Math.round(stats.total*37/stats.livres)+' F':'-')+'</div><div class="cd-perf-label">Coût / livré</div></div>' +
          '</div>'+
        '</div>' : '') +

      '</div>'+
    '</div>';

    var body = document.getElementById('cd-body');
    if (body) {
      body.innerHTML = html;
      this._bindActions(camp.id);
      // Animate progress bar
      setTimeout(function() {
        var segs = document.querySelectorAll('.cd-donut-seg');
        segs.forEach(function(s){ s.style.transition='width 0.8s cubic-bezier(.4,0,.2,1)'; });
      }, 50);
    }
  },

  _kpi: function(label, value, color, icon) {
    return '<div class="cd-kpi">'+
      '<div class="cd-kpi-icon">'+icon+'</div>'+
      '<div class="cd-kpi-val" style="color:'+color+'">'+value+'</div>'+
      '<div class="cd-kpi-label">'+label+'</div>'+
    '</div>';
  },

  _bindActions: function(campId) {
    var delBtn = document.getElementById('btn-cd-delete');
    if (!delBtn) return;
    delBtn.addEventListener('click', function() {
      window.Helpers.openModal(
        '<div class="modal-box">' +
          '<div class="modal-title" style="color:#D93636">Supprimer la campagne ?</div>' +
          '<div class="modal-desc">Cette action est irréversible. La campagne et tous ses messages associés seront définitivement supprimés.</div>' +
          '<div class="modal-actions">' +
            '<button class="btn" onclick="window.Helpers.closeModal()">Annuler</button>' +
            '<button class="btn" style="background:#D93636;color:#fff;border-color:#D93636" id="confirm-del-camp">Supprimer</button>' +
          '</div>' +
        '</div>'
      );
      document.getElementById('confirm-del-camp').addEventListener('click', function() {
        window.DB.from('campaign_messages').delete().eq('campaign_id', campId).then(function() {
          window.DB.from('campaigns').delete().eq('id', campId).then(function(res) {
            if (res.error) { window.Toast.error(res.error.message); return; }
            window.Helpers.closeModal();
            window.Toast.success('Campagne supprimée');
            window.Router.navigate('/campagnes');
          });
        });
      });
    });
  }
};
