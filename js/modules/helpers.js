window.Helpers={scrollTop:function(){window.scrollTo(0,0)},formatDate:function(e){return e?new Date(e).toLocaleDateString("fr-FR",{day:"2-digit",month:"2-digit",year:"numeric"}):""},formatNumber:function(e){return e.toLocaleString("fr-FR")},escapeHtml:function(e){var t=document.createElement("div");return t.appendChild(document.createTextNode(e||"")),t.innerHTML},getInitials:function(e){if(!e)return"?";var t=e.trim().split(" ");return t.length>=2?(t[0][0]+t[t.length-1][0]).toUpperCase():e[0].toUpperCase()},renderPage:function(e){var t=document.getElementById("main-content");t&&(t.innerHTML=e),window.Helpers.scrollTop()},underConstruction:function(e){return'<div class="page-wrapper"><div class="page-card"><div class="under-construction"><div class="uc-icon"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><rect x="3" y="3" width="16" height="16" rx="3" stroke="#5F5E5A" stroke-width="1.4"/><path d="M8 11h6M11 8v6" stroke="#5F5E5A" stroke-width="1.4" stroke-linecap="round"/></svg></div><div class="uc-title">Page en construction</div><div class="uc-desc">Cette section sera disponible prochainement.</div></div></div></div>'},simulateAction:function(e,t){t=t||800,setTimeout(e,t)},openModal:function(e){var t=document.createElement("div");t.className="modal-overlay",t.id="active-modal",t.innerHTML=e,document.body.appendChild(t),t.addEventListener("click",function(e){e.target===t&&window.Helpers.closeModal()})},closeModal:function(){var e=document.getElementById("active-modal");e&&e.remove()},logo:function(e){return '<div style="display:flex;align-items:center;gap:8px"><img src="https://ik.imagekit.io/dkeqnflsg/HOOK%20ICON%20COLOR%20(1).png?updatedAt=1781142267098" alt="Hook" style="height:36px;width:auto;flex-shrink:0"><img src="https://ik.imagekit.io/dkeqnflsg/LOGO%20TYPO%20COLOR.png?updatedAt=1781142267228" alt="Hook" style="height:22px;width:auto;flex-shrink:0"></div>';}};
window.Helpers.requireActiveSender = function(cb) {
  var orgId = window.HookAuth && window.HookAuth.profile && window.HookAuth.profile.organization_id;
  if (!orgId) { window.Helpers._showNoSenderModal(); return; }
  window.DB.from('sender_ids').select('id').eq('organization_id', orgId).eq('statut', 'approved').limit(1)
    .then(function(res) {
      if (res.data && res.data.length > 0) { cb(); }
      else { window.Helpers._showNoSenderModal(); }
    })
    .catch(function() { cb(); });
};

window.Helpers._showNoSenderModal = function() {
  window.Helpers.openModal(
    '<div class="modal-box">' +
      '<div class="modal-title">Sender ID requis</div>' +
      '<div class="modal-desc">Vous devez avoir au moins un Sender ID actif avant de créer une campagne. Soumettez une demande et attendez la validation (24-48h).</div>' +
      '<div class="modal-actions">' +
        '<button class="btn" onclick="window.Helpers.closeModal()">Fermer</button>' +
        '<button class="btn btn-primary" onclick="window.Helpers.closeModal();window.Router.navigate(\'/sender-id\')">Créer un Sender ID</button>' +
      '</div>' +
    '</div>'
  );
};
