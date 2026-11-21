const APP_NAME="cygna_mls202pathology",ADMIN_NAME="Olamide George",ADMIN_EMAIL="olamgeorg9@gmail.com";
const $=s=>document.querySelector(s),app=$("#app"),LS=(k,v)=>v===undefined?JSON.parse(localStorage.getItem(k)||"null"):localStorage.setItem(k,JSON.stringify(v));
const S=Object.assign({t:"light",bg:"plain",f:"medium"},LS("cy_set")||{});
let sb,user,admin=false,sel=new Set(),mode="practice",cnt="10",Q=[],A=[],qi=0,tmr,left=0,paused=false,t0=0,dip;
const TOP=[...new Set(QS.map(q=>q.topic))];
const sh=a=>{a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const ap=()=>{const d=document.documentElement.dataset;d.t=S.t;d.bg=S.bg;d.f=S.f;LS("cy_set",S)};
const msg=t=>{const e=$("#msg");if(e)e.textContent=t};
const fmt=s=>Math.floor(s/60)+"m "+s%60+"s";

function authV(m="login"){const T={login:"Login",signup:"Sign up",forgot:"Reset password"};
app.innerHTML=`<div class=card><h2>${T[m]}</h2>${m=="signup"?"<input id=nm placeholder='Full name'>":""}<input id=em type=email placeholder=Email>${m=="forgot"?"":"<input id=pw type=password placeholder=Password>"}<button class=btn id=go>${T[m]}</button><p id=msg class=msg></p><p>${m=="login"?"<a id=l1>Create account</a> | <a id=l2>Forgot password?</a>":"<a id=l1>Back to login</a>"}</p></div>`;
$("#l1").onclick=()=>authV(m=="login"?"signup":"login");if($("#l2"))$("#l2").onclick=()=>authV("forgot");
$("#go").onclick=async()=>{if(!sb)return msg("Supabase is not configured. See README.");
const email=$("#em").value.trim(),pw=$("#pw")?$("#pw").value:"",nm=$("#nm")?$("#nm").value.trim():"";
if(!email||(m!="forgot"&&!pw)||(m=="signup"&&!nm))return msg("Fill in all fields.");
if(m=="forgot"){const{error}=await sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin});return msg(error?error.message:"Reset link sent. Check your email.")}
if(m=="signup"){const{data,error}=await sb.auth.signUp({email,password:pw,options:{data:{full_name:nm}}});if(error)return msg(error.message);return data.session?boot(data.user):msg("Account created. Confirm via email, then log in.")}
const{data,error}=await sb.auth.signInWithPassword({email,password:pw});error?msg(error.message):boot(data.user)}}

async function boot(u){user=u;admin=(u.email||"").toLowerCase()===ADMIN_EMAIL.toLowerCase();
let{data:p}=await sb.from("profiles").select("*").eq("id",u.id).maybeSingle();
if(!p){p={id:u.id,full_name:admin?ADMIN_NAME:((u.user_metadata&&u.user_metadata.full_name)||u.email),email:u.email,role:admin?"admin":"student",app_name:APP_NAME};await sb.from("profiles").insert(p)}
if(!admin&&p.app_name!==APP_NAME){await sb.auth.signOut();authV();return msg("This account is not for MLS202 Pathology")}
user.name=admin?ADMIN_NAME:p.full_name;home()}

function home(){clearInterval(tmr);const cn=t=>QS.filter(q=>q.topic==t).length;
app.innerHTML=`<div class=card><h2>Welcome, ${user.name}${admin?" (Admin)":""}</h2><p>Pick topics, a mode and the number of questions.</p>
<div class=row><button class=btn2 id=sa>Select All</button><button class=btn2 id=ca>Clear All</button></div>
${TOP.map(t=>`<label class=tp><input type=checkbox data-t="${t}" ${sel.has(t)?"checked":""}> ${t} (${cn(t)} questions)</label>`).join("")}
<h3>Mode</h3><select id=md><option value=practice>Practice: answers shown instantly</option><option value=exam>Exam: timed, answers at the end</option><option value=track>Track: 60 seconds per question</option></select>
<h3>Number of questions</h3><select id=ct>${["10","20","30","50","100","All"].map(x=>`<option>${x}</option>`).join("")}</select>
<button class=btn id=st>Start Quiz</button></div>
<div class=row><button class=btn2 id=ms>My Scores</button>${admin?"<button class=btn2 id=ad>Admin</button>":""}<button class=btn2 id=lo>Log out</button></div>`;
$("#md").value=mode;$("#ct").value=cnt;
const cb=()=>document.querySelectorAll("[data-t]");
cb().forEach(c=>c.onchange=()=>c.checked?sel.add(c.dataset.t):sel.delete(c.dataset.t));
$("#sa").onclick=()=>{TOP.forEach(t=>sel.add(t));cb().forEach(c=>c.checked=true)};
$("#ca").onclick=()=>{sel.clear();cb().forEach(c=>c.checked=false)};
$("#md").onchange=e=>mode=e.target.value;$("#ct").onchange=e=>cnt=e.target.value;
$("#st").onclick=start;$("#ms").onclick=scoresV;
if($("#ad"))$("#ad").onclick=()=>location.href="admin.html";
$("#lo").onclick=async()=>{await sb.auth.signOut();user=null;admin=false;authV()}}

