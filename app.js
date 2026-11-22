/* © cygna.co - cygna.consult | Cygna MLS202 Pathology Quiz | app.js (Vanilla JS) */
(function () {
  "use strict";

  /* ================= CONSTANTS ================= */
  const APP_NAME = "cygna_mls202pathology";
  const ADMIN_NAME = "Olamide George";
  const ADMIN_EMAIL = "olamgeorg9@gmail.com";
  const PASS_MARK = 50;
  const SECS_PER_Q = 60;
  const STRONG_AT = 60; // topic % at or above = strong, below = weak

  const LS_SETTINGS = "cygna_mls202pathology_settings";
  const LS_RESULTS = "cygna_mls202pathology_results";
  const LS_USER = "cygna_mls202pathology_user";
  const LS_CLEARED = "cygna_mls202pathology_cleared";

  const $ = (id) => document.getElementById(id);
  const sb = window.sb;
  const QUESTIONS = window.QUESTIONS || [];
  const TOPICS = window.TOPICS || [];
  const MODE_LABEL = { practice: "Practice", exam: "Exam", timed: "Timed" };

  /* ================= STATE ================= */
  let user = null; // {id,email,name,isAdmin}
  let selectedTopics = new Set();
  let cfg = { count: "30", mode: "practice" };
  let quiz = null;
  let timerId = null;
  let deferredInstall = null;
  let confirmResolve = null;
  let reviewFilter = "all";
  let lastResult = null;

  /* ================= HELPERS ================= */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function shuffle(a) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function readJSON(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function writeJSON(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function fmt(sec) {
    sec = Math.max(0, Math.round(sec || 0));
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
    return h ? h + ":" + mm + ":" + ss : mm + ":" + ss;
  }
  function gradeOf(p) { return p >= 70 ? "A" : p >= 60 ? "B" : p >= 50 ? "C" : p >= 45 ? "D" : "F"; }
  function fmtDate(iso) {
    const d = new Date(iso); if (isNaN(d)) return "-";
    return d.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) + " " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  function toast(msg, ms) {
    const t = $("toast"); t.textContent = msg; t.classList.remove("hidden");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add("hidden"), ms || 2600);
  }
  function isAdminEmail(e) { return String(e || "").trim().toLowerCase() === ADMIN_EMAIL.toLowerCase(); }
  function confirmBox(title, text, yes) {
    return new Promise((res) => {
      $("confirmTitle").textContent = title; $("confirmText").textContent = text;
      $("confirmYes").textContent = yes || "Yes"; confirmResolve = res;
      $("confirmOverlay").classList.remove("hidden");
    });
  }
  function closeConfirm(v) { $("confirmOverlay").classList.add("hidden"); if (confirmResolve) { const r = confirmResolve; confirmResolve = null; r(v); } }

  /* ================= SETTINGS ================= */
  function getSettings() { return Object.assign({ theme: "light", bg: "plain", font: "medium" }, readJSON(LS_SETTINGS, {})); }
  function applySettings() {
    const s = getSettings(), r = document.documentElement;
    r.setAttribute("data-theme", s.theme); r.setAttribute("data-bg", s.bg); r.setAttribute("data-font", s.font);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) { const c = getComputedStyle(r).getPropertyValue("--primary").trim(); if (c) meta.setAttribute("content", c); }
    document.querySelectorAll("#themeGrid .theme-swatch").forEach((b) => b.classList.toggle("active", b.dataset.theme === s.theme));
    document.querySelectorAll("#bgGrid .chip").forEach((b) => b.classList.toggle("active", b.dataset.bg === s.bg));
    document.querySelectorAll("#fontGrid .chip").forEach((b) => b.classList.toggle("active", b.dataset.font === s.font));
  }
  function setSetting(k, v) { const s = getSettings(); s[k] = v; writeJSON(LS_SETTINGS, s); applySettings(); }

  /* ================= SCREENS ================= */
  function showScreen(name) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.add("hidden"));
    const el = $("screen-" + name); if (el) el.classList.remove("hidden");
    $("userBar").classList.toggle("hidden", !user || name === "auth");
    window.scrollTo(0, 0);
  }

  /* ================= AUTH UI ================= */
  function authMsg(text, type) {
    const el = $("authMsg");
    if (!text) { el.classList.add("hidden"); el.textContent = ""; return; }
    el.className = "notice " + (type === "bad" ? "notice-bad" : type === "ok" ? "notice-ok" : "notice-warn");
    el.textContent = text; el.classList.remove("hidden");
  }
  function authView(v) {
    $("loginForm").classList.toggle("hidden", v !== "login");
    $("signupForm").classList.toggle("hidden", v !== "signup");
    $("forgotForm").classList.toggle("hidden", v !== "forgot");
    $("resetForm").classList.toggle("hidden", v !== "reset");
    document.querySelector(".tabs").classList.toggle("hidden", v === "forgot" || v === "reset");
    $("tabLogin").classList.toggle("active", v === "login");
    $("tabSignup").classList.toggle("active", v === "signup");
    authMsg("");
  }
  function showAuth() { user = null; stopTimer(); quiz = null; showScreen("auth"); authView("login"); }
  function setBusy(btn, busy, label) { btn.disabled = busy; if (label) btn.textContent = busy ? "Please wait…" : label; }

  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

  async function establishUser(authUser, nameHint) {
    const email = String(authUser.email || "").toLowerCase();
    const isAdmin = isAdminEmail(email);
    let profile = null;
    try {
      const sel = await sb.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
      if (sel.error) throw sel.error;
      profile = sel.data;
      if (!profile) {
        const name = isAdmin ? ADMIN_NAME : (nameHint || (authUser.user_metadata && authUser.user_metadata.full_name) || email.split("@")[0]);
        const row = { id: authUser.id, full_name: name, email: email, role: isAdmin ? "admin" : "student", app_name: APP_NAME };
        const ins = await sb.from("profiles").insert(row).select().maybeSingle();
        if (ins.error && ins.error.code !== "23505") throw ins.error;
        profile = ins.data || row;
        if (ins.error && ins.error.code === "23505") {
          const again = await sb.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
          if (again.data) profile = again.data;
        }
      }
    } catch (e) {
      console.warn("Profile check failed", e);
      const cached = readJSON(LS_USER, null);
      if (cached && cached.id === authUser.id) { profile = { full_name: cached.name, app_name: APP_NAME }; }
      else if (isAdmin) { profile = { full_name: ADMIN_NAME, app_name: APP_NAME }; }
      else { showAuth(); authMsg("Could not verify your account. Check your connection and try again.", "bad"); return false; }
    }
    // Block accounts that belong to another app (admin bypasses)
    if (!isAdmin && profile.app_name !== APP_NAME) {
      try { await sb.auth.signOut(); } catch (e) {}
      localStorage.removeItem(LS_USER);
      showAuth(); authMsg("This account is not for MLS202 Pathology", "bad");
      return false;
    }
    user = { id: authUser.id, email: email, name: profile.full_name || (isAdmin ? ADMIN_NAME : email.split("@")[0]), isAdmin: isAdmin };
    writeJSON(LS_USER, user);
    enterHome();
    syncResults();
    return true;
  }

  function useCachedUser() {
    const c = readJSON(LS_USER, null);
    if (c && c.id && c.email) {
      user = { id: c.id, email: c.email, name: c.name, isAdmin: isAdminEmail(c.email) };
      enterHome(); return true;
    }
    return false;
  }

  async function onLogin(e) {
    e.preventDefault();
    const email = $("loginEmail").value.trim().toLowerCase(), pw = $("loginPassword").value;
    if (!validEmail(email) || !pw) return authMsg("Enter your email and password.", "bad");
    if (!sb) return authMsg("Cannot reach the server. Connect to the internet for first login.", "bad");
    setBusy($("loginBtn"), true, "Login");
    try {
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pw });
      if (error) { authMsg(error.message, "bad"); return; }
      await establishUser(data.user);
    } catch (err) { authMsg("Network error. Please try again.", "bad"); }
    finally { setBusy($("loginBtn"), false, "Login"); }
  }

  async function onSignup(e) {
    e.preventDefault();
    const name = $("signupName").value.trim(), email = $("signupEmail").value.trim().toLowerCase(), pw = $("signupPassword").value;
    if (name.length < 2) return authMsg("Please enter your full name.", "bad");
    if (!validEmail(email)) return authMsg("Please enter a valid email.", "bad");
    if (pw.length < 6) return authMsg("Password must be at least 6 characters.", "bad");
    if (!sb) return authMsg("Cannot reach the server. Connect to the internet to sign up.", "bad");
    setBusy($("signupBtn"), true, "Create Account");
    try {
      const { data, error } = await sb.auth.signUp({
        email, password: pw,
        options: { data: { full_name: name, app_name: APP_NAME }, emailRedirectTo: location.origin + location.pathname }
      });
      if (error) { authMsg(error.message, "bad"); return; }
      if (data.user && data.user.identities && data.user.identities.length === 0) {
        authView("login"); $("loginEmail").value = email;
        return authMsg("This email is already registered. Please login.", "warn");
      }
      if (data.session) { await establishUser(data.user, name); }
      else { authView("login"); $("loginEmail").value = email; authMsg("Account created. Check your email to confirm, then login.", "ok"); }
    } catch (err) { authMsg("Network error. Please try again.", "bad"); }
    finally { setBusy($("signupBtn"), false, "Create Account"); }
  }

  async function onForgot(e) {
    e.preventDefault();
    const email = $("forgotEmail").value.trim().toLowerCase();
    if (!validEmail(email)) return authMsg("Enter a valid email.", "bad");
    if (!sb) return authMsg("Cannot reach the server.", "bad");
    setBusy($("forgotBtn"), true, "Send Reset Link");
    try {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
      if (error) authMsg(error.message, "bad"); else authMsg("If that email exists, a reset link has been sent.", "ok");
    } catch (err) { authMsg("Network error. Please try again.", "bad"); }
    finally { setBusy($("forgotBtn"), false, "Send Reset Link"); }
  }

  async function onReset(e) {
    e.preventDefault();
    const pw = $("newPassword").value;
    if (pw.length < 6) return authMsg("Password must be at least 6 characters.", "bad");
    setBusy($("resetBtn"), true, "Update Password");
    try {
      const { data, error } = await sb.auth.updateUser({ password: pw });
      if (error) return authMsg(error.message, "bad");
      history.replaceState(null, "", location.pathname);
      toast("Password updated");
      await establishUser(data.user);
    } catch (err) { authMsg("Network error. Please try again.", "bad"); }
    finally { setBusy($("resetBtn"), false, "Update Password"); }
  }

  async function logout() {
    try { if (sb) await sb.auth.signOut(); } catch (e) {}
    localStorage.removeItem(LS_USER);
    showAuth(); toast("Logged out");
  }

  /* ================= LOCAL RESULTS ================= */
  function allLocal() { return readJSON(LS_RESULTS, []); }
  function saveLocal(a) { writeJSON(LS_RESULTS, a); }
  function clearedAt() { const m = readJSON(LS_CLEARED, {}); return (user && m[user.id]) || ""; }
  function myResults() {
    if (!user) return [];
    const c = clearedAt();
    return allLocal().filter((r) => r.user_id === user.id && (!c || r.created_at > c))
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  function dbPayload(r) {
    return {
      user_id: r.user_id, full_name: r.full_name, email: r.email, app_name: APP_NAME, topics: r.topics, mode: r.mode,
      score: r.score, total_questions: r.total_questions, percentage: r.percentage, grade: r.grade, pass_fail: r.pass_fail,
      time_used: r.time_used, topic_stats: r.topic_stats, created_at: r.created_at
    };
  }
  async function pushResult(r) {
    if (!sb || !user || !navigator.onLine) return false;
    try {
      const { data, error } = await sb.from("results").insert(dbPayload(r)).select("id").maybeSingle();
      if (error) throw error;
      const all = allLocal(), i = all.findIndex((x) => x.local_id === r.local_id);
      if (i > -1) { all[i].synced = true; if (data && data.id) all[i].id = data.id; saveLocal(all); }
      return true;
    } catch (e) { console.warn("Result sync failed", e); return false; }
  }
  async function syncResults() {
    if (!sb || !user || !navigator.onLine) return;
    const pending = allLocal().filter((r) => r.user_id === user.id && !r.synced);
    for (const r of pending) await pushResult(r);
    try {
      const { data, error } = await sb.from("results").select("*").eq("user_id", user.id).eq("app_name", APP_NAME)
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const all = allLocal();
      const others = all.filter((r) => r.user_id !== user.id);
      const unsynced = all.filter((r) => r.user_id === user.id && !r.synced);
      const fromDb = (data || []).map((r) => Object.assign({}, r, { local_id: "db_" + r.id, synced: true }));
      saveLocal(others.concat(unsynced, fromDb));
      if (!$("screen-home").classList.contains("hidden")) renderHomeStats();
    } catch (e) { console.warn("History pull failed", e); }
  }

  /* ================= HOME ================= */
  function enterHome() {
    $("welcomeName").textContent = user.name;
    $("homeName").textContent = user.name;
    $("adminBadge").classList.toggle("hidden", !user.isAdmin);
    $("adminLink").classList.toggle("hidden", !user.isAdmin);
    renderTopics(); renderHomeStats(); showScreen("home");
  }
  function renderHomeStats() {
    $("homeTotalQ").textContent = QUESTIONS.length;
    $("homeTaken").textContent = myResults().length;
  }
  function topicCount(t) { return QUESTIONS.filter((q) => q.topic === t).length; }
  function renderTopics() {
    const box = $("topicList"); box.innerHTML = "";
    TOPICS.forEach((t, i) => {
      const lab = document.createElement("label");
      lab.className = "topic-item" + (selectedTopics.has(t) ? " checked" : "");
      lab.innerHTML = '<input type="checkbox" value="' + i + '"' + (selectedTopics.has(t) ? " checked" : "") + '>' +
        '<span class="topic-name">' + esc(t) + '</span><span class="topic-count">(' + topicCount(t) + ')</span>';
      lab.querySelector("input").addEventListener("change", (e) => {
        if (e.target.checked) selectedTopics.add(t); else selectedTopics.delete(t);
        lab.classList.toggle("checked", e.target.checked); updateSelection();
      });
      box.appendChild(lab);
    });
    updateSelection();
  }
  function updateSelection() {
    const pool = QUESTIONS.filter((q) => selectedTopics.has(q.topic)).length;
    $("selTopicCount").textContent = selectedTopics.size; $("selQuestionPool").textContent = pool;
  }
  function setAllTopics(on) {
    selectedTopics = new Set(on ? TOPICS : []); renderTopics(); $("homeMsg").classList.add("hidden");
  }

  /* ================= QUIZ ENGINE ================= */
  function buildQuestion(q) {
    const idx = shuffle([0, 1, 2, 3]);
    return { id: q.id, topic: q.topic, text: q.question, opts: idx.map((i) => q.options[i]), correct: idx.indexOf(q.correctAnswer),
      expl: q.explanation, diff: q.difficulty, source: q.source };
  }
  function startQuiz(opts) {
    let pool;
    if (opts.ids) { const set = new Set(opts.ids); pool = QUESTIONS.filter((q) => set.has(q.id)); }
    else {
      pool = QUESTIONS.filter((q) => opts.topics.indexOf(q.topic) > -1);
      const n = opts.count === "all" ? pool.length : Math.min(parseInt(opts.count, 10), pool.length);
      pool = shuffle(pool).slice(0, n);
    }
    pool = shuffle(pool);
    quiz = {
      mode: opts.mode, topics: opts.topics, count: opts.count, ids: pool.map((q) => q.id),
      qs: pool.map(buildQuestion), answers: new Array(pool.length).fill(null),
      idx: 0, secs: 0, qLeft: SECS_PER_Q, paused: false
    };
    $("qModeTag").textContent = MODE_LABEL[quiz.mode] + " Mode";
    $("timerBox").classList.toggle("hidden", quiz.mode === "practice");
    $("pauseBtn").classList.toggle("hidden", quiz.mode !== "timed");
    $("prevBtn").classList.toggle("hidden", quiz.mode === "timed");
    showScreen("quiz"); renderQuestion(); startTimer();
  }
  function startTimer() {
    stopTimer(); updateTimerText();
    timerId = setInterval(tick, 1000);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function tick() {
    if (!quiz || quiz.paused) return;
    quiz.secs++;
    if (quiz.mode === "timed") { quiz.qLeft--; if (quiz.qLeft <= 0) { autoAdvance(); return; } }
    updateTimerText();
  }
  function updateTimerText() {
    if (!quiz) return;
    const tb = $("timerBox");
    if (quiz.mode === "timed") { $("timerText").textContent = fmt(quiz.qLeft); tb.classList.toggle("low", quiz.qLeft <= 10); }
    else { $("timerText").textContent = fmt(quiz.secs); tb.classList.remove("low"); }
  }
  function autoAdvance() {
    if (quiz.answers[quiz.idx] === null) quiz.answers[quiz.idx] = -1;
    if (quiz.idx < quiz.qs.length - 1) { quiz.idx++; quiz.qLeft = SECS_PER_Q; renderQuestion(); updateTimerText(); }
    else finishQuiz();
  }
  function renderQuestion() {
    const q = quiz.qs[quiz.idx], n = quiz.qs.length, ans = quiz.answers[quiz.idx];
    $("qNum").textContent = "Question " + (quiz.idx + 1) + " / " + n;
    $("progressFill").style.width = ((quiz.idx + 1) / n * 100) + "%";
    $("qTopic").textContent = q.topic; $("qDiff").textContent = q.diff;
    $("questionText").textContent = q.text;
    const box = $("options"); box.innerHTML = "";
    const locked = quiz.mode === "practice" && typeof ans === "number" && ans >= 0;
    q.opts.forEach((t, i) => {
      const b = document.createElement("button");
      b.type = "button"; b.className = "option-btn";
      b.innerHTML = '<span class="option-letter">' + "ABCD"[i] + '</span><span class="option-text">' + esc(t) + "</span>";
      if (locked) {
        b.disabled = true;
        if (i === q.correct) b.classList.add("correct");
        else if (i === ans) b.classList.add("wrong");
      } else if (ans === i) b.classList.add("selected");
      b.addEventListener("click", () => selectOption(i));
      box.appendChild(b);
    });
    const fb = $("feedback");
    if (locked) showFeedback(q, ans); else fb.classList.add("hidden");
    const last = quiz.idx === n - 1;
    $("prevBtn").disabled = quiz.idx === 0;
    $("nextBtn").classList.toggle("hidden", last);
    $("submitBtn").classList.toggle("hidden", !last);
    const answered = quiz.answers.filter((a) => typeof a === "number" && a >= 0).length;
    $("answeredInfo").textContent = answered + " of " + n + " answered";
  }
  function showFeedback(q, ans) {
    const ok = ans === q.correct, fb = $("feedback");
    fb.className = "feedback " + (ok ? "good" : "bad");
    fb.innerHTML = "<strong>" + (ok ? "✔ Correct!" : "✘ Wrong. Correct answer: " + "ABCD"[q.correct] + ". " + esc(q.opts[q.correct])) + "</strong>" +
      "<div>" + esc(q.expl) + '</div><span class="src">Source: ' + esc(q.source) + "</span>";
  }
  function selectOption(i) {
    const q = quiz.qs[quiz.idx];
    if (quiz.mode === "practice") {
      const cur = quiz.answers[quiz.idx];
      if (typeof cur === "number" && cur >= 0) return;
      quiz.answers[quiz.idx] = i; renderQuestion();
      $("feedback").scrollIntoView({ behavior: "smooth", block: "nearest" });
    } else { quiz.answers[quiz.idx] = i; renderQuestion(); }
  }
  function goNext() {
    if (quiz.idx < quiz.qs.length - 1) { quiz.idx++; if (quiz.mode === "timed") { quiz.qLeft = SECS_PER_Q; updateTimerText(); } renderQuestion(); }
  }
  function goPrev() { if (quiz.idx > 0 && quiz.mode !== "timed") { quiz.idx--; renderQuestion(); } }
  function skipQ() {
    if (quiz.answers[quiz.idx] === null) quiz.answers[quiz.idx] = -1;
    if (quiz.idx < quiz.qs.length - 1) goNext(); else trySubmit();
  }
  async function trySubmit() {
    const left = quiz.answers.filter((a) => !(typeof a === "number" && a >= 0)).length;
    const msg = left ? "You have " + left + " unanswered question(s). Submit anyway?" : "Submit your answers now?";
    if (await confirmBox("Submit quiz", msg, "Submit")) finishQuiz();
  }
  async function quitQuiz() {
    if (await confirmBox("Quit quiz", "Your progress in this quiz will be lost. Quit?", "Quit")) { stopTimer(); quiz = null; enterHome(); }
  }
  function pauseQuiz() { if (!quiz) return; quiz.paused = true; $("pauseOverlay").classList.remove("hidden"); }
  function resumeQuiz() { if (!quiz) return; quiz.paused = false; $("pauseOverlay").classList.add("hidden"); }

  async function finishQuiz() {
    stopTimer(); $("pauseOverlay").classList.add("hidden");
    const n = quiz.qs.length; let correct = 0, wrong = 0, skipped = 0; const stats = {};
    quiz.qs.forEach((q, i) => {
      const a = quiz.answers[i];
      stats[q.topic] = stats[q.topic] || { correct: 0, total: 0 };
      stats[q.topic].total++;
      if (typeof a === "number" && a >= 0) { if (a === q.correct) { correct++; stats[q.topic].correct++; } else wrong++; }
      else skipped++;
    });
    const pct = n ? Math.round((correct / n) * 1000) / 10 : 0;
    const topicsUsed = Object.keys(stats);
    const row = {
      local_id: "loc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),
      user_id: user.id, full_name: user.name, email: user.email, app_name: APP_NAME,
      topics: topicsUsed.join(", "), mode: quiz.mode, score: correct, total_questions: n, percentage: pct,
      grade: gradeOf(pct), pass_fail: pct >= PASS_MARK ? "Pass" : "Fail", time_used: quiz.secs, topic_stats: stats,
      created_at: new Date().toISOString(), synced: false
    };
    const all = allLocal(); all.push(row); saveLocal(all);
    lastResult = { row, quiz, correct, wrong, skipped };
    renderResult();
    const ok = await pushResult(row);
    $("saveStatus").textContent = ok ? "✔ Saved to your account." : "Saved on this device. It will sync when you are online.";
  }

  /* ================= RESULT ================= */
  function barClass(p) { return p >= 70 ? "good" : p >= 50 ? "mid" : "bad"; }
  function topicBars(stats, el) {
    el.innerHTML = "";
    Object.keys(stats).forEach((t) => {
      const s = stats[t], p = s.total ? Math.round((s.correct / s.total) * 100) : 0;
      const d = document.createElement("div"); d.className = "bar-row";
      d.innerHTML = '<div class="bar-label"><span>' + esc(t) + "</span><span>" + s.correct + "/" + s.total + " · " + p + '%</span></div>' +
        '<div class="bar-track"><div class="bar-fill ' + barClass(p) + '" style="width:0"></div></div>';
      el.appendChild(d);
      requestAnimationFrame(() => requestAnimationFrame(() => { d.querySelector(".bar-fill").style.width = p + "%"; }));
    });
  }
  function renderResult() {
    const { row, correct, wrong, skipped } = lastResult;
    showScreen("result");
    $("ringPct").textContent = row.percentage + "%"; $("ringScore").textContent = row.score + " / " + row.total_questions;
    const C = 427.26, fg = $("ringFg");
    fg.style.strokeDashoffset = C;
    fg.style.stroke = row.percentage >= 70 ? "var(--success)" : row.percentage >= 50 ? "var(--primary)" : "var(--danger)";
    requestAnimationFrame(() => requestAnimationFrame(() => { fg.style.strokeDashoffset = C * (1 - row.percentage / 100); }));
    $("resGrade").textContent = row.grade; $("resPass").textContent = row.pass_fail.toUpperCase();
    $("resPassBox").className = "badge-box " + (row.pass_fail === "Pass" ? "pass" : "fail");
    $("resCorrect").textContent = correct; $("resWrong").textContent = wrong; $("resSkipped").textContent = skipped;
    $("resTime").textContent = fmt(row.time_used); $("saveStatus").textContent = "Saving…";
    topicBars(row.topic_stats, $("resTopicBars"));
    reviewFilter = "all"; renderReview();
  }
  function renderReview() {
    const { quiz: qz } = lastResult, list = $("reviewList"); list.innerHTML = "";
    let shown = 0;
    qz.qs.forEach((q, i) => {
      const a = qz.answers[i], isSkip = !(typeof a === "number" && a >= 0), isOk = !isSkip && a === q.correct;
      const status = isSkip ? "skipped" : isOk ? "correct" : "wrong";
      if (reviewFilter === "wrong" && status !== "wrong") return;
      if (reviewFilter === "skipped" && status !== "skipped") return;
      shown++;
      const pill = isSkip ? '<span class="pill sk">SKIPPED</span>' : isOk ? '<span class="pill ok">CORRECT</span>' : '<span class="pill no">WRONG</span>';
      const d = document.createElement("div"); d.className = "review-item r-" + status;
      d.innerHTML = '<div class="review-q">' + (i + 1) + ". " + esc(q.text) + " " + pill + "</div>" +
        '<div class="review-line"><b>Your answer:</b> ' + (isSkip ? "Not answered" : "ABCD"[a] + ". " + esc(q.opts[a])) + "</div>" +
        '<div class="review-line"><b>Correct answer:</b> ' + "ABCD"[q.correct] + ". " + esc(q.opts[q.correct]) + "</div>" +
        '<div class="review-expl">' + esc(q.expl) + '<br><span class="muted small">' + esc(q.topic) + " · " + esc(q.source) + "</span></div>";
      list.appendChild(d);
    });
    if (!shown) list.innerHTML = '<p class="muted center">Nothing to show here.</p>';
  }

  /* ================= MY SCORES ================= */
  function renderScores() {
    const rs = myResults();
    $("stTotal").textContent = rs.length;
    const avg = rs.length ? rs.reduce((a, r) => a + Number(r.percentage), 0) / rs.length : 0;
    $("stAvg").textContent = Math.round(avg * 10) / 10 + "%";
    $("stBest").textContent = (rs.length ? Math.max.apply(null, rs.map((r) => Number(r.percentage))) : 0) + "%";
    $("stLast").textContent = (rs.length ? Number(rs[0].percentage) : 0) + "%";
    const agg = {};
    rs.forEach((r) => { const ts = r.topic_stats || {}; Object.keys(ts).forEach((t) => {
      agg[t] = agg[t] || { correct: 0, total: 0 }; agg[t].correct += ts[t].correct; agg[t].total += ts[t].total; }); });
    const bars = $("stTopicBars"); bars.innerHTML = "";
    const strong = [], weak = [];
    TOPICS.forEach((t) => {
      const s = agg[t];
      if (!s) { bars.insertAdjacentHTML("beforeend", '<div class="bar-row"><div class="bar-label"><span>' + esc(t) + '</span><span class="muted">Not attempted</span></div><div class="bar-track"><div class="bar-fill" style="width:0"></div></div></div>'); return; }
      const p = Math.round((s.correct / s.total) * 100);
      (p >= STRONG_AT ? strong : weak).push(t + " (" + p + "%)");
      const d = document.createElement("div"); d.className = "bar-row";
      d.innerHTML = '<div class="bar-label"><span>' + esc(t) + "</span><span>" + p + '%</span></div><div class="bar-track"><div class="bar-fill ' + barClass(p) + '" style="width:0"></div></div>';
      bars.appendChild(d); requestAnimationFrame(() => requestAnimationFrame(() => { d.querySelector(".bar-fill").style.width = p + "%"; }));
    });
    $("stStrong").innerHTML = strong.length ? strong.map((x) => "<li>" + esc(x) + "</li>").join("") : "<li class='muted'>None yet</li>";
    $("stWeak").innerHTML = weak.length ? weak.map((x) => "<li>" + esc(x) + "</li>").join("") : "<li class='muted'>None yet</li>";
    const body = $("historyBody"); body.innerHTML = "";
    rs.slice(0, 100).forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td>" + esc(fmtDate(r.created_at)) + "</td><td>" + esc(r.topics) + "</td><td>" + esc(MODE_LABEL[r.mode] || r.mode) + "</td><td>" + r.score +
        "</td><td>" + r.total_questions + "</td><td>" + r.percentage + "%</td><td class='mono'>" + fmt(r.time_used) + "</td>";
      body.appendChild(tr);
    });
    $("historyEmpty").classList.toggle("hidden", rs.length > 0);
    showScreen("scores");
  }
  async function clearHistory() {
    if (!(await confirmBox("Clear history", "This clears your score history on this device. Your lecturer's records are not affected.", "Clear"))) return;
    const m = readJSON(LS_CLEARED, {}); m[user.id] = new Date().toISOString(); writeJSON(LS_CLEARED, m);
    renderScores(); renderHomeStats(); toast("History cleared");
  }

  /* ================= EVENTS ================= */
  function bind() {
    $("tabLogin").onclick = () => authView("login"); $("tabSignup").onclick = () => authView("signup");
    $("forgotLink").onclick = () => authView("forgot"); $("backToLogin").onclick = () => authView("login");
    $("loginForm").addEventListener("submit", onLogin); $("signupForm").addEventListener("submit", onSignup);
    $("forgotForm").addEventListener("submit", onForgot); $("resetForm").addEventListener("submit", onReset);
    document.querySelectorAll(".pw-toggle").forEach((b) => b.addEventListener("click", () => {
      const i = $(b.dataset.target); i.type = i.type === "password" ? "text" : "password"; }));
    $("logoutBtn").onclick = logout;

    $("selectAllBtn").onclick = () => setAllTopics(true); $("clearAllBtn").onclick = () => setAllTopics(false);
    $("countOptions").addEventListener("click", (e) => {
      const b = e.target.closest(".chip"); if (!b) return; cfg.count = b.dataset.count;
      document.querySelectorAll("#countOptions .chip").forEach((c) => c.classList.toggle("active", c === b)); });
    $("modeOptions").addEventListener("click", (e) => {
      const b = e.target.closest(".mode-card"); if (!b) return; cfg.mode = b.dataset.mode;
      document.querySelectorAll("#modeOptions .mode-card").forEach((c) => c.classList.toggle("active", c === b)); });
    $("startBtn").onclick = () => {
      const msg = $("homeMsg");
      if (!selectedTopics.size) { msg.textContent = "Please select at least one topic."; msg.classList.remove("hidden"); return; }
      msg.classList.add("hidden");
      startQuiz({ topics: TOPICS.filter((t) => selectedTopics.has(t)), count: cfg.count, mode: cfg.mode });
    };
    $("myScoresBtn").onclick = renderScores; $("scoresBackBtn").onclick = enterHome;
    $("clearHistoryBtn").onclick = clearHistory;

    $("prevBtn").onclick = goPrev; $("nextBtn").onclick = goNext; $("skipBtn").onclick = skipQ;
    $("submitBtn").onclick = trySubmit; $("quitBtn").onclick = quitQuiz;
    $("pauseBtn").onclick = pauseQuiz; $("resumeBtn").onclick = resumeQuiz;

    $("retakeBtn").onclick = () => { if (lastResult) startQuiz({ topics: lastResult.quiz.topics, count: lastResult.quiz.count, mode: lastResult.quiz.mode, ids: lastResult.quiz.ids }); };
    $("newQuizBtn").onclick = enterHome; $("homeBtn").onclick = enterHome;
    document.querySelectorAll("[data-review]").forEach((b) => b.addEventListener("click", () => { reviewFilter = b.dataset.review; renderReview(); }));

    $("confirmYes").onclick = () => closeConfirm(true); $("confirmNo").onclick = () => closeConfirm(false);

    $("settingsBtn").onclick = () => $("settingsOverlay").classList.remove("hidden");
    const closeS = () => $("settingsOverlay").classList.add("hidden");
    $("settingsClose").onclick = closeS; $("settingsDone").onclick = closeS;
    $("settingsOverlay").addEventListener("click", (e) => { if (e.target === $("settingsOverlay")) closeS(); });
    $("themeGrid").addEventListener("click", (e) => { const b = e.target.closest(".theme-swatch"); if (b) setSetting("theme", b.dataset.theme); });
    $("bgGrid").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) setSetting("bg", b.dataset.bg); });
    $("fontGrid").addEventListener("click", (e) => { const b = e.target.closest(".chip"); if (b) setSetting("font", b.dataset.font); });

    // PWA install
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferredInstall = e; $("installBtn").classList.remove("hidden"); });
    $("installBtn").onclick = async () => {
      if (!deferredInstall) return; deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch (e) {}
      deferredInstall = null; $("installBtn").classList.add("hidden");
    };
    window.addEventListener("appinstalled", () => { $("installBtn").classList.add("hidden"); toast("App installed"); });

    // Network
    const net = () => { $("netBanner").classList.toggle("hidden", navigator.onLine); if (navigator.onLine) syncResults(); };
    window.addEventListener("online", net); window.addEventListener("offline", net); net();
    $("year").textContent = new Date().getFullYear();
  }

  /* ================= INIT ================= */
  async function init() {
    applySettings(); bind();
    if ("serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register("sw.js").catch(() => {});
    }
    if (!QUESTIONS.length) { showAuth(); authMsg("Questions failed to load. Refresh the page.", "bad"); return; }
    if (!sb) {
      if (!useCachedUser()) { showAuth(); authMsg("Offline: connect to the internet for your first login.", "warn"); }
      return;
    }
    sb.auth.onAuthStateChange((ev) => { if (ev === "PASSWORD_RECOVERY") { showScreen("auth"); authView("reset"); } });
    if (/type=recovery/.test(location.hash)) { showScreen("auth"); authView("reset"); return; }
    try {
      const { data } = await sb.auth.getSession();
      if (data && data.session) { await establishUser(data.session.user); return; }
    } catch (e) { console.warn("Session check failed", e); }
    if (!navigator.onLine && useCachedUser()) return;
    showAuth();
  }
  init();
})();
