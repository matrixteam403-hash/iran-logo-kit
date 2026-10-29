/* مخزن لوگوهای برندهای ایرانی — منطق برنامه (vanilla JS، بدون وابستگی) */
(() => {
  "use strict";
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fa = n => Number(n).toLocaleString("fa-IR");
  const norm = s => (s||"").toString().toLowerCase().replace(/[\u200c\u200f\u200e]/g,"").replace(/ي/g,"ی").replace(/ك/g,"ک").trim();
  const BLANK = "data:image/gif;base64,R0lGODlhAQABAAAAACw=";

  /* ---------- SVG icons (no emoji) ---------- */
  const PATHS = {
    search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    home:'<path d="M3 10.5 12 3l9 7.5V21H3z"/><path d="M9 21v-6h6v6"/>',
    grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    list:'<path d="M9 6h12M9 12h12M9 18h12"/><path d="M4 6h.01M4 12h.01M4 18h.01"/>',
    contrast:'<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
    pause:'<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>',
    help:'<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
    dice:'<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="16" cy="16" r="1" fill="currentColor"/>',
    share:'<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/>',
    print:'<path d="M6 9V2h12v7"/><rect x="6" y="14" width="12" height="8"/><rect x="2" y="9" width="20" height="7" rx="2"/>',
    left:'<path d="M19 12H5M12 19l-7-7 7-7"/>',
    right:'<path d="M5 12h14M12 5l7 7-7 7"/>',
    download:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
    copy:'<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    zoom:'<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/>',
    gamepad:'<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M6 12h4M8 10v4M15 13h.01M18 11h.01"/>',
    bars:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    type:'<path d="M4 7V4h16v3M9 20h6M12 4v16"/>',
    up:'<path d="M12 19V5M5 12l7-7 7 7"/>',
    check:'<path d="M20 6 9 17l-5-5"/>',
    close:'<path d="M18 6 6 18M6 6l12 12"/>',
    arrowRight:'<path d="M5 12h14M12 5l7 7-7 7"/>'
  };
  const ic = (name, cls="") => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]||""}</svg>`;
  function hydrateIcons(root = document){
    root.querySelectorAll("[data-ic]").forEach(el => { el.outerHTML = ic(el.dataset.ic); });
  }

  /* ---------- toast ---------- */
  let toastT;
  function toast(msg){ const t = $("#toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 2000); }

  /* ---------- local storage ---------- */
  /* storage: versioned keys; old schema is migrated (or reset) once */
  const SCHEMA = 2;
  const store = {
    get(k, d){ try { const v = localStorage.getItem("ilk:"+k); return v == null ? d : JSON.parse(v); } catch(e){ return d; } },
    set(k, v){ try { localStorage.setItem("ilk:"+k, JSON.stringify(v)); } catch(e){} }
  };
  (function migrate(){
    try {
      const v = +localStorage.getItem("ilk:schema") || 1;
      if (v < SCHEMA) {
        // v1 -> v2: keep download counts, drop unknown legacy keys
        const keep = new Set(["ilk:dl","ilk:tourSeen","ilk:fsIdx","ilk:contrast"]);
        Object.keys(localStorage).filter(k => k.startsWith("ilk:") && !keep.has(k) && k !== "ilk:schema").forEach(k => localStorage.removeItem(k));
      }
      localStorage.setItem("ilk:schema", String(SCHEMA));
    } catch(e){}
  })();
  function countDl(id){ const d = store.get("dl", {}); d[id] = (d[id]||0) + 1; store.set("dl", d); }

  /* ---------- image loading: lazy + retry + PNG fallback + placeholder ---------- */
  const MAX_TRY = 3;
  const io = "IntersectionObserver" in window ? new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { io.unobserve(en.target); startLoad(en.target); } }), { rootMargin: "300px 0px" }) : null;
  function startLoad(img){ img.dataset.tries = "0"; img.dataset.stage = "svg"; img.src = img.dataset.svg; }
  function watch(img){ if (!img || !img.dataset.svg) return; if (io) io.observe(img); else startLoad(img); }
  document.addEventListener("load", e => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.dataset.svg && img.src.indexOf("data:") !== 0) img.closest(".thumb")?.classList.remove("sk");
  }, true);
  document.addEventListener("error", e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.svg) return;
    const tries = +(img.dataset.tries || 0);
    if (tries < MAX_TRY - 1) {
      img.dataset.tries = String(tries + 1);
      const base = img.dataset.stage === "png" ? img.dataset.png : img.dataset.svg;
      setTimeout(() => { img.src = base + "?r=" + Date.now(); }, 500 * (tries + 1));
      return;
    }
    if (img.dataset.stage === "svg") { img.dataset.stage = "png"; img.dataset.tries = "0"; setTimeout(() => { img.src = img.dataset.png; }, 300); return; }
    const ph = document.createElement("div"); ph.className = "ph"; ph.textContent = img.dataset.letter || "?"; img.replaceWith(ph);
  }, true);
  function imgTag(x, cls="", style=""){
    const letter = (x.name || "?").trim().charAt(0).toUpperCase();
    return `<img class="${cls}" ${style?`style="${style}"`:""} alt="${esc(x.name)}" decoding="async" src="${BLANK}" data-svg="${esc(x.svg)}" data-png="${esc(x.png)}" data-letter="${esc(letter)}">`;
  }

  /* ---------- data ---------- */
  let data = [], byId = new Map();
  let state = { q:"", cat:"all", v:"all", s:"name", l:"grid", size:170 };
  let filtered = [], shown = 0;
  const PAGE = 90;

  fetch("data/logos.json").then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(json => {
    data = json; data.forEach(x => byId.set(x.id, x));
    const cats = [...new Map(json.map(x => [x.category, x.categoryFa])).entries()].sort((a,b) => a[1].localeCompare(b[1],"fa"));
    $("#cat").innerHTML = `<option value="all">همه‌ی دسته‌ها (${fa(cats.length)})</option>` + cats.map(([k,v]) => `<option value="${k}">${esc(v)}</option>`).join("");
    $("#qlist").innerHTML = [...new Set(json.map(x => x.name))].map(n => `<option value="${esc(n)}">`).join("");
    $("#meta").textContent = `داده‌ها: ${fa(json.length)} فایل · نسخه‌ی پکیج منبع ${fa("1.0.4")}`;
    readUrl(); syncControls(); route();
    setupOtd(); setupRandom(); setupTour();
  }).catch(() => {
    $("#grid").innerHTML = `<p class="empty show">بارگذاری داده‌ها ناموفق بود. صفحه را دوباره باز کنید.</p>`;
  });

  /* ---------- gallery ---------- */
  function readUrl(){
    const h = location.hash; const i = h.indexOf("?");
    if (i < 0) return;
    const p = new URLSearchParams(h.slice(i+1));
    state.q = p.get("q") || ""; state.cat = p.get("cat") || "all"; state.v = p.get("v") || "all";
    state.s = p.get("s") || "name"; state.l = p.get("l") || "grid"; state.size = Math.min(260, Math.max(130, +(p.get("size") || 170)));
  }
  function writeUrl(){
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q); if (state.cat !== "all") p.set("cat", state.cat);
    if (state.v !== "all") p.set("v", state.v); if (state.s !== "name") p.set("s", state.s);
    if (state.l !== "grid") p.set("l", state.l);
    const qs = p.toString();
    const target = "#/" + (qs ? "?" + qs : "");
    if (location.hash !== target && (location.hash === "" || location.hash === "#/" || location.hash.startsWith("#/?"))) history.replaceState(null, "", target);
  }
  function syncControls(){
    $("#q").value = state.q; $("#cat").value = state.cat; $("#sort").value = state.s;
    $$("#variant button").forEach(b => b.classList.toggle("on", b.dataset.v === state.v));
    $$("#layout button").forEach(b => b.classList.toggle("on", b.dataset.l === state.l));
    $("#grid").classList.toggle("list", state.l === "list");
    $("#size").value = state.size;
    document.documentElement.style.setProperty("--cw", state.size + "px");
  }
  function applyFilters(){
    const terms = norm(state.q).split(/\s+/).filter(Boolean);
    filtered = data.filter(x => {
      if (state.v !== "all" && x.variant !== state.v) return false;
      if (state.cat !== "all" && x.category !== state.cat) return false;
      if (terms.length) { const hay = norm(x.name + " " + x.slug + " " + x.categoryFa); if (!terms.every(t => hay.includes(t))) return false; }
      return true;
    });
    const cmp = {
      name: (a,b) => a.name.localeCompare(b.name, "en"),
      cat: (a,b) => a.categoryFa.localeCompare(b.categoryFa,"fa") || a.name.localeCompare(b.name,"en"),
      var: (a,b) => a.variant.localeCompare(b.variant) || a.name.localeCompare(b.name,"en")
    }[state.s];
    filtered.sort(cmp);
  }
  function renderChips(){
    const arr = [];
    if (state.q) arr.push(["q", "جستجو: " + state.q]);
    if (state.cat !== "all") arr.push(["cat", data.find(x => x.category === state.cat)?.categoryFa || state.cat]);
    if (state.v !== "all") arr.push(["v", state.v === "mono" ? "تک‌رنگ" : "رنگی"]);
    $("#chips").innerHTML = arr.map(([k,l]) => `<button class="fchip" data-clear="${k}" type="button">${esc(l)} ${ic("close")}</button>`).join("");
  }
  function renderGallery(reset){
    if (reset !== false) { applyFilters(); shown = 0; $("#grid").innerHTML = ""; }
    renderChips();
    const next = filtered.slice(shown, shown + PAGE);
    const frag = document.createDocumentFragment();
    const imgs = [];
    next.forEach((x, k) => {
      const c = document.createElement("a");
      c.className = "card"; c.href = "#/logo/" + encodeURIComponent(x.id);
      c.style.animationDelay = Math.min(k, 20) * 22 + "ms";
      c.innerHTML = `<div class="thumb sk">${imgTag(x)}</div>
        <div class="meta"><h3 title="${esc(x.name)}">${esc(x.name)}</h3>
        <div class="tags"><span class="tag ${x.variant==="mono"?"m":""}">${x.variant==="mono"?"تک‌رنگ":"رنگی"}</span>
        <span class="tag cat">${esc(x.categoryFa)}</span></div></div>`;
      frag.appendChild(c);
      imgs.push(c.querySelector("img"));
    });
    $("#grid").appendChild(frag);
    imgs.forEach(watch);
    shown += next.length;
    $("#count").textContent = `${fa(filtered.length)} لوگو`;
    $("#empty").classList.toggle("show", filtered.length === 0);
    $("#sugg").innerHTML = filtered.length === 0 ? `<button class="fchip" data-clear="q" type="button">پاک کردن جستجو</button><button class="fchip" data-clear="all" type="button">پاک کردن فیلترها</button>` : "";
    $("#moreBtn").hidden = shown >= filtered.length;
  }
  function applyAndRender(scroll){ writeUrl(); renderGallery(true); if (scroll) window.scrollTo({ top: $("#toolbar").offsetTop - 64 }); }

  // infinite scroll
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(es => es.forEach(en => {
      if (en.isIntersecting && !$("#v-gallery").classList.contains("hidden") && shown < filtered.length) renderGallery(false);
    }), { rootMargin: "400px 0px" }).observe($("#sentinel"));
  }

  let qT;
  $("#q").addEventListener("input", e => {
    clearTimeout(qT);
    qT = setTimeout(() => {
      state.q = e.target.value.trim(); applyAndRender(false);
      if (state.q.length >= 2) { const h = store.get("hist", []).filter(x => x !== state.q); h.unshift(state.q); store.set("hist", h.slice(0,8)); renderHist(); }
    }, 180);
  });
  $("#cat").addEventListener("change", e => { state.cat = e.target.value; applyAndRender(true); });
  $("#sort").addEventListener("change", e => { state.s = e.target.value; applyAndRender(false); });
  $("#variant").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; state.v = b.dataset.v; syncControls(); applyAndRender(true); });
  $("#layout").addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; state.l = b.dataset.l; syncControls(); writeUrl(); });
  $("#size").addEventListener("input", e => { state.size = +e.target.value; document.documentElement.style.setProperty("--cw", state.size + "px"); });
  $("#size").addEventListener("change", () => writeUrl());
  function clearFilter(k){
    if (k === "q") state.q = "";
    if (k === "cat") state.cat = "all";
    if (k === "v") state.v = "all";
    if (k === "all") { state.q = ""; state.cat = "all"; state.v = "all"; }
    syncControls(); applyAndRender(false);
  }
  $("#chips").addEventListener("click", e => { const b = e.target.closest("[data-clear]"); if (b) clearFilter(b.dataset.clear); });
  $("#sugg").addEventListener("click", e => { const b = e.target.closest("[data-clear]"); if (b) clearFilter(b.dataset.clear); });
  $("#moreBtn").addEventListener("click", () => renderGallery(false));

  function renderHist(){
    const h = store.get("hist", []);
    $("#hist").innerHTML = h.length ? `<span>اخیراً:</span>` + h.map(x => `<button type="button" data-h="${esc(x)}">${esc(x)}</button>`).join("") : "";
  }
  $("#hist").addEventListener("click", e => { const b = e.target.closest("[data-h]"); if (!b) return; state.q = b.dataset.h; syncControls(); applyAndRender(false); });
  renderHist();

  /* ---------- logo of the day & random ---------- */
  function setupOtd(){
    const day = Math.floor(Date.now() / 86400000);
    const x = data[(day * 97) % data.length];
    const a = $("#otd");
    a.href = "#/logo/" + encodeURIComponent(x.id);
    a.innerHTML = `<div class="thumb">${imgTag(x)}</div><div><small>لوگوی امروز</small><b>${esc(x.name)}</b><small>${esc(x.categoryFa)}</small></div>`;
    watch(a.querySelector("img"));
  }
  function setupRandom(){ $("#randomBtn").addEventListener("click", () => { const x = data[Math.floor(Math.random()*data.length)]; location.hash = "#/logo/" + encodeURIComponent(x.id); }); }

  /* ---------- keyboard ---------- */
  document.addEventListener("keydown", e => {
    if (e.target.matches("input,textarea,select")) { if (e.key === "Escape") e.target.blur(); return; }
    if (e.key === "/") { e.preventDefault(); if (location.hash.startsWith("#/logo")) location.hash = "#/"; setTimeout(() => $("#q").focus(), 60); }
    if ($("#tourOv").classList.contains("open")) {
      if (e.key === "Escape") closeTour();
      else if (e.key === "Tab") trapTab(e);
      return;
    }
    if (location.hash.startsWith("#/logo/")) {
      if (e.key === "ArrowRight") goNeighbor(-1);
      if (e.key === "ArrowLeft") goNeighbor(1);
    }
  });

  /* ---------- logo detail ---------- */
  function neighbors(x){
    const list = data.filter(y => y.category === x.category && y.variant === x.variant).sort((a,b) => a.name.localeCompare(b.name,"en"));
    const i = list.findIndex(y => y.id === x.id);
    return { prev: list[(i - 1 + list.length) % list.length], next: list[(i + 1) % list.length] };
  }
  function goNeighbor(dir){
    const m = location.hash.match(/^#\/logo\/([^?]+)/); if (!m) return;
    const x = byId.get(decodeURIComponent(m[1])); if (!x) return;
    const n = neighbors(x); location.hash = "#/logo/" + encodeURIComponent((dir < 0 ? n.prev : n.next).id);
  }

  function renderDetail(x){
    const variantLabel = x.variant === "mono" ? "تک‌رنگ" : "رنگی";
    const n = neighbors(x);
    const other = data.find(y => y.slug === x.slug && y.id !== x.id);
    const base = location.origin + location.pathname.replace(/index\.html$/, "");
    const absSvg = base + x.svg;
    const related = data.filter(y => y.category === x.category && y.slug !== x.slug).slice(0, 8);
    $("#v-logo").innerHTML = `
      <div class="wrap">
      <div class="crumbs">
        <a href="#/">گالری</a><span class="sep">/</span><a href="#/?cat=${encodeURIComponent(x.category)}">${esc(x.categoryFa)}</a><span class="sep">/</span><span>${esc(x.name)}</span>
        <a class="back" href="#/">${ic("right")} بازگشت</a>
      </div>
      <div class="dhero">
        <div class="stage">
          <div class="ring"></div><div class="ring r2"></div><div class="ring r3"></div>
          <div class="tile" id="bigTile" title="کلیک: تغییر پس‌زمینه · حرکت ماوس: زوم">${imgTag(x)}</div>
        </div>
        <div class="dinfo">
          <h1>${esc(x.name)}</h1>
          <p class="lead">لوگوی ${esc(x.name)} در دسته‌ی «${esc(x.categoryFa)}»، نسخه‌ی ${variantLabel}.</p>
          <div class="dchips">
            <span class="chip">${esc(x.categoryFa)}</span>
            <span class="chip ${x.variant==="mono"?"gr":"cy"}">${variantLabel}</span>
            <span class="chip gr">SVG</span><span class="chip gr">PNG 512px</span>
            ${other ? `<a class="chip cy" href="#/logo/${encodeURIComponent(other.id)}">نسخه‌ی ${other.variant==="mono"?"تک‌رنگ":"رنگی"} ${ic("arrowRight")}</a>` : ""}
          </div>
          <div class="actions">
            <button class="btn ghost sm" id="shareBtn" type="button">${ic("share")} اشتراک</button>
            <button class="btn ghost sm" id="pressBtn" type="button">${ic("print")} برگه‌ی مطبوعاتی</button>
          </div>
          <div class="dl-grid">
            <a class="btn" id="dSvg" href="${x.svg}" download="${x.slug}-${x.variant}.svg"><span>دانلود SVG</span><small>وکتوری، برای وب و طراحی</small></a>
            <a class="btn ghost" id="dPng" href="${x.png}" download="${x.slug}-${x.variant}.png"><span>دانلود PNG</span><small>۵۱۲px، پس‌زمینه‌ی شفاف</small></a>
          </div>
          <div class="fmtrow">
            <label class="sr" for="fmt">فرمت</label>
            <select id="fmt"><option value="png">PNG</option><option value="webp">WebP</option><option value="jpg">JPG (پس‌زمینه‌ی سفید)</option></select>
            <label class="sr" for="fmtSize">اندازه</label>
            <select id="fmtSize"><option value="512">۵۱۲px</option><option value="1024" selected>۱۰۲۴px</option><option value="2048">۲۰۴۸px</option></select>
            <button class="btn sm" id="convBtn" type="button">${ic("download")} تبدیل و دانلود</button>
          </div>
          <p class="fine">فایل‌ها مستقیم از سرور دانلود می‌شوند؛ تبدیل فرمت داخل مرورگر شما انجام می‌شود.</p>
        </div>
      </div>

      <div class="panels">
        <div class="panel"><h4><span class="dot"></span>پیش‌نمایش در اندازه‌ها</h4>
          <div class="sizes">
            <div>${imgTag(x,"","width:96px;height:96px;object-fit:contain")}<span>۹۶px</span></div>
            <div>${imgTag(x,"","width:56px;height:56px;object-fit:contain")}<span>۵۶px</span></div>
            <div>${imgTag(x,"","width:32px;height:32px;object-fit:contain")}<span>۳۲px</span></div>
          </div>
        </div>
        <div class="panel"><h4><span class="dot"></span>رنگ‌های غالب</h4>
          <div class="palette" id="palette"><span class="fine">در حال تحلیل…</span></div>
          <p class="fine">روی هر رنگ بزنید تا کد HEX کپی شود.</p>
        </div>
        <div class="panel specs"><h4><span class="dot"></span>مشخصات فایل</h4>
          <dl>
            <dt>نام</dt><dd>${esc(x.slug)}</dd>
            <dt>دسته</dt><dd>${esc(x.category)}</dd>
            <dt>نسخه</dt><dd>${x.variant}</dd>
            <dt>SVG</dt><dd>${esc(x.svg)}</dd>
            <dt>PNG</dt><dd>${esc(x.png)}</dd>
            <dt>دانلود</dt><dd>${fa(store.get("dl",{})[x.id]||0)} بار (این مرورگر)</dd>
          </dl>
        </div>
      </div>

      <div class="panels two">
        <div class="panel"><h4><span class="dot"></span>ویرایش رنگ اصلی</h4>
          <div class="recolor">
            <input type="color" id="recolorPick" value="#22c55e" aria-label="رنگ جدید">
            <button class="btn ghost sm" id="recolorDl" type="button">${ic("download")} SVG با رنگ جدید</button>
            <button class="btn ghost sm" id="recolorReset" type="button">بازنشانی</button>
          </div>
          <div class="recolor-prev"><img id="recolorImg" alt="پیش‌نمایش رنگ جدید" src="${x.svg}"></div>
          <p class="fine" id="recolorInfo">در حال تحلیل رنگ…</p>
        </div>
        <div class="panel"><h4><span class="dot"></span>کد استفاده</h4>
          <div class="tabs" id="codeTabs">
            <button class="on" data-t="html" type="button">HTML</button>
            <button data-t="css" type="button">CSS</button>
            <button data-t="react" type="button">React</button>
          </div>
          <div class="codebox"><button class="copy" id="copyBtn" type="button">${ic("copy")} کپی</button><pre id="codeTxt"></pre></div>
        </div>
      </div>

      <div class="pager">
        <a class="btn ghost sm" href="#/logo/${encodeURIComponent(n.prev.id)}">${ic("right")} ${esc(n.prev.name)}</a>
        <a class="btn ghost sm" href="#/logo/${encodeURIComponent(n.next.id)}">${esc(n.next.name)} ${ic("left")}</a>
      </div>

      ${related.length ? `
      <div class="related">
        <h3>سایر لوگوهای «${esc(x.categoryFa)}»</h3>
        <div class="grid">
          ${related.map((y,k)=>`<a class="card" href="#/logo/${encodeURIComponent(y.id)}" style="animation-delay:${k*40}ms">
            <div class="thumb sk">${imgTag(y)}</div>
            <div class="meta"><h3>${esc(y.name)}</h3><div class="tags"><span class="tag ${y.variant==="mono"?"m":""}">${y.variant==="mono"?"تک‌رنگ":"رنگی"}</span></div></div></a>`).join("")}
        </div>
      </div>` : ""}
      </div>`;

    hydrateIcons($("#v-logo"));
    $$("#v-logo img[data-svg]").forEach(watch);

    // zoom lens + background toggle
    const tile = $("#bigTile");
    tile.addEventListener("click", () => tile.classList.toggle("dark"));
    tile.addEventListener("mousemove", e => { const r = tile.getBoundingClientRect(); const img = tile.querySelector("img"); if (img) img.style.transformOrigin = ((e.clientX - r.left)/r.width*100) + "% " + ((e.clientY - r.top)/r.height*100) + "%"; });
    tile.addEventListener("mouseenter", () => tile.classList.add("zoomed"));
    tile.addEventListener("mouseleave", () => tile.classList.remove("zoomed"));

    $("#convBtn").addEventListener("click", () => convert(x, $("#fmt").value, +$("#fmtSize").value));

    $("#shareBtn").addEventListener("click", async () => {
      const url = location.href;
      if (navigator.share) { try { await navigator.share({ title: x.name, url }); return; } catch(e){} }
      copyText(url, "لینک کپی شد");
    });
    $("#pressBtn").addEventListener("click", () => printPressKit(x));
    $("#dSvg").addEventListener("click", () => { countDl(x.id); toast("دانلود SVG شروع شد"); });
    $("#dPng").addEventListener("click", () => { countDl(x.id); toast("دانلود PNG شروع شد"); });

    const snippets = {
      html: `<img src="${absSvg}" alt="${x.name}" width="120">`,
      css: `.logo {\n  background: url("${absSvg}") no-repeat center / contain;\n  width: 120px;\n  height: 48px;\n}`,
      react: `<img src="${absSvg}" alt="${x.name}" width={120} />`
    };
    let tab = "html";
    $("#codeTxt").textContent = snippets[tab];
    $("#codeTabs").addEventListener("click", e => {
      const b = e.target.closest("button"); if (!b) return;
      tab = b.dataset.t; $$("#codeTabs button").forEach(y => y.classList.toggle("on", y === b));
      $("#codeTxt").textContent = snippets[tab];
    });
    $("#copyBtn").addEventListener("click", () => copyText($("#codeTxt").textContent, "کد کپی شد"));

    extractPalette(x).then(cols => {
      $("#palette").innerHTML = cols.length ? cols.map(c => `<button class="sw" type="button" data-hex="${c}" title="${c}"><i style="background:${c}"></i>${c}</button>`).join("") : `<span class="fine">رنگ قابل تحلیل نیست</span>`;
    });
    $("#palette").addEventListener("click", e => { const b = e.target.closest("[data-hex]"); if (b) copyText(b.dataset.hex, "کد رنگ کپی شد: " + b.dataset.hex); });

    setupRecolor(x);
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  function copyText(txt, msg){
    const done = () => toast(msg || "کپی شد");
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(txt).then(done, () => fallbackCopy(txt, done));
    else fallbackCopy(txt, done);
  }
  function fallbackCopy(txt, done){ const ta = document.createElement("textarea"); ta.value = txt; ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); } catch(e){} ta.remove(); done(); }

  function loadImage(src){ return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }

  async function extractPalette(x){
    try {
      const img = await loadImage(x.png);
      const cv = document.createElement("canvas"); cv.width = 96; cv.height = 96;
      const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0, 96, 96);
      const d = ctx.getImageData(0, 0, 96, 96).data;
      const buckets = new Map();
      for (let i = 0; i < d.length; i += 4) {
        if (d[i+3] < 200) continue;
        const r = d[i], g = d[i+1], b = d[i+2];
        const mx = Math.max(r,g,b), mn = Math.min(r,g,b);
        if (mx > 238 && mn > 225) continue;
        if (mx < 30) continue;
        if (mx - mn < 22) continue;
        const k = [r,g,b].map(v => Math.round(v/32)*32).join(",");
        buckets.set(k, (buckets.get(k)||0) + 1);
      }
      return [...buckets.entries()].sort((a,b) => b[1]-a[1]).slice(0, 5)
        .map(([k]) => "#" + k.split(",").map(v => Math.min(255, +v).toString(16).padStart(2,"0")).join(""));
    } catch(e){ return []; }
  }

  async function convert(x, fmt, size){
    try {
      toast("در حال تبدیل…");
      const svgText = await (await fetch(x.svg)).text();
      const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
      const img = await loadImage(url);
      const cv = document.createElement("canvas"); cv.width = size; cv.height = size;
      const ctx = cv.getContext("2d");
      if (fmt === "jpg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,size,size); }
      const s = Math.min(size / img.naturalWidth, size / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.drawImage(img, (size - w)/2, (size - h)/2, w, h);
      const mime = fmt === "jpg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
      cv.toBlob(blob => {
        if (!blob) { toast("تبدیل ناموفق بود"); return; }
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `${x.slug}-${x.variant}-${size}.${fmt}`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => { URL.revokeObjectURL(a.href); URL.revokeObjectURL(url); }, 2000);
        countDl(x.id); toast("دانلود شروع شد");
      }, mime, 0.95);
    } catch(e){ toast("تبدیل ناموفق بود"); }
  }

  function setupRecolor(x){
    const pick = $("#recolorPick"), img = $("#recolorImg"), info = $("#recolorInfo");
    let original = null, dominant = null, blobUrl = null;
    const toHex6 = c => c.length === 4 ? "#" + c.slice(1).split("").map(ch => ch + ch).join("") : c;
    fetch(x.svg).then(r => r.text()).then(t => {
      original = t;
      const counts = {};
      (t.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) || []).forEach(c => { c = c.toLowerCase(); if (["#fff","#ffffff","#000","#000000"].includes(c)) return; counts[c] = (counts[c]||0)+1; });
      const top = Object.entries(counts).sort((a,b)=>b[1]-a[1])[0];
      dominant = top ? top[0] : null;
      if (dominant) { info.textContent = `رنگ غالب فعلی: ${dominant}. با انتخاب رنگ، این رنگ جایگزین می‌شود.`; pick.value = toHex6(dominant); }
      else info.textContent = "این لوگو رنگ غالب قابل تغییر ندارد (سیاه/سفید یا چند رنگی).";
    }).catch(() => { info.textContent = "رنگ‌ها بارگذاری نشد."; });
    const build = () => dominant ? original.split(dominant).join(pick.value) : original;
    pick.addEventListener("input", () => {
      if (!original) return;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
      blobUrl = URL.createObjectURL(new Blob([build()], { type: "image/svg+xml" }));
      img.src = blobUrl;
    });
    $("#recolorReset").addEventListener("click", () => { img.src = x.svg; if (dominant) pick.value = toHex6(dominant); });
    $("#recolorDl").addEventListener("click", () => {
      if (!original) return;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([build()], { type: "image/svg+xml" }));
      a.download = `${x.slug}-custom.svg`; document.body.appendChild(a); a.click(); a.remove();
      toast("فایل SVG با رنگ جدید دانلود شد");
    });
  }

  function printPressKit(x){
    $("#pressKit").innerHTML = `<div class="pk"><h1>${esc(x.name)}</h1><p>دسته: ${esc(x.categoryFa)} · نسخه: ${x.variant==="mono"?"تک‌رنگ":"رنگی"}</p>
      <p><img src="${location.origin}${location.pathname.replace(/index\.html$/,"")}${x.png}" alt=""></p>
      <p>منبع: مخزن لوگوهای ایرانی · ${location.href}</p></div>`;
    setTimeout(() => window.print(), 150);
  }

  /* ---------- stats ---------- */
  function renderStats(){
    const catCounts = {}; data.forEach(x => { catCounts[x.categoryFa] = (catCounts[x.categoryFa]||0)+1; });
    const maxC = Math.max(...Object.values(catCounts));
    $("#barsCat").innerHTML = Object.entries(catCounts).sort((a,b)=>b[1]-a[1]).map(([k,v]) => `<div class="bar"><span>${esc(k)}</span><div class="track"><div class="fill" data-w="${(v/maxC*100).toFixed(1)}"></div></div><span>${fa(v)}</span></div>`).join("");
    const color = data.filter(x => x.variant === "color").length, mono = data.length - color;
    const dl = store.get("dl", {}); const total = Object.values(dl).reduce((a,b)=>a+b,0);
    $("#barsVar").innerHTML = [["رنگی", color], ["تک‌رنگ", mono]].map(([k,v]) => `<div class="bar"><span>${k}</span><div class="track"><div class="fill" data-w="${(v/data.length*100).toFixed(1)}"></div></div><span>${fa(v)}</span></div>`).join("");
    $("#dlTotal").textContent = `مجموع دانلودهای شما روی این مرورگر: ${fa(total)} بار · لوگوهای دانلودشده: ${fa(Object.keys(dl).length)}`;
    setTimeout(() => $$("#v-stats .fill").forEach(f => f.style.width = f.dataset.w + "%"), 60);
  }

  /* ---------- game ---------- */
  let gameScore = 0, gameRound = 0, gameAnswer = null, gameTimer = null;
  const GAME_ROUNDS = 10;
  function gameHud(){
    $("#gRound").textContent = `سؤال ${fa(gameRound)} از ${fa(GAME_ROUNDS)}`;
    $("#gScoreChip").textContent = `امتیاز: ${fa(gameScore)}`;
    $("#gBar").style.width = (gameRound / GAME_ROUNDS * 100) + "%";
  }
  function gameStart(){
    clearTimeout(gameTimer); gameScore = 0; gameRound = 0; gameAnswer = null;
    $("#gTitle").textContent = "کدام برند است؟";
    $("#gLead").textContent = "لوگو را نگاه کن و نام درست برند را انتخاب کن.";
    $(".gres")?.remove();
    gameNext();
  }
  function gameNext(){
    clearTimeout(gameTimer);
    if (gameRound >= GAME_ROUNDS) return gameFinish();
    gameRound++;
    const x = data[Math.floor(Math.random()*data.length)];
    const names = new Set([x.name]);
    while (names.size < 4) names.add(data[Math.floor(Math.random()*data.length)].name);
    const opts = [...names].sort(() => Math.random() - 0.5);
    gameAnswer = x.name;
    const tile = $("#gTile");
    tile.classList.remove("pop"); void tile.offsetWidth; tile.classList.add("pop");
    $("#gImg").src = x.svg;
    $("#gOpts").innerHTML = opts.map(o => `<button type="button" data-o="${esc(o)}">${esc(o)}</button>`).join("");
    gameHud();
  }
  function gameFinish(){
    gameAnswer = null;
    $("#gTitle").textContent = "بازی تمام شد!";
    $("#gLead").textContent = gameScore >= 8 ? "عالی بود؛ چشم تیزی داری." : gameScore >= 5 ? "خوب بود؛ یک دور دیگر بازی کن." : "دفعه‌ی بعد بهتر می‌شود.";
    $("#gOpts").innerHTML = "";
    $("#gBar").style.width = "100%";
    $("#gRound").textContent = `پایان بازی`;
    $("#gScoreChip").textContent = `امتیاز نهایی: ${fa(gameScore)} از ${fa(GAME_ROUNDS)}`;
    $("#gOpts").insertAdjacentHTML("afterend", `<div class="gres"><div class="big">${fa(gameScore)}/${fa(GAME_ROUNDS)}</div><div class="actions"><button class="btn sm" id="gAgain" type="button">${ic("arrowRight")} بازی دوباره</button></div></div>`);
    $("#gAgain").addEventListener("click", gameStart);
  }
  $("#gOpts").addEventListener("click", e => {
    const b = e.target.closest("[data-o]"); if (!b || !gameAnswer) return;
    if (b.dataset.o === gameAnswer) { gameScore++; b.classList.add("ok"); }
    else { b.classList.add("bad"); }
    $$("#gOpts button").forEach(x => { x.disabled = true; if (x.dataset.o === gameAnswer) x.classList.add("ok"); });
    gameAnswer = null;
    gameHud();
    gameTimer = setTimeout(gameNext, 1100);
  });

  /* ---------- tour ---------- */
  const TOUR = [
    ["به مخزن خوش آمدید", "۸۳۴ لوگوی برندهای ایرانی را اینجا جستجو و دانلود کنید. هر لوگو صفحه‌ی اختصاصی دارد."],
    ["جستجو و فیلتر", "با کلید / سریع جستجو کنید. فیلترها در آدرس صفحه ذخیره می‌شوند تا لینکشان را بفرستید."],
    ["ابزار داخل صفحه‌ی لوگو", "رنگ غالب را ببینید، رنگ را عوض کنید، فرمت را تبدیل کنید یا با کشیدن انگشت به لوگوی بعدی بروید."]
  ];
  let tourI = 0;
  function setupTour(){ if (!store.get("tourSeen", false)) openTour(); }
  let tourReturn = null;
  function openTour(){
    tourReturn = document.activeElement;
    tourI = 0; paintTour(); $("#tourOv").classList.add("open");
    setTimeout(() => $("#tourNext").focus(), 30);
  }
  function closeTour(){
    $("#tourOv").classList.remove("open"); store.set("tourSeen", true);
    if (tourReturn && tourReturn.focus) tourReturn.focus();
    tourReturn = null;
  }
  /* focus trap: Tab cycles inside the tour dialog */
  function trapTab(e){
    const f = [...$("#tourOv").querySelectorAll("button:not([disabled])")];
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  function paintTour(){
    $("#tourT").textContent = TOUR[tourI][0]; $("#tourP").textContent = TOUR[tourI][1];
    $("#tourDots").innerHTML = TOUR.map((_, i) => `<i class="${i===tourI?"on":""}"></i>`).join("");
    $("#tourNext").textContent = tourI === TOUR.length - 1 ? "شروع" : "بعدی";
  }
  $("#tourNext").addEventListener("click", () => { if (tourI >= TOUR.length - 1) closeTour(); else { tourI++; paintTour(); } });
  $("#tourSkip").addEventListener("click", closeTour);
  $("#tourOv").addEventListener("click", e => { if (e.target.id === "tourOv") closeTour(); });
  $("#helpBtn").addEventListener("click", openTour);

  /* ---------- accessibility settings ---------- */
  const SIZES = [0.95, 1, 1.1, 1.2];
  let fsIdx = store.get("fsIdx", 1);
  const applyFs = () => document.documentElement.style.setProperty("--fs", SIZES[fsIdx]);
  applyFs();
  $("#textBtn").addEventListener("click", () => { fsIdx = (fsIdx + 1) % SIZES.length; store.set("fsIdx", fsIdx); applyFs(); toast("اندازه‌ی متن: " + fa(Math.round(SIZES[fsIdx]*100)) + "٪"); });
  let contrast = store.get("contrast", false);
  const applyContrast = () => { document.documentElement.dataset.contrast = contrast ? "1" : "0"; $("#contrastBtn").setAttribute("aria-pressed", contrast); };
  applyContrast();
  $("#contrastBtn").addEventListener("click", () => { contrast = !contrast; store.set("contrast", contrast); applyContrast(); });
  let reduce = store.get("reduce", false);
  const applyMotion = () => { document.documentElement.dataset.reduce = reduce ? "1" : "0"; $("#motionBtn").setAttribute("aria-pressed", reduce); };
  applyMotion();
  $("#motionBtn").addEventListener("click", () => { reduce = !reduce; store.set("reduce", reduce); applyMotion(); });

  /* ---------- scroll: progress + back to top ---------- */
  const totop = $("#totop"), prog = $("#progress");
  window.addEventListener("scroll", () => {
    const h = document.documentElement.scrollHeight - innerHeight;
    prog.style.width = (h > 0 ? scrollY / h * 100 : 0) + "%";
    totop.classList.toggle("show", scrollY > 600);
  }, { passive: true });
  totop.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* ---------- swipe between logos (attached once) ---------- */
  (() => {
    let tx = null;
    const v = $("#v-logo");
    v.addEventListener("touchstart", e => { tx = e.touches[0].clientX; }, { passive: true });
    v.addEventListener("touchend", e => {
      if (tx == null) return;
      const dx = e.changedTouches[0].clientX - tx; tx = null;
      if (Math.abs(dx) > 70 && !e.target.closest("input,select")) goNeighbor(dx > 0 ? -1 : 1);
    }, { passive: true });
  })();

  /* ---------- router ---------- */
  const VIEWS = ["v-gallery","v-logo","v-stats","v-game","v-changelog","v-404"];
  function showView(id){ VIEWS.forEach(v => $("#"+v).classList.toggle("hidden", v !== id)); }
  function setNav(name){ $$("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === name)); }
  function route(){
    const h = location.hash || "#/";
    const m = h.match(/^#\/logo\/([^?]+)/);
    if (m) {
      const x = byId.get(decodeURIComponent(m[1]));
      if (x) { document.title = x.name + " | مخزن لوگوهای ایرانی"; showView("v-logo"); setNav("gallery"); renderDetail(x); return; }
      return notFound();
    }
    if (h === "#/stats") { document.title = "آمار | مخزن"; showView("v-stats"); setNav("stats"); renderStats(); return; }
    if (h === "#/game") { document.title = "بازی | مخزن"; showView("v-game"); setNav("game"); gameStart(); return; }
    if (h === "#/changelog") { document.title = "تغییرات | مخزن"; showView("v-changelog"); setNav("changelog"); return; }
    if (h.startsWith("#/") && !h.startsWith("#/?") && h !== "#/") return notFound();
    // gallery
    document.title = "مخزن لوگوهای برندهای ایرانی | Iran Logo Kit";
    showView("v-gallery"); setNav("gallery");
    if (data.length) { readUrl(); syncControls(); applyAndRender(false); }
    if (h === "#logos") setTimeout(() => $("#logos").scrollIntoView({ behavior: "smooth" }), 40);
    if (h === "#download" || h === "#usage") setTimeout(() => document.getElementById(h.slice(1)).scrollIntoView({ behavior: "smooth" }), 40);
  }
  function notFound(){
    showView("v-404"); setNav(""); document.title = "۴۰۴ | مخزن لوگوهای ایرانی";
    if (data.length) {
      const x = data[Math.floor(Math.random()*data.length)];
      const img = $("#nfImg"); img.removeAttribute("src"); img.dataset.svg = x.svg; img.dataset.png = x.png; img.dataset.letter = x.name.charAt(0); img.alt = x.name;
      watch(img);
    }
  }
  window.addEventListener("hashchange", () => { if (location.hash.startsWith("#/?")) readUrl(); route(); });

  /* ---------- service worker (offline) ---------- */
  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }

  hydrateIcons();
})();
