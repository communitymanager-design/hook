window.HookEvents = {

  _actorId: function() {
    return window.HookAuth && window.HookAuth.user && window.HookAuth.user.id;
  },

  _actorRole: function() {
    return window.HookAuth && window.HookAuth.role ? window.HookAuth.role() : 'admin';
  },

  log: function(action, ressource_type, ressource_id, target_user_id, détails) {
    var actorId = this._actorId();
    if (!actorId) return;
    window.DB.rpc('log_admin_action', {
      p_actor_id:       actorId,
      p_actor_role:     this._actorRole(),
      p_action:         action,
      p_ressource_type: ressource_type,
      p_ressource_id:   ressource_id   || '00000000-0000-0000-0000-000000000000',
      p_target_user_id: target_user_id || null,
      p_détails:        détails        || {}
    }).then(function(){}).catch(function(){});
  },

  notify: function(user_id, type, titre, message, lien, metadata) {
    if (!user_id) return;
    window.DB.rpc('notify_user', {
      p_user_id:  user_id,
      p_actor_id: this._actorId() || null,
      p_type:     type,
      p_titre:    titre,
      p_message:  message,
      p_lien:     lien     || null,
      p_metadata: metadata || {}
    }).then(function(){}).catch(function(){});
  },

  senderIdApproved: function(sid, targetUserId) {
    this.log('sender_id_approved', 'sender_id', sid.id, targetUserId, { name: sid.name });
    this.notify(targetUserId, 'senderid',
      'Sender ID approuve',
      'Votre Sender ID "' + sid.name + '" a été approuve et est maintenant actif. Vous pouvez créer vos premières campagnes.',
      '/sender-id',
      { sender_id: sid.id, name: sid.name }
    );
  },

  senderIdRejected: function(sid, targetUserId, note) {
    this.log('sender_id_rejected', 'sender_id', sid.id, targetUserId, { name: sid.name, note: note });
    this.notify(targetUserId, 'senderid',
      'Sender ID refusé',
      'Votre demande pour "' + sid.name + '" a été refusée.' + (note ? ' Motif : ' + note : ''),
      '/sender-id',
      { sender_id: sid.id, name: sid.name, note: note }
    );
  },

  senderIdSuspended: function(sid, targetUserId) {
    this.log('sender_id_suspended', 'sender_id', sid.id, targetUserId, { name: sid.name });
    this.notify(targetUserId, 'alerte',
      'Sender ID suspendu',
      'Votre Sender ID "' + sid.name + '" a été suspendu. Vos campagnes en cours sont interrompues. Contactez le support pour plus d\'informations.',
      '/sender-id',
      { sender_id: sid.id, name: sid.name }
    );
  },

  senderIdBlocked: function(sid, targetUserId) {
    this.log('sender_id_blocked', 'sender_id', sid.id, targetUserId, { name: sid.name });
    this.notify(targetUserId, 'alerte',
      'Sender ID bloque',
      'Votre Sender ID "' + sid.name + '" a été bloque par l\'administration. Contactez le support pour regulariser votre situation.',
      '/sender-id',
      { sender_id: sid.id, name: sid.name }
    );
  },

  senderIdReactivated: function(sid, targetUserId) {
    this.log('sender_id_reactivated', 'sender_id', sid.id, targetUserId, { name: sid.name });
    this.notify(targetUserId, 'senderid',
      'Sender ID réactiver',
      'Votre Sender ID "' + sid.name + '" est de nouveau actif. Vous pouvez reprendre vos envois.',
      '/sender-id',
      { sender_id: sid.id, name: sid.name }
    );
  },

  senderIdDeleted: function(sid, targetUserId) {
    this.log('sender_id_deleted', 'sender_id', sid.id, targetUserId, { name: sid.name });
    this.notify(targetUserId, 'alerte',
      'Sender ID supprime',
      'Votre Sender ID "' + sid.name + '" a été définitivement supprime par l\'administration.',
      '/sender-id',
      { sender_id: sid.id, name: sid.name }
    );
  },

  clientRoleChanged: function(targetUser, oldRole, newRole) {
    this.log('user_role_changed', 'user', targetUser.id, targetUser.id, { old_role: oldRole, new_role: newRole, email: targetUser.email });
    this.notify(targetUser.id, 'campagne',
      'Votre role a été modifie',
      'Votre role a été change de "' + oldRole + '" vers "' + newRole + '" par l\'administration.',
      '/settings',
      { old_role: oldRole, new_role: newRole }
    );
  },

  clientDeleted: function(targetUser) {
    this.log('user_deleted', 'user', targetUser.id, targetUser.id, { email: targetUser.email, prenom: targetUser.prenom, nom: targetUser.nom });
  },

  clientUpdated: function(targetUser, changes) {
    this.log('user_updated', 'user', targetUser.id, targetUser.id, Object.assign({ email: targetUser.email }, changes));
  }

};
