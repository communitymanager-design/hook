window.Infobip = {

  _fnUrl: function(name) {
    return 'https://lzdhipjgguwpqljahogu.supabase.co/functions/v1/' + name;
  },

  _getToken: function() {
    try {
      for (var k in localStorage) {
        if (k.indexOf('supabase') > -1 && k.indexOf('auth-token') > -1) {
          var s = JSON.parse(localStorage[k]);
          if (s && s.access_token) return s.access_token;
        }
      }
    } catch(e) {}
    return '';
  },

  sendCampaign: function(campaignId, cb) {
    var token = this._getToken();
    fetch(this._fnUrl('send-sms'), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      },
      body: JSON.stringify({ campaign_id: campaignId })
    })
    .then(function(r){ return r.json(); })
    .then(function(data) {
      if (data.error) { if (cb) cb(data.error, null); return; }
      if (cb) cb(null, data);
    })
    .catch(function(err) { if (cb) cb(err.message, null); });
  }
};