function start(){const pool=QS.filter(q=>sel.has(q.topic));if(!pool.length)return alert("Select at least one topic.");
const n=cnt=="All"?pool.length:Math.min(+cnt,pool.length);
Q=sh(pool).slice(0,n).map(q=>{const c=q.options[q.correctAnswer],o=sh(q.options);return{...q,options:o,correctAnswer:o.indexOf(c)}});
A=Q.map(()=>null);qi=0;t0=Date.now();left=mode=="exam"?n*60:60;paused=false;show();tick()}

function tm(){const e=$("#tm");if(e)e.textContent=mode=="practice"?"":"Time "+Math.floor(left/60)+":"+String(left%60).padStart(2,"0")}
function tick(){clearInterval(tmr);if(mode=="practice")return;
tmr=setInterval(()=>{if(paused)return;left--;tm();if(left<=0){if(mode=="track"&&qi<Q.length-1){qi++;left=60;show()}else finish()}},1000)}
function go(n){qi=n;if(mode=="track")left=60;show()}

function show(){const q=Q[qi],a=A[qi],pr=mode=="practice"&&a!==null;
app.innerHTML=`<div class=card><div class=row><b>Question ${qi+1} of ${Q.length}</b><span id=tm></span><button class=btn2 id=pz style="flex:0">${paused?"Resume":"Pause"}</button></div><div class=bar><i style="width:${(qi+1)/Q.length*100}%"></i></div><small>${q.topic} | ${q.difficulty}</small><h3>${q.question}</h3>
${q.options.map((o,i)=>`<button class="opt ${pr?(i==q.correctAnswer?"ok":i==a?"bad":""):a==i?"sel":""}" data-i="${i}" ${paused?"disabled":""}>${"ABCD"[i]}. ${o}</button>`).join("")}
${pr?`<p class=ex>${q.explanation}</p>`:""}
<div class=row><button class=btn2 id=pv ${qi==0?"disabled":""}>Previous</button><button class=btn2 id=sk>Skip</button>${qi==Q.length-1?"<button class=btn2 id=sbm style='background:var(--ac);color:#fff'>Submit</button>":"<button class=btn2 id=nx>Next</button>"}</div></div>`;
tm();
document.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{if(mode=="practice"&&A[qi]!==null)return;A[qi]=+b.dataset.i;show()});
$("#pz").onclick=()=>{paused=!paused;show()};
$("#pv").onclick=()=>go(qi-1);
$("#sk").onclick=()=>{A[qi]=null;qi<Q.length-1?go(qi+1):finish()};
if($("#nx"))$("#nx").onclick=()=>go(qi+1);
if($("#sbm"))$("#sbm").onclick=()=>{const sk=A.filter(x=>x===null).length;if(!sk||confirm(sk+" question(s) unanswered. Submit anyway?"))finish()}}

