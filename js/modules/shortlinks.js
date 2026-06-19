window.ShortLinks = {

  BASE: 'https://hook-by-lopango.vercel.app/l/',

  _chars: 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789',

  _code: function() {
    var code = '';
    for (var i = 0; i < 6; i++) code += this._chars[Math.floor(Math.random() * this._chars.length)];
    return code;
  },

  _urlRegex: /https?:\/\/[^\s{}"'<>]+/g,

  hasUrl: function(text) {
    var matches = text.match(this._urlRegex) || [];
    return matches.some(function(u) { return u.indexOf('supabase.co') === -1 && u.indexOf('hook-by-lopango') === -1; });
  },

  // Shorten a single URL, returns short URL via callback
  shorten: function(originalUrl, orgId, cb) {
    var self = this;
    var code = self._code();
    window.DB.from('short_links').insert({
      code: code,
      original_url: originalUrl,
      campaign_id: null,
      organization_id: orgId || null
    }).then(function(res) {
      if (res.error) { cb(originalUrl); return; }
      cb(self.BASE + code);
    });
  },

  shortenAll: function(text, campaignId, orgId, cb) {
    var self = this;
    var matches = (text.match(this._urlRegex) || []).filter(function(u) {
      return u.indexOf('supabase.co') === -1 && u.indexOf('hook-by-lopango') === -1;
    });

    if (!matches.length) { cb(text); return; }

    var done = 0;
    var result = text;

    matches.forEach(function(originalUrl) {
      var code = self._code();
      window.DB.from('short_links').insert({
        code: code,
        original_url: originalUrl,
        campaign_id: campaignId || null,
        organization_id: orgId || null
      }).then(function(res) {
        if (!res.error) result = result.replace(originalUrl, self.BASE + code);
        done++;
        if (done === matches.length) cb(result);
      });
    });
  }

};
