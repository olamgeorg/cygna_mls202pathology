const APP_NAME="cygna_mls202pathology",ADMIN_NAME="Olamide George",ADMIN_EMAIL="olamgeorg9@gmail.com";
(async()=>{const d=(JSON.parse(localStorage.getItem("cy_set")||"{}"));const D=document.documentElement.dataset;D.t=d.t||"light";D.bg=d.bg||"plain";D.f=d.f||"medium";
const sb=await getSB();if(!sb)return location.replace("index.html");
const{data:{session}}=await sb.auth.getSession();
if(!session||(session.user.email||"").toLowerCase()!==ADMIN_EMAIL.toLowerCase())return location.replace("index.html");
const $=s=>document.querySelector(s),f={q:"",t:"",m:"",d:""};let P=[],R=[];
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const TOP=[...new Set(QS.map(q=>q.topic))];
async function load(){P=(await sb.from("profiles").select("*").eq("app_name",APP_NAME).order("created_at",{ascending:false})).data||[];
R=(await sb.from("results").select("*").eq("app_name",APP_NAME).order("created_at",{ascending:false})).data||[];draw()}
const rows=()=>R.filter(r=>(!f.q||(r.full_name+" "+r.email).toLowerCase().includes(f.q))&&(!f.t||(r.topics||"").includes(f.t))&&(!f.m||r.mode==f.m)&&(!f.d||(r.created_at||"").slice(0,10)==f.d));
function skel(){$("#adm").innerHTML=`<div class=card><h2>Admin: ${ADMIN_NAME}</h2><div class=stat><div>Students registered<br><b id=n1></b></div><div>Quizzes taken<br><b id=n2></b></div></div></div>
<div class=card><h3>Students</h3><div class=sc id=st></div></div>
<div class=card><h3>Scores</h3><input id=fq placeholder="Search name or email"><select id=ft><option value="">All topics</option>${TOP.map(t=>`<option>${t}</option>`).join("")}</select><select id=fm><option value="">All modes</option><option>practice</option><option>exam</option><option>track</option></select><input id=fd type=date><button class=btn id=ex>Export CSV</button><div class=sc id=sc></div></div>
<div class=card><h3>Weak and strong topics (for the filtered results above)</h3><div id=wk></div></div>`;
$("#fq").oninput=e=>{f.q=e.target.value.toLowerCase();draw()};$("#ft").onchange=e=>{f.t=e.target.value;draw()};$("#fm").onchange=e=>{f.m=e.target.value;draw()};$("#fd").onchange=e=>{f.d=e.target.value;draw()};
$("#ex").onclick=csv}
function draw(){if(!$("#st"))skel();const rs=rows();$("#n1").textContent=P.length;$("#n2").textContent=R.length;
$("#st").innerHTML=`<table><tr><th>Name</th><th>Email</th><th>Joined</th><th></th></tr>${P.map(p=>`<tr><td>${esc(p.full_name)}</td><td>${esc(p.email)}</td><td>${new Date(p.created_at).toLocaleDateString()}</td><td>${(p.email||"").toLowerCase()==ADMIN_EMAIL.toLowerCase()?"":`<button class=btn2 data-ds="${p.id}">Delete</button>`}</td></tr>`).join("")}</table>`;
$("#sc").innerHTML=`<table><tr><th>Name</th><th>Email</th><th>Topics</th><th>Mode</th><th>Score</th><th>%</th><th>Grade</th><th>Date</th><th>Time</th><th></th></tr>${rs.map(r=>`<tr><td>${esc(r.full_name)}</td><td>${esc(r.email)}</td><td>${esc(r.topics)}</td><td>${r.mode}</td><td>${r.score}/${r.total_questions}</td><td>${r.percentage}</td><td>${r.grade}</td><td>${new Date(r.created_at).toLocaleString()}</td><td>${r.time_used}s</td><td><button class=btn2 data-dr="${r.id}">Delete</button></td></tr>`).join("")}</table>`;
const ts={};rs.forEach(r=>Object.entries(r.topic_stats||{}).forEach(([k,v])=>{const t=ts[k]||(ts[k]={c:0,n:0});t.c+=v.c;t.n+=v.n}));
$("#wk").innerHTML=Object.keys(ts).length?Object.entries(ts).map(([k,v])=>{const p=Math.round(v.c/v.n*100);return`<p>${esc(k)}: ${p}% (${p>=60?"strong":"weak"})</p><div class=bar><i style="width:${p}%"></i></div>`}).join(""):"<p>No topic data yet.</p>";
document.querySelectorAll("[data-ds]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this student and their scores?"))return;await sb.from("results").delete().eq("user_id",b.dataset.ds).eq("app_name",APP_NAME);await sb.from("profiles").delete().eq("id",b.dataset.ds);load()});
document.querySelectorAll("[data-dr]").forEach(b=>b.onclick=async()=>{if(!confirm("Delete this score?"))return;await sb.from("results").delete().eq("id",b.dataset.dr);load()})}
function csv(){const h=["Name","Email","Topics","Mode","Score","Total","Percent","Grade","Pass/Fail","Date","TimeSeconds"];
const l=rows().map(r=>[r.full_name,r.email,r.topics,r.mode,r.score,r.total_questions,r.percentage,r.grade,r.pass_fail,r.created_at,r.time_used].map(x=>'"'+String(x==null?"":x).replace(/"/g,'""')+'"').join(","));
const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([[h.join(","),...l].join("\n")],{type:"text/csv"}));a.download="mls202_scores.csv";a.click()}
load()})();
