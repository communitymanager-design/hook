var SUPA_URL="https://lzdhipjgguwpqljahogu.supabase.co",SUPA_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6ZGhpcGpnZ3V3cHFsamFob2d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1OTU5MjIsImV4cCI6MjA5NDE3MTkyMn0.OzxZeXaKsjglFJEvhObq9f_oKogcWzKxm1MDOANcypI";window.DB=null,window.initSupabase=function(){window.supabase&&window.supabase.createClient&&(window.DB=window.supabase.createClient(SUPA_URL,SUPA_KEY))},window.HookAuth={user:null,profile:null,init:function(n){window.DB||window.initSupabase();var i=this;window.DB.auth.getSession().then(function(o){var e=o.data&&o.data.session;e&&e.user?(i.user=e.user,i._loadProfile(e.user.id,n)):(i.user=null,i.profile=null,n&&n(null))}),window.DB.auth.onAuthStateChange(function(n,o){o&&o.user?(i.user=o.user,i._loadProfile(o.user.id,function(){})):(i.user=null,i.profile=null)})},_loadProfile:function(n,i){var o=this;window.DB.from("users").select("*").eq("id",n).single().then(function(n){o.profile=n.data||{},i&&i(o.profile)})},isLoggedIn:function(){return!!this.user},role:function(){return this.profile&&this.profile.role?this.profile.role:"client"},isAdmin:function(){var n=this.role();return"admin"===n||"super_admin"===n},isSuperAdmin:function(){return"super_admin"===this.role()},signUp:function(n,i,o,e){window.DB.auth.signUp({email:n,password:i,options:{data:o}}).then(function(n){e(n.error,n.data)})},signIn:function(n,i,o){window.DB.auth.signInWithPassword({email:n,password:i}).then(function(n){o(n.error,n.data)})},signOut:function(n){window.DB.auth.signOut().then(function(i){window.HookAuth.user=null,window.HookAuth.profile=null,n&&n()})},resetPassword:function(n,i){window.DB.auth.resetPasswordForEmail(n,{redirectTo:window.location.origin+window.location.pathname}).then(function(n){i(n.error)})}};
window.HookAuth.isBlocked = function() {
  return !!(this.profile && this.profile.is_blocked);
};

window.PageBlocked = {
  render: function() {
    var main = document.getElementById('main-content');
    var nav  = document.getElementById('navbar-container');
    var adm  = document.getElementById('admin-navbar-container');
    if (nav)  { nav.innerHTML = ''; nav.style.display = 'none'; }
    if (adm)  { adm.style.display = 'none'; }
    if (main) { main.style.marginLeft = '0'; }
    window.Helpers.renderPage(
      '<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:var(--color-bg)">' +
        '<div style="max-width:420px;text-align:center;padding:40px 24px">' +
          '<div style="width:64px;height:64px;background:var(--color-red-bg);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px">' +
            '<svg width="28" height="28" viewBox="0 0 28 28" fill="none"><circle cx="14" cy="14" r="11.5" stroke="var(--color-red)" stroke-width="1.5"/><path d="M8 8l12 12M20 8L8 20" stroke="var(--color-red)" stroke-width="1.5" stroke-linecap="round"/></svg>' +
          '</div>' +
          '<div style="font-size:20px;font-weight:700;margin-bottom:10px;color:var(--color-text-primary)">Compte bloqué</div>' +
          '<div style="font-size:14px;color:var(--color-text-secondary);line-height:1.7;margin-bottom:28px">Votre compte a été bloqué par l\'administration. Veuillez contacter le service client Hook pour régulariser votre situation.</div>' +
          '<button class="btn" id="btn-blocked-logout">Se déconnecter</button>' +
        '</div>' +
      '</div>'
    );
    var btn = document.getElementById('btn-blocked-logout');
    if (btn) btn.addEventListener('click', function() {
      window.HookAuth.signOut(function() { window.Router.navigate('/'); });
    });
  }
};
