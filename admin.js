/* © cygna.co - cygna.consult | Cygna MLS202 Pathology Quiz | admin.js */
(function () {
  "use strict";

  /* ===== Hardcoded admin identity (only name + email; NO Supabase secrets here) ===== */
  const APP_NAME = "cygna_mls202pathology";
  const ADMIN_NAME = "Olamide George";
  const ADMIN_EMAIL = "olamgeorg9@gmail.com";
  const STRONG_AT = 60;
  const MODE_LABEL = { practice: "Practice", exam: "Exam", timed: "Timed" };
  const MAX_ROWS = 500;

  const $ = (id) => document.getElementById(id);
  const sb = window.sb;
  const TOPICS = window.TOPICS || [];

  let profiles = [];   // students of this app (admin excluded)
  let results = [];    // all results of this app
  let confirmResolve = null;

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
  function isAdminEmail(e) { return String(e || "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase(); }
  function fmt(sec) { sec = Math.max(0, Math.round(sec || 0)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0"); return h ? h + ":" + mm + ":" + ss : mm + ":" + ss; }
  function fmtDate(iso) { const d = new Date(iso); if (isNaN(d)) return "-"; return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }); }
  function toast(m, ms) { const t = $("toast"); t.textContent = m; t.classList.remove("hidden"); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), ms || 2600); }
  function msg(text) { const el = $("adminMsg"); if (!text) { el.classList.add("hidden"); return; } el.textContent = text; el.classList.remove("hidden"); }
  function confirmBox(title, text) {
    return new Promise((res) => { $("confirmTitle").textContent = title; $("confirmText").textContent = text; confirmResolve = res; $("confirmOverlay").classList.remove("hidden"); });
  }
  function closeConfirm(v) { $("confirmOverlay").classList.add("hidden"); if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(v); } }
  function barClass(p) { return p >= 70 ? "good" : p >= 50 ? "mid" : "bad"; }

  /* ---------- access guard: only ADMIN_EMAIL ---------- */
  async function guard() {
    if (!sb) return leave();
    try {
      const { data } = await sb.auth.getSession();
      const u = data && data.session && data.session.user;
      if (!u || !isAdminEmail(u.email)) return leave();
      $("adminName").textContent = ADMIN_NAME;
      $("gate").classList.add("hidden"); $("adminApp").classList.remove("hidden");
      await loadAll();
    } catch (e) { leave(); }
  }
  function leave() { location.replace("index.html"); }

  /* ---------- data ---------- */
  async function fetchAll(table, build) {
    let out = [], from = 0; const step = 1000;
    for (let guardN = 0; guardN < 20; guardN++) {
      const { data, error } = await build(sb.from(table).select("*")).range(from, from + step - 1);
      if (error) throw error;
      out = out.concat(data || []);
      if (!data || data.length < step) break;
      from += step;
    }
    return out;
  }
  async function loadAll() {
    msg("");
    try {
      const [p, r] = await Promise.all([
        fetchAll("profiles", (q) => q.eq("app_name", APP_NAME).order("created_at", { ascending: false })),
        fetchAll("results", (q) => q.eq("app_name", APP_NAME).order("created_at", { ascending: false }))
      ]);
      profiles = p.filter((x) => !isAdminEmail(x.email));
      results = r;
      renderAll();
    } catch (e) {
      console.error(e);
      msg("Could not load data: " + (e.message || e) + ". Make sure you ran schema.sql in Supabase.");
    }
  }

  /* ---------- aggregates ---------- */
  function aggTopics(rows) {
    const agg = {};
    rows.forEach((r) => { const ts = r.topic_stats || {}; Object.keys(ts).forEach((t) => {
      agg[t] = agg[t] || { correct: 0, total: 0 }; agg[t].correct += Number(ts[t].correct) || 0; agg[t].total += Number(ts[t].total) || 0; }); });
    return agg;
  }
  function renderBars(agg, el, strongEl, weakEl) {
    el.innerHTML = ""; const strong = [], weak = [];
    TOPICS.forEach((t) => {
      const s = agg[t];
      if (!s || !s.total) { el.insertAdjacentHTML("beforeend", '<div class="bar-row"><div class="bar-label"><span>' + esc(t) + '</span><span class="muted">No data</span></div><div class="bar-track"><div class="bar-fill" style="width:0"></div></div></div>'); return; }
      const p = Math.round((s.correct / s.total) * 100);
      (p >= STRONG_AT ? strong : weak).push(t + " (" + p + "%)");
      el.insertAdjacentHTML("beforeend", '<div class="bar-row"><div class="bar-label"><span>' + esc(t) + "</span><span>" + s.correct + "/" + s.total + " · " + p + '%</span></div><div class="bar-track"><div class="bar-fill ' + barClass(p) + '" style="width:' + p + '%"></div></div></div>');
    });
    strongEl.innerHTML = strong.length ? strong.map((x) => "<li>" + esc(x) + "</li>").join("") : "<li class='muted'>None yet</li>";
    weakEl.innerHTML = weak.length ? weak.map((x) => "<li>" + esc(x) + "</li>").join("") : "<li class='muted'>None yet</li>";
  }

  /* ---------- render ---------- */
  function renderAll() {
    $("aStudents").textContent = profiles.length;
    $("aQuizzes").textContent = results.length;
    const avg = results.length ? results.reduce((a, r) => a + Number(r.percentage || 0), 0) / results.length : 0;
    const pass = results.length ? results.filter((r) => String(r.pass_fail).toLowerCase() === "pass").length / results.length * 100 : 0;
    $("aAvg").textContent = Math.round(avg * 10) / 10 + "%"; $("aPass").textContent = Math.round(pass) + "%";
    fillTopicFilter(); fillStudentSelect();
    renderStudents(); renderScores(); renderAnalysis();
  }
  function fillTopicFilter() {
    const sel = $("fTopic"), cur = sel.value;
    sel.innerHTML = '<option value="">All topics</option>' + TOPICS.map((t) => '<option value="' + esc(t) + '">' + esc(t) + "</option>").join("");
    sel.value = cur;
  }
  function fillStudentSelect() {
    const sel = $("studentSelect"), cur = sel.value;
    sel.innerHTML = '<option value="">Select a student…</option>' + profiles.map((p) => '<option value="' + esc(p.id) + '">' + esc((p.full_name || "-") + " (" + p.email + ")") + "</option>").join("");
    sel.value = cur;
  }

  function renderStudents() {
    const q = $("studentSearch").value.trim().toLowerCase();
    const list = profiles.filter((p) => !q || String(p.full_name || "").toLowerCase().includes(q) || String(p.email || "").toLowerCase().includes(q));
    $("studentCount").textContent = list.length + " student(s)";
    const body = $("studentsBody"); body.innerHTML = "";
    if (!list.length) { body.innerHTML = '<tr><td colspan="6" class="muted center">No students found.</td></tr>'; return; }
    list.forEach((p) => {
      const rs = results.filter((r) => r.user_id === p.id);
      const avg = rs.length ? Math.round(rs.reduce((a, r) => a + Number(r.percentage || 0), 0) / rs.length * 10) / 10 : "-";
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>" + esc(p.full_name || "-") + "</td><td>" + esc(p.email) + "</td><td>" + esc(fmtDate(p.created_at)) + "</td><td>" + rs.length + "</td><td>" + avg + (avg === "-" ? "" : "%") +
        '</td><td><div class="btn-row"><button class="btn btn-outline btn-sm" data-act="view">View</button><button class="btn btn-danger btn-sm" data-act="del">Delete</button></div></td>';
      tr.querySelector('[data-act="view"]').onclick = () => { $("studentSelect").value = p.id; showTab("analysis"); renderStudentAnalysis(); };
      tr.querySelector('[data-act="del"]').onclick = () => deleteStudent(p);
      body.appendChild(tr);
    });
  }

  function filteredResults() {
    const q = $("fSearch").value.trim().toLowerCase(), topic = $("fTopic").value, mode = $("fMode").value, from = $("fFrom").value, to = $("fTo").value;
    return results.filter((r) => {
      if (q && !(String(r.full_name || "").toLowerCase().includes(q) || String(r.email || "").toLowerCase().includes(q))) return false;
      if (topic && !((r.topic_stats && r.topic_stats[topic]) || String(r.topics || "").includes(topic))) return false;
      if (mode && r.mode !== mode) return false;
      if (from || to) {
        const d = new Date(r.created_at); if (isNaN(d)) return false;
        const ymd = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        if (from && ymd < from) return false; if (to && ymd > to) return false;
      }
      return true;
    });
  }
  function renderScores() {
    const list = filteredResults(), body = $("scoresBody"); body.innerHTML = "";
    $("scoreCount").textContent = list.length + " result(s)" + (list.length > MAX_ROWS ? " (showing first " + MAX_ROWS + ", CSV has all)" : "");
    if (!list.length) { body.innerHTML = '<tr><td colspan="10" class="muted center">No scores found.</td></tr>'; return; }
    list.slice(0, MAX_ROWS).forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>" + esc(r.full_name) + "</td><td>" + esc(r.email) + "</td><td>" + esc(r.topics) + "</td><td>" + esc(MODE_LABEL[r.mode] || r.mode) + "</td><td>" + r.score + "/" + r.total_questions +
        "</td><td>" + r.percentage + "%</td><td>" + esc(r.grade) + " (" + esc(r.pass_fail) + ")</td><td>" + esc(fmtDate(r.created_at)) + "</td><td class='mono'>" + fmt(r.time_used) +
        '</td><td><button class="btn btn-danger btn-sm">Delete</button></td>';
      tr.querySelector("button").onclick = () => deleteScore(r);
      body.appendChild(tr);
    });
  }
  function renderAnalysis() {
    renderBars(aggTopics(results), $("allTopicBars"), $("allStrong"), $("allWeak"));
    renderStudentAnalysis();
  }
  function renderStudentAnalysis() {
    const id = $("studentSelect").value;
    if (!id) { $("studentTopicBars").innerHTML = '<p class="muted">Pick a student above to see their weak and strong topics.</p>'; $("sStrong").innerHTML = ""; $("sWeak").innerHTML = ""; return; }
    renderBars(aggTopics(results.filter((r) => r.user_id === id)), $("studentTopicBars"), $("sStrong"), $("sWeak"));
  }

  /* ---------- delete ---------- */
  async function deleteScore(r) {
    if (!(await confirmBox("Delete score", "Delete " + r.full_name + "'s score of " + r.percentage + "% (" + fmtDate(r.created_at) + ")?"))) return;
    try {
      const { data, error } = await sb.from("results").delete().eq("id", r.id).eq("app_name", APP_NAME).select("id");
      if (error) throw error;
      if (!data || !data.length) return msg("Nothing was deleted. Run schema.sql so the admin delete policy exists.");
      results = results.filter((x) => x.id !== r.id); renderAll(); toast("Score deleted");
    } catch (e) { msg("Delete failed: " + (e.message || e)); }
  }
  async function deleteStudent(p) {
    if (!(await confirmBox("Delete student", "Delete " + (p.full_name || p.email) + " and ALL their scores from this app? (Their login stays in Supabase Auth until you remove it there.)"))) return;
    try {
      const a = await sb.from("results").delete().eq("user_id", p.id).eq("app_name", APP_NAME).select("id");
      if (a.error) throw a.error;
      const b = await sb.from("profiles").delete().eq("id", p.id).eq("app_name", APP_NAME).select("id");
      if (b.error) throw b.error;
      if (!b.data || !b.data.length) return msg("Student was not deleted. Run schema.sql so the admin delete policy exists.");
      profiles = profiles.filter((x) => x.id !== p.id); results = results.filter((x) => x.user_id !== p.id);
      renderAll(); toast("Student deleted");
    } catch (e) { msg("Delete failed: " + (e.message || e)); }
  }

  /* ---------- CSV export ---------- */
  function csvCell(v) {
    let s = String(v == null ? "" : v);
    if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // block spreadsheet formula injection
    return '"' + s.replace(/"/g, '""') + '"';
  }
  function exportCSV() {
    const list = filteredResults();
    const head = ["Name", "Email", "Topics", "Mode", "Score", "Total Questions", "Percentage", "Grade", "Pass/Fail", "Time Used (sec)", "Time Used", "Date"];
    const rows = list.map((r) => [r.full_name, r.email, r.topics, r.mode, r.score, r.total_questions, r.percentage, r.grade, r.pass_fail, r.time_used, fmt(r.time_used), new Date(r.created_at).toISOString()]);
    const csv = "\uFEFF" + [head].concat(rows).map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" }), a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "cygna_mls202pathology_scores_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast("Exported " + list.length + " row(s)");
  }

  /* ---------- tabs + events ---------- */
  function showTab(name) {
    ["students", "scores", "analysis"].forEach((t) => $("tab-" + t).classList.toggle("hidden", t !== name));
    document.querySelectorAll(".admin-tabs [data-tab]").forEach((b) => { b.classList.toggle("btn-primary", b.dataset.tab === name); b.classList.toggle("btn-outline", b.dataset.tab !== name); });
  }
  function bind() {
    document.querySelectorAll(".admin-tabs [data-tab]").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));
    $("studentSearch").addEventListener("input", renderStudents);
    ["fSearch", "fTopic", "fMode", "fFrom", "fTo"].forEach((id) => { $(id).addEventListener("input", renderScores); $(id).addEventListener("change", renderScores); });
    $("fReset").onclick = () => { ["fSearch", "fTopic", "fMode", "fFrom", "fTo"].forEach((id) => { $(id).value = ""; }); renderScores(); };
    $("studentSelect").addEventListener("change", renderStudentAnalysis);
    $("exportBtn").onclick = exportCSV; $("refreshBtn").onclick = loadAll;
    $("confirmYes").onclick = () => closeConfirm(true); $("confirmNo").onclick = () => closeConfirm(false);
    $("logoutBtn").onclick = async () => { try { if (sb) await sb.auth.signOut(); } catch (e) {} localStorage.removeItem("cygna_mls202pathology_user"); leave(); };
    $("year").textContent = new Date().getFullYear();
  }

  bind(); guard();
})();