async function finish(){clearInterval(tmr);let c=0,w=0,s=0;const ts={};
Q.forEach((q,i)=>{const t=ts[q.topic]||(ts[q.topic]={c:0,n:0});t.n++;if(A[i]===null)s++;else if(A[i]==q.correctAnswer){c++;t.c++}else w++});
const pc=Math.round(c/Q.length*100),g=pc>=70?"A":pc>=60?"B":pc>=50?"C":pc>=45?"D":"F";
const r={user_id:user.id,full_name:user.name,email:user.email,app_name:APP_NAME,topics:[...new Set(Q.map(q=>q.topic))].join(", "),mode,score:c,total_questions:Q.length,percentage:pc,grade:g,pass_fail:pc>=50?"Pass":"Fail",time_used:Math.round((Date.now()-t0)/1000),topic_stats:ts};
const h=LS("cy_h_"+user.id)||[];h.unshift({...r,created_at:new Date().toISOString()});LS("cy_h_"+user.id,h);
let saved="Saved to this device.";try{const{error}=await sb.from("results").insert(r);saved=error?"Saved on this device only (online save failed).":"Saved online and on this device."}catch(e){}
app.innerHTML=`<div class=card style="text-align:center"><h2>Result</h2><div class=ring style="background:conic-gradient(${pc>=50?"var(--ok)":"var(--no)"} ${pc*3.6}deg,var(--bd) 0)"><div>${pc}%</div></div>
<h3>${c} / ${Q.length} | Grade ${g} | ${r.pass_fail}</h3><div class=stat><div>Correct<br><b>${c}</b></div><div>Wrong<br><b>${w}</b></div><div>Skipped<br><b>${s}</b></div><div>Time used<br><b>${fmt(r.time_used)}</b></div></div><small>${saved}</small>
<div class=row><button class=btn2 id=rt>Retake</button><button class=btn2 id=nq>New Quiz</button><button class=btn2 id=gh>Go Home</button></div></div>
<div class=card><h3>Review</h3>${Q.map((q,i)=>`<p><b>${i+1}. ${q.question}</b><br>Your answer: ${A[i]===null?"Skipped":q.options[A[i]]}<br>Correct: <b>${q.options[q.correctAnswer]}</b><br><small>${q.explanation} (${q.source})</small></p>`).join("")}</div>`;
$("#rt").onclick=start;$("#nq").onclick=home;$("#gh").onclick=home}

function scoresV(){const h=LS("cy_h_"+user.id)||[],n=h.length,avg=n?Math.round(h.reduce((a,r)=>a+r.percentage,0)/n):0,best=n?Math.max(...h.map(r=>r.percentage)):0;
const ts={};h.forEach(r=>Object.entries(r.topic_stats||{}).forEach(([k,v])=>{const t=ts[k]||(ts[k]={c:0,n:0});t.c+=v.c;t.n+=v.n}));
app.innerHTML=`<div class=card><h2>My Scores</h2><div class=stat><div>Quizzes taken<br><b>${n}</b></div><div>Average<br><b>${avg}%</b></div><div>Best<br><b>${best}%</b></div><div>Last<br><b>${n?h[0].percentage+"%":"-"}</b></div></div>
<h3>Topics: strong and weak</h3>${Object.keys(ts).length?Object.entries(ts).map(([k,v])=>{const p=Math.round(v.c/v.n*100);return`<p>${k}: ${p}% (${p>=60?"strong":"weak"})</p><div class=bar><i style="width:${p}%"></i></div>`}).join(""):"<p>Take a quiz to see your topic strengths.</p>"}
<h3>History</h3><div class=sc><table><tr><th>Date</th><th>Topics</th><th>Mode</th><th>Score</th><th>Total</th><th>Time</th></tr>${h.map(r=>`<tr><td>${new Date(r.created_at).toLocaleDateString()}</td><td>${r.topics}</td><td>${r.mode}</td><td>${r.score} (${r.percentage}%)</td><td>${r.total_questions}</td><td>${fmt(r.time_used)}</td></tr>`).join("")}</table></div>
<div class=row><button class=btn2 id=ch>Clear History</button><button class=btn2 id=bk>Back</button></div></div>`;
$("#ch").onclick=()=>{if(confirm("Clear history on this device?")){LS("cy_h_"+user.id,[]);scoresV()}};$("#bk").onclick=home}

function setV(){const o=(a,k)=>a.map(x=>`<option ${S[k]==x?"selected":""}>${x}</option>`).join("");
app.innerHTML=`<div class=card><h2>Settings</h2><h3>Theme</h3><select id=s1>${o(["light","dark","green","blue","purple","pink","orange","amoled"],"t")}</select><h3>Background</h3><select id=s2>${o(["plain","gradient","pattern","image"],"bg")}</select><h3>Font size</h3><select id=s3>${o(["small","medium","large"],"f")}</select><button class=btn id=bk>Back</button></div>`;
$("#s1").onchange=e=>{S.t=e.target.value;ap()};$("#s2").onchange=e=>{S.bg=e.target.value;ap()};$("#s3").onchange=e=>{S.f=e.target.value;ap()};
$("#bk").onclick=()=>user?home():authV()}

(async()=>{ap();$("#nav-s").onclick=setV;
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();dip=e;$("#ib").hidden=false});$("#ib").onclick=()=>dip&&dip.prompt();
if("serviceWorker"in navigator)navigator.serviceWorker.register("sw.js");
sb=await getSB();if(!sb)return authV();
sb.auth.onAuthStateChange(e=>{if(e=="PASSWORD_RECOVERY"){const p=prompt("Enter a new password (6+ characters)");if(p)sb.auth.updateUser({password:p}).then(r=>alert(r.error?r.error.message:"Password updated."))}});
const{data:{session}}=await sb.auth.getSession();session?boot(session.user):authV()})();
