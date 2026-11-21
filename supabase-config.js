// Supabase URL + publishable (public) key. These are designed to be public; data is protected by Row Level Security (see schema.sql).
// If Vercel env vars are set (SUPABASE_URL / SUPABASE_ANON_KEY or the NEXT_PUBLIC_ names), /api/config overrides these.
window.CFG={SUPABASE_URL:"https://otldatnfyvonnfizmxce.supabase.co",SUPABASE_ANON_KEY:"sb_publishable_2APp_m8dzG_D3jByrIZsiA_JJxYQX2F"};
window.getSB=async()=>{let c=window.CFG;
try{const r=await fetch("/api/config");if(r.ok){const j=await r.json();if(j.SUPABASE_URL&&j.SUPABASE_ANON_KEY)c=j}}catch(e){}
if(!c.SUPABASE_URL||!c.SUPABASE_ANON_KEY)return null;
return window.supabase.createClient(c.SUPABASE_URL,c.SUPABASE_ANON_KEY)};
