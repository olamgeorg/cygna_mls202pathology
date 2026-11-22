/* © cygna.co - cygna.consult | Cygna MLS202 Pathology Quiz
   Supabase client configuration (hardcoded as requested).
   NOTE: this is a *publishable* (anon) key. It is designed to be public in browser code.
   Your data is protected by the Row Level Security policies in schema.sql, NOT by hiding this key.
   NEVER put your secret / service_role key in this project. */
window.CYGNA_CONFIG = {
  SUPABASE_URL: "https://otldatnfyvonnfizmxce.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_2APp_m8dzG_D3jByrIZsiA_JJxYQX2F"
};

window.sb = null;
(function () {
  try {
    if (window.supabase && window.supabase.createClient) {
      window.sb = window.supabase.createClient(
        window.CYGNA_CONFIG.SUPABASE_URL,
        window.CYGNA_CONFIG.SUPABASE_ANON_KEY,
        { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } }
      );
    }
  } catch (e) {
    console.warn("Supabase client could not start (offline?)", e);
    window.sb = null;
  }
})();
