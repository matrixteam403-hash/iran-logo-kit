/* مخزن لوگوهای برندهای ایرانی — منطق برنامه (vanilla JS، بدون وابستگی) */
(() => {
  "use strict";

  /* ---------- helpers ---------- */
  const $ = s => document.querySelector(s);
  const app = $("#app");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fa = n => Number(n).toLocaleString("fa-IR");
  const norm = s => (s || "").toString().toLowerCase().replace(/[\u200c\u200f\u200e]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").trim();
  const PAGE = 90;

  let data = [];
  let byId = new Map();
  let state = { q: "", cat: "all", v: "all", shown: PAGE };
  let view = null;

  /* ---------- images: SVG first, PNG fallback, letter placeholder ---------- */
  function imgTag(x, cls = "") {
    return `<img class="${cls}" src="${esc(x.svg)}" data-png="${esc(x.png)}" data-letter="${esc(x.name.charAt(0))}" alt="${esc(x.name)}" loading="lazy" decoding="async">`;
  }
  document.addEventListener("error", e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.png) return;
    if (img.dataset.fallback !== "1") { img.dataset.fallback = "1"; img.src = img.dataset.png; return; }
    const ph = document.createElement("div");
    ph.className = "ph"; ph.textContent = img.dataset.letter || "?";
    img.replaceWith(ph);
  }, true);
  document.addEventListener("load", e => {
    if (e.target instanceof HTMLImageElement) e.target.closest(".tile")?.classList.remove("loading");
  }, true);

  /* ---------- views ---------- */
  function setHeader(solid) { $("#top").classList.toggle("solid", solid); }
  function focusMain() {
    const h = app.querySelector("h1, h2");
    if (h) { h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }

  /* ---------- gallery ---------- */
  function gallery() {
    view = "gallery";
    document.title = "مخزن لوگوهای برندهای ایرانی";
    app.innerHTML = `
      <section class="hero" aria-labelledby="hero-t">
        <div class="inner reveal">
          <p class="eyebrow">رایگان · متن‌باز · MIT</p>
          <h1 id="hero-t">همه‌ی لوگوهای برندهای ایرانی،<br><strong>یک‌جا.</strong></h1>
          <p>${fa(834)} فایل در ${fa(21)} دسته، در نسخه‌ی رنگی و تک‌رنگ، با فرمت وکتوری SVG و تصویری PNG.</p>
          <div class="actions">
            <a class="btn" href="#logos">مرور لوگوها</a>
            <a class="btn ghost" href="download/iran-brand-logos-all-formats.zip" download>دانلود کامل ZIP</a>
          </div>
        </div>
        <span class="scroll-cue" aria-hidden="true"></span>
      </section>

      <div class="wrap">
        <div class="stats">
          <div class="stat"><b>${fa(405)}</b><small>برند یکتا</small></div>
          <div class="stat"><b>${fa(834)}</b><small>فایل لوگو</small></div>
          <div class="stat"><b>${fa(21)}</b><small>دسته‌ی صنعتی</small></div>
        </div>
      </div>

      <section id="logos">
        <div class="wrap">
          <p class="kicker">مجموعه</p>
          <h2 class="title">گالری لوگوها</h2>
          <p class="lead">روی هر لوگو بزنید تا صفحه‌ی اختصاصی آن با دانلود SVG و PNG باز شود.</p>
          <div class="toolbar">
            <label class="search"><span class="sr-only">جستجو</span>
              <input id="q" type="search" placeholder="جستجوی نام برند…" autocomplete="off" value="${esc(state.q)}">
            </label>
            <select id="cat" aria-label="دسته">
              <option value="all">همه‌ی دسته‌ها</option>
            </select>
            <div class="seg" role="group" aria-label="نسخه">
              <button type="button" data-v="all" class="${state.v === "all" ? "on" : ""}">همه</button>
              <button type="button" data-v="color" class="${state.v === "color" ? "on" : ""}">رنگی</button>
              <button type="button" data-v="mono" class="${state.v === "mono" ? "on" : ""}">تک‌رنگ</button>
            </div>
            <span class="count" id="count" aria-live="polite"></span>
          </div>
          <div class="grid" id="grid"></div>
          <div class="empty hidden" id="empty">موردی پیدا نشد.</div>
          <div class="more"><button class="btn ghost" id="more" type="button" hidden>نمایش بیشتر</button></div>
        </div>
      </section>

      <section id="download" style="padding-top:0">
        <div class="wrap">
          <div class="band">
            <div>
              <h2>همه‌ی لوگوها را یک‌جا بگیرید</h2>
              <p>فایل ZIP شامل SVG، PNG (۵۱۲px با پس‌زمینه‌ی شفاف)، فهرست CSV و لایسنس.</p>
              <div class="chips"><span>SVG</span><span>PNG ۵۱۲px</span><span>CSV</span><span>MIT</span></div>
            </div>
            <a class="btn" href="download/iran-brand-logos-all-formats.zip" download>دانلود ZIP (حدود ۲۶ MB)</a>
          </div>
        </div>
      </section>`;

    const cats = [...new Map(data.map(x => [x.category, x.categoryFa])).entries()]
      .sort((a, b) => a[1].localeCompare(b[1], "fa"));
    $("#cat").insertAdjacentHTML("beforeend", cats.map(([k, v]) => `<option value="${esc(k)}">${esc(v)}</option>`).join(""));
    $("#cat").value = state.cat;

    $("#q").addEventListener("input", e => { clearTimeout(qT); qT = setTimeout(() => { state.q = e.target.value; state.shown = PAGE; render(); }, 180); });
    $("#cat").addEventListener("change", e => { state.cat = e.target.value; state.shown = PAGE; render(); });
    document.querySelectorAll(".seg button").forEach(b => b.addEventListener("click", () => {
      state.v = b.dataset.v; state.shown = PAGE;
      document.querySelectorAll(".seg button").forEach(x => x.classList.toggle("on", x === b));
      render();
    }));
    $("#more").addEventListener("click", () => { state.shown += PAGE; render(); });
    render();
  }
  let qT;

  function filtered() {
    const q = norm(state.q);
    return data.filter(x =>
      (state.cat === "all" || x.category === state.cat) &&
      (state.v === "all" || x.variant === state.v) &&
      (!q || norm(x.name).includes(q) || norm(x.categoryFa).includes(q) || norm(x.slug).includes(q)));
  }

  function render() {
    const list = filtered();
    const grid = $("#grid");
    const part = list.slice(0, state.shown);
    grid.innerHTML = part.map(x => `
      <a class="card reveal" href="#/logo/${encodeURIComponent(x.id)}" aria-label="${esc(x.name)}">
        <div class="tile loading">${imgTag(x)}</div>
        <div class="meta"><div class="name">${esc(x.name)}</div><div class="cat">${esc(x.categoryFa)} · ${x.variant === "mono" ? "تک‌رنگ" : "رنگی"}</div></div>
      </a>`).join("");
    $("#count").textContent = `${fa(list.length)} لوگو`;
    $("#empty").classList.toggle("hidden", list.length > 0);
    $("#more").hidden = list.length <= state.shown;
  }

  /* ---------- detail ---------- */
  function neighbors(x) {
    const list = data.filter(y => y.category === x.category && y.variant === x.variant).sort((a, b) => a.name.localeCompare(b.name, "en"));
    const i = list.findIndex(y => y.id === x.id);
    return { prev: list[(i - 1 + list.length) % list.length], next: list[(i + 1) % list.length] };
  }

  function detail(x) {
    view = "detail";
    document.title = `${x.name} | مخزن لوگوهای ایرانی`;
    const variant = x.variant === "mono" ? "تک‌رنگ" : "رنگی";
    const related = data.filter(y => y.category === x.category && y.id !== x.id && y.slug !== x.slug).slice(0, 6);
    app.innerHTML = `
      <section id="v-logo">
        <div class="wrap">
          <a class="back" href="#logos">${arrow()} بازگشت به گالری</a>
          <div class="detail">
            <div class="stage">${imgTag(x)}</div>
            <div class="info reveal">
              <p class="kicker">${esc(x.categoryFa)}</p>
              <h1 tabindex="-1">${esc(x.name)}</h1>
              <p class="sub">نسخه‌ی ${variant} · SVG و PNG</p>
              <dl>
                <dt>دسته</dt><dd>${esc(x.categoryFa)}</dd>
                <dt>نسخه</dt><dd>${variant}</dd>
                <dt>فایل‌ها</dt><dd>SVG (وکتور) و PNG ۵۱۲px</dd>
              </dl>
              <div class="dl-row">
                <a class="btn" href="${esc(x.svg)}" download="${esc(x.slug)}-${x.variant}.svg"><span>دانلود SVG</span><small>وکتوری</small></a>
                <a class="btn ghost" href="${esc(x.png)}" download="${esc(x.slug)}-${x.variant}.png"><span>دانلود PNG</span><small>۵۱۲px، شفاف</small></a>
              </div>
              <div class="convert">
                <span class="lbl">تبدیل فرمت و اندازه</span>
                <label class="sr-only" for="fmt">فرمت</label>
                <select id="fmt"><option value="png">PNG</option><option value="webp">WebP</option><option value="jpg">JPG (پس‌زمینه‌ی سفید)</option></select>
                <label class="sr-only" for="fmtSize">اندازه</label>
                <select id="fmtSize"><option value="512">۵۱۲px</option><option value="1024" selected>۱۰۲۴px</option><option value="2048">۲۰۴۸px</option></select>
                <button class="btn ghost" id="convBtn" type="button">دانلود با این تنظیمات</button>
              </div>
              <div class="nav-row" style="display:flex;gap:10px;margin-top:28px">
                <a class="btn ghost" href="#/logo/${encodeURIComponent(neighbors(x).prev.id)}" aria-label="لوگوی قبلی">${arrow(true)} قبلی</a>
                <a class="btn ghost" href="#/logo/${encodeURIComponent(neighbors(x).next.id)}" aria-label="لوگوی بعدی">بعدی ${arrow()}</a>
              </div>
            </div>
          </div>
          ${related.length ? `
          <div class="related">
            <p class="kicker">همین دسته</p>
            <h2 class="title" style="font-size:1.6rem">لوگوهای مرتبط</h2>
            <div class="grid" style="margin-top:24px">
              ${related.map(y => `
                <a class="card" href="#/logo/${encodeURIComponent(y.id)}" aria-label="${esc(y.name)}">
                  <div class="tile loading">${imgTag(y)}</div>
                  <div class="meta"><div class="name">${esc(y.name)}</div></div>
                </a>`).join("")}
            </div>
          </div>` : ""}
        </div>
      </section>`;

    $("#convBtn").addEventListener("click", () => convert(x, $("#fmt").value, +$("#fmtSize").value));
  }
  function arrow(back = false) {
    return `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${back ? '<path d="M5 12h14M12 5l7 7-7 7"/>' : '<path d="M19 12H5M12 19l-7-7 7-7"/>'}</svg>`;
  }

  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  async function convert(x, fmt, size) {
    try {
      const svgText = await (await fetch(x.svg)).text();
      const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml" }));
      const img = await loadImage(url);
      const cv = document.createElement("canvas"); cv.width = size; cv.height = size;
      const ctx = cv.getContext("2d");
      if (fmt === "jpg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size); }
      const s = Math.min(size / img.naturalWidth, size / img.naturalHeight);
      const w = img.naturalWidth * s, h = img.naturalHeight * s;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      const mime = fmt === "jpg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
      cv.toBlob(blob => {
        URL.revokeObjectURL(url);
        if (!blob) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = `${x.slug}-${x.variant}-${size}.${fmt}`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      }, mime, 0.95);
    } catch (e) { /* ignore: the direct SVG/PNG downloads remain available */ }
  }

  /* ---------- router ---------- */
  function scrollToId(id) {
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" }), 30);
  }
  function route() {
    const h = location.hash || "#/";
    const m = h.match(/^#\/logo\/([^?]+)/);
    if (m) {
      const x = byId.get(decodeURIComponent(m[1]));
      if (x) { detail(x); setHeader(true); window.scrollTo({ top: 0 }); focusMain(); return; }
    }
    if (!h.startsWith("#/")) {
      // in-page anchors: re-render the gallery only when coming from a detail page
      if (view !== "gallery") { gallery(); setHeader(false); }
      scrollToId(h.slice(1));
      return;
    }
    if (view !== "gallery" || h.startsWith("#/?") || h === "#/") {
      gallery();
    }
    setHeader(false);
    window.scrollTo({ top: 0 });
  }

  window.addEventListener("hashchange", route);
  window.addEventListener("scroll", () => setHeader(window.scrollY > 40 || location.hash.startsWith("#/logo/")), { passive: true });

  /* keyboard: "/" focuses search, Escape clears it */
  document.addEventListener("keydown", e => {
    if (e.target.matches("input,textarea,select")) { if (e.key === "Escape") e.target.blur(); return; }
    if (e.key === "/" && $("#q")) { e.preventDefault(); $("#q").focus(); }
    if (location.hash.startsWith("#/logo/")) {
      if (e.key === "ArrowRight") goNeighbor(-1);
      if (e.key === "ArrowLeft") goNeighbor(1);
    }
  });
  function goNeighbor(dir) {
    const m = location.hash.match(/^#\/logo\/([^?]+)/); if (!m) return;
    const x = byId.get(decodeURIComponent(m[1])); if (!x) return;
    const n = neighbors(x);
    location.hash = "#/logo/" + encodeURIComponent((dir < 0 ? n.prev : n.next).id);
  }

  /* ---------- data ---------- */
  fetch("data/logos.json")
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(json => {
      data = json;
      byId = new Map(json.map(x => [x.id, x]));
      const meta = $("#meta"); if (meta) meta.textContent = `داده‌ها: ${fa(json.length)} فایل`;
      route();
      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      }
    })
    .catch(() => {
      app.innerHTML = `<section><div class="wrap empty" role="alert">بارگذاری داده‌ها ناموفق بود.<br><button class="btn ghost" id="retry" type="button" style="margin-top:20px">تلاش دوباره</button></div></section>`;
      $("#retry").addEventListener("click", () => location.reload());
    });
})();
