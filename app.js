/* مخزن لوگوهای برندهای ایرانی — منطق برنامه (vanilla JS، بدون وابستگی) */
(() => {
  "use strict";

  /* ---------- constants ---------- */
  const REPO = "https://github.com/matrixteam403-hash/iran-logo-kit";
  const ZIP = "download/iran-brand-logos-all-formats.zip";
  const PAGE = 60;
  const FEATURED = [
    "app-store-color-bazar", "website-applications-color-digikala", "isp-color-irancell", "vod-color-filimo",
    "website-applications-color-snapp-food", "banks-color-mellat", "vod-color-aparat"
  ];
  const DEFAULTS = { q: "", cat: "all", v: "color", sort: "default" };
  const TILE_KEY = "ilk.tiles";

  /* ---------- helpers ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const app = $("#app");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fa = n => Number(n).toLocaleString("fa-IR");
  const icon = (id, cls = "") => `<svg class="${cls}" aria-hidden="true"><use href="#i-${id}"/></svg>`;
  const variantFa = x => (x.variant === "mono" ? "تک‌رنگ" : "رنگی");
  const dlName = (x, ext) => `${x.slug}-${x.variant}.${ext}`;
  const fmtBytes = b => (b >= 1048576 ? `${fa((b / 1048576).toFixed(1))} MB` : `${fa(Math.max(0.1, b / 1024).toFixed(1))} KB`);
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  const absUrl = p => new URL(p, location.href.split("#")[0]).href;

  /* Persian-aware normalisation */
  const norm = s => (s || "").toString().toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[\u200c\u200d\u200e\u200f]/g, "")
    .replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه")
    .replace(/[۰-۹]/g, d => "۰۱۲۳۴۵۶۷۸۹".indexOf(d)).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[-_.]+/g, " ").replace(/\s+/g, " ").trim();

  /* consonant "skeleton", so that Persian queries (دیجی کالا) match Latin names (Digikala) */
  const FA_SK = { "ب": "b", "پ": "p", "ت": "t", "ط": "t", "ث": "s", "س": "s", "ص": "s", "ج": "j", "چ": "c", "خ": "k", "د": "d", "ذ": "z", "ز": "z", "ض": "z", "ظ": "z", "ژ": "z", "ر": "r", "ش": "s", "غ": "j", "ق": "j", "گ": "j", "ف": "f", "ک": "k", "ل": "l", "م": "m", "ن": "n" };
  function skel(s) {
    s = norm(s);
    let out = "";
    if (/[\u0600-\u06FF]/.test(s)) {
      for (const ch of s) out += FA_SK[ch] || (/[0-9]/.test(ch) ? ch : "");
    } else {
      out = s.replace(/[^a-z0-9]/g, "")
        .replace(/ch/g, "C").replace(/sh/g, "s").replace(/kh/g, "k").replace(/gh/g, "j").replace(/zh/g, "z").replace(/ph/g, "f").replace(/ck/g, "k")
        .replace(/c(?=[eiy])/g, "s").replace(/c/g, "k").replace(/C/g, "c")
        .replace(/q/g, "j").replace(/g/g, "j").replace(/x/g, "ks")
        .replace(/[aeiouywvh]/g, "");
    }
    return out.replace(/(.)\1+/g, "$1");
  }

  /* ---------- state ---------- */
  let data = [];
  let byId = new Map();
  let cats = [];            // [{ key, fa, total }] sorted by size
  let catOrder = new Map();
  let stats = {};
  const state = { ...DEFAULTS, shown: PAGE };
  let view = null;

  /* ---------- images: SVG first, PNG fallback, letter placeholder ---------- */
  function imgTag(x, cls = "", lazy = true) {
    return `<img class="${cls}" src="${esc(x.svg)}" data-png="${esc(x.png)}" data-letter="${esc(x.name.charAt(0))}" alt="${esc(x.name)}"${lazy ? ' loading="lazy"' : ""} decoding="async">`;
  }
  document.addEventListener("error", e => {
    const img = e.target;
    if (!(img instanceof HTMLImageElement) || !img.dataset.png) return;
    if (img.dataset.fallback !== "1") { img.dataset.fallback = "1"; img.src = img.dataset.png; return; }
    img.closest(".ld")?.classList.remove("ld");
    const ph = document.createElement("div");
    ph.className = "ph"; ph.textContent = img.dataset.letter || "?";
    img.replaceWith(ph);
  }, true);
  document.addEventListener("load", e => {
    if (e.target instanceof HTMLImageElement) e.target.closest(".ld")?.classList.remove("ld");
  }, true);
  function settleImages(root = document) {
    $$(".ld img", root).forEach(img => { if (img.complete && img.naturalWidth) img.closest(".ld")?.classList.remove("ld"); });
  }
  function tileAttrs(x, extra = "") {
    const lt = x.tone === "light";
    const glow = x.tint && !lt ? ` style="--glow:${rgba(x.tint, 0.26)}"` : "";
    return `class="${extra} ${x.variant}${lt ? " lt" : ""}"${glow}`;
  }

  /* ---------- search ---------- */
  function matchScore(x, q, toks) {
    if (!q) return 1;
    let score = 0;
    if (x._n === q) score = 100;
    else if (x._n.startsWith(q)) score = 80;
    else if (x._n.includes(q) || x._slug.includes(q)) score = 60;
    else {
      const qs = skel(q);
      if (qs.length >= 2 && x._s === qs) score = 56;
      else if (qs.length >= 2 && x._s.startsWith(qs)) score = 50;
      else if (qs.length >= 2 && x._s.includes(qs)) score = 40;
    }
    if (score) return score;
    // every word must match the name, slug or category
    for (const t of toks) {
      const ts = skel(t);
      const ok = x._n.includes(t) || x._slug.includes(t) || x._c.includes(t) || (ts.length >= 2 && x._s.includes(ts));
      if (!ok) return 0;
    }
    return 20;
  }
  function search(list, q) {
    q = norm(q);
    if (!q) return list.map(x => [x, 1]);
    const toks = q.split(" ").filter(Boolean);
    const out = [];
    for (const x of list) { const s = matchScore(x, q, toks); if (s) out.push([x, s]); }
    return out;
  }

  /* ---------- filtering ---------- */
  function sorter(kind, scored) {
    const byName = (a, b) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });
    if (kind === "az") return (a, b) => byName(a[0], b[0]) || (a[0].variant < b[0].variant ? -1 : 1);
    if (kind === "za") return (a, b) => byName(b[0], a[0]) || (a[0].variant < b[0].variant ? -1 : 1);
    return (a, b) =>
      (scored ? b[1] - a[1] : 0) ||
      catOrder.get(a[0].category) - catOrder.get(b[0].category) ||
      byName(a[0], b[0]) ||
      (a[0].variant < b[0].variant ? -1 : 1);
  }
  function compute() {
    const hits = search(data, state.q);
    const counts = { all: 0, color: 0, mono: 0 };
    const perCat = new Map();
    const list = [];
    for (const h of hits) {
      const x = h[0];
      const inCat = state.cat === "all" || x.category === state.cat;
      if (inCat) { counts.all++; counts[x.variant]++; }
      if (state.v === "all" || x.variant === state.v) {
        perCat.set(x.category, (perCat.get(x.category) || 0) + 1);
        if (inCat) list.push(h);
      }
    }
    list.sort(sorter(state.sort, !!state.q));
    return { list: list.map(h => h[0]), counts, perCat };
  }

  /* ---------- url <-> state ---------- */
  function buildHash(s = state) {
    const p = new URLSearchParams();
    for (const k of ["q", "cat", "v", "sort"]) if (s[k] && s[k] !== DEFAULTS[k]) p.set(k, s[k]);
    const qs = p.toString();
    return qs ? `#/?${qs}` : "#/";
  }
  function applyParams(params) {
    state.q = params.get("q") || "";
    const c = params.get("cat");
    state.cat = c && catOrder.has(c) ? c : "all";
    const v = params.get("v");
    state.v = ["all", "color", "mono"].includes(v) ? v : DEFAULTS.v;
    const so = params.get("sort");
    state.sort = ["default", "az", "za"].includes(so) ? so : "default";
  }
  function syncUrl() {
    const h = buildHash();
    if (location.hash !== h && !(h === "#/" && !location.hash)) history.replaceState(null, "", h);
  }

  /* ---------- home extras: marquee + spotlight ---------- */
  function marquee() {
    const byCat = new Map(cats.map(c => [c.key, []]));
    data.forEach(x => { if (x.variant === "color") byCat.get(x.category)?.push(x); });
    const pool = [];
    byCat.forEach(arr => pool.push(...arr.slice(0, 2)));
    for (let i = pool.length - 1; i > 0; i--) { const j = (i * 7 + 3) % (i + 1); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    const tiles = pool.slice(0, 34).map(x =>
      `<a class="mq-tile" href="#/logo/${encodeURIComponent(x.id)}" aria-label="${esc(x.name)}">${imgTag(x, "", false)}</a>`).join("");
    return `
      <div class="mq" aria-label="نمونه‌ای از برندهای مخزن">
        <div class="mq-row"><div class="mq-track">${tiles}${tiles}</div></div>
        <div class="mq-row mq-rev"><div class="mq-track">${tiles}${tiles}</div></div>
      </div>`;
  }

  function spotlight() {
    const items = FEATURED.map(id => byId.get(id)).filter(Boolean);
    return `
      <section class="sec spot-sec" aria-labelledby="s-t">
        <div class="sec-head rv">
          <div>
            <h2 id="s-t">ویترین برندها</h2>
            <p>نگاهی نزدیک به چند برند پرطرفدار؛ با یک کلیک وارد صفحه‌ی اختصاصی شوید.</p>
          </div>
          <div class="spot-nav">
            <button type="button" class="iconbtn" data-spot="-1" aria-label="قبلی">${icon("chev")}</button>
            <button type="button" class="iconbtn" data-spot="1" aria-label="بعدی">${icon("chev-r")}</button>
          </div>
        </div>
        <div class="spot" id="spot">
          ${items.map(x => `
            <article class="spot-card">
              <a class="spot-link" href="#/logo/${encodeURIComponent(x.id)}" aria-label="صفحه‌ی ${esc(x.name)}">
                <div ${tileAttrs(x, "tile spot-tile")}>${imgTag(x)}</div>
              </a>
              <div class="spot-meta"><b>${esc(x.name)}</b><span>${esc(x.categoryFa)} · ${variantFa(x)}</span></div>
              <div class="spot-actions">
                <a class="btn btn-sm" href="#/logo/${encodeURIComponent(x.id)}">${icon("eye")}دیدن صفحه</a>
                <a class="btn btn-ghost btn-sm" href="${esc(x.svg)}" download="${esc(dlName(x, "svg"))}">${icon("download")}SVG</a>
              </div>
            </article>`).join("")}
        </div>
      </section>`;
  }

  function scrollSpot(dir) {
    const el = $("#spot");
    if (!el) return;
    const cards = $$(".spot-card", el);
    if (!cards.length) return;
    const rb = el.getBoundingClientRect();
    let cur = 0, best = Infinity;
    cards.forEach((c, i) => {
      const d = Math.abs(c.getBoundingClientRect().right - rb.right);
      if (d < best) { best = d; cur = i; }
    });
    const t = Math.max(0, Math.min(cards.length - 1, cur + dir));
    cards[t].scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  }

  /* ---------- reveal on scroll + count-up + hero parallax ---------- */
  const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
  let io = null;
  function observeReveal() {
    const els = $$(".card:not(.in), .rv:not(.in), .spot-card:not(.in)");
    if (!("IntersectionObserver" in window) || reduced()) { els.forEach(el => el.classList.add("in")); return; }
    io = io || new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        const el = en.target;
        el.style.transitionDelay = (el.dataset.rvd || 0) + "ms";
        el.classList.add("in");
        setTimeout(() => { el.style.transitionDelay = ""; }, 900);
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });
    els.forEach((el, i) => { el.dataset.rvd = (i % 12) * 40; io.observe(el); });
  }

  function countUp(el) {
    const target = +el.dataset.cnt;
    if (reduced()) { el.textContent = fa(target); return; }
    const t0 = performance.now(), dur = 1100;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = fa(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function heroFx() {
    $$("[data-cnt]").forEach(countUp);
    const promo = $(".promo");
    if (!promo || !matchMedia("(pointer:fine)").matches || reduced()) return;
    promo.addEventListener("pointermove", e => {
      const r = promo.getBoundingClientRect();
      promo.style.setProperty("--px", (((e.clientX - r.left) / r.width) - .5).toFixed(3));
      promo.style.setProperty("--py", (((e.clientY - r.top) / r.height) - .5).toFixed(3));
    });
    promo.addEventListener("pointerleave", () => {
      promo.style.setProperty("--px", 0);
      promo.style.setProperty("--py", 0);
    });
  }

  /* ---------- home ---------- */
  function home() {
    view = "home";
    document.title = "مخزن لوگوهای برندهای ایرانی";
    const art = FEATURED.map(id => byId.get(id)).filter(Boolean)
      .map(x => `<div class="art">${imgTag(x, "", false)}</div>`).join("");

    app.innerHTML = `
      <div class="wrap">
        <section class="promo" aria-labelledby="hero-t">
          <div class="promo-bg"></div>
          <i class="sheen" aria-hidden="true"></i>
          <div class="promo-art" aria-hidden="true">${art}</div>
          <div class="promo-body">
            <div class="chips">
              <span class="score">فایل <b data-cnt="${stats.files}">${fa(0)}</b></span>
              <span class="chip"><b data-cnt="${stats.brands}">${fa(0)}</b> برند</span>
              <span class="chip"><b data-cnt="${stats.cats}">${fa(0)}</b> دسته</span>
              <span class="chip">SVG · PNG</span>
            </div>
            <h1 id="hero-t" tabindex="-1">همه‌ی لوگوهای برندهای ایرانی، یک‌جا!</h1>
            <p>مجموعه‌ای رایگان و متن‌باز؛ <strong>${fa(stats.logos)} لوگو</strong> در <strong>${fa(stats.cats)} دسته</strong>، هرکدام در نسخه‌ی رنگی و تک‌رنگ، با فرمت وکتوری SVG و PNG شفاف.</p>
            <div class="actions">
              <a class="btn btn-white" href="#logos" data-go="logos">${icon("grid")}مرور لوگوها</a>
              <a class="btn btn-glass" href="${ZIP}" download>${icon("download")}دانلود همه (ZIP)</a>
            </div>
          </div>
        </section>

        ${marquee()}

        ${spotlight()}

        <section class="sec" id="logos" aria-labelledby="g-t">
          <div class="sec-head rv">
            <div>
              <h2 id="g-t">گالری لوگوها</h2>
              <p>روی هر لوگو بزنید تا صفحه‌ی اختصاصی آن با دانلود SVG و PNG باز شود.</p>
            </div>
            <a class="btn btn-ghost btn-sm" href="#/random" data-random>${icon("shuffle")}لوگوی تصادفی</a>
          </div>

          <div class="cats" id="cats" role="group" aria-label="دسته‌ها">
            <button class="cat" type="button" data-cat="all">همه <em></em></button>
            ${cats.map(c => `<button class="cat" type="button" data-cat="${esc(c.key)}">${esc(c.fa)} <em></em></button>`).join("")}
          </div>

          <div class="tabs" role="group" aria-label="نسخه">
            <button class="tab" type="button" data-v="color">${icon("palette")}رنگی <span class="n" data-n="color"></span></button>
            <button class="tab" type="button" data-v="mono">${icon("moon")}تک‌رنگ <span class="n" data-n="mono"></span></button>
            <button class="tab" type="button" data-v="all">${icon("grid")}همه <span class="n" data-n="all"></span></button>
            <div class="tabs-end">
              <div class="seg" role="group" aria-label="پس‌زمینه‌ی کاشی‌ها">
                <button type="button" data-tiles="auto" title="پس‌زمینه‌ی خودکار برای هر لوگو">${icon("auto")}<span>خودکار</span></button>
                <button type="button" data-tiles="dark" title="پس‌زمینه‌ی تیره">${icon("moon")}<span>تیره</span></button>
                <button type="button" data-tiles="light" title="پس‌زمینه‌ی روشن">${icon("sun")}<span>روشن</span></button>
              </div>
              <label class="sr-only" for="sort">مرتب‌سازی</label>
              <select class="select" id="sort">
                <option value="default">مرتب‌سازی: پیش‌فرض</option>
                <option value="az">نام: A تا Z</option>
                <option value="za">نام: Z تا A</option>
              </select>
            </div>
          </div>

          <div class="resbar" id="resbar" aria-live="polite"></div>
          <div class="grid" id="grid"></div>
          <div class="empty hidden" id="empty">
            <b>موردی پیدا نشد</b>
            عبارت دیگری را امتحان کنید یا فیلترها را پاک کنید.
            <div><button class="btn btn-ghost" type="button" data-clear>پاک کردن فیلترها</button></div>
          </div>
          <div class="more" id="more" hidden>
            <button class="btn btn-ghost" type="button" data-more>نمایش بیشتر</button>
            <div class="progress"><i id="prog"></i></div>
            <small id="moreTxt"></small>
          </div>
        </section>

        <section class="sec" id="download" aria-labelledby="d-t">
          <div class="band rv">
            <div class="band-txt">
              <span class="band-ic">${icon("zip")}</span>
              <div>
                <h2 id="d-t">همه‌ی لوگوها را یک‌جا بگیرید</h2>
                <p>فایل ZIP شامل SVG، PNG (۵۱۲px با پس‌زمینه‌ی شفاف)، فهرست CSV و لایسنس.</p>
                <div class="chips"><span class="chip">SVG</span><span class="chip">PNG ۵۱۲px</span><span class="chip">CSV</span><span class="chip">MIT</span></div>
              </div>
            </div>
            <a class="btn btn-white btn-lg" href="${ZIP}" download>${icon("download")}دانلود ZIP (حدود ۲۶ مگابایت)</a>
          </div>
        </section>
      </div>`;
    syncControls();
    renderGrid();
    heroFx();
    observeReveal();
    const row = $("#cats");
    const edge = () => row.classList.toggle("at-end", Math.abs(row.scrollLeft) + row.clientWidth >= row.scrollWidth - 4);
    row.addEventListener("scroll", edge, { passive: true });
    edge();
  }

  function syncControls() {
    if (view !== "home") return;
    const mark = (b, on) => { b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); };
    $$("#cats .cat").forEach(b => mark(b, b.dataset.cat === state.cat));
    $$(".tabs .tab[data-v]").forEach(b => mark(b, b.dataset.v === state.v));
    $$(".seg [data-tiles]").forEach(b => mark(b, b.dataset.tiles === document.body.dataset.tiles));
    const so = $("#sort"); if (so) so.value = state.sort;
    const hq = $("#hq"); if (hq && document.activeElement !== hq) hq.value = state.q;
  }

  function card(x, showVariant) {
    return `
      <article class="card">
        <a class="card-link" href="#/logo/${encodeURIComponent(x.id)}" aria-label="${esc(x.name)} — ${esc(x.categoryFa)}، ${variantFa(x)}"></a>
        <div ${tileAttrs(x, "tile ld")}>${imgTag(x)}
          <div class="quick">
            <a href="${esc(x.svg)}" download="${esc(dlName(x, "svg"))}" aria-label="دانلود SVG ${esc(x.name)}">${icon("download")}SVG</a>
            <a href="${esc(x.png)}" download="${esc(dlName(x, "png"))}" aria-label="دانلود PNG ${esc(x.name)}">${icon("download")}PNG</a>
          </div>
        </div>
        <div class="card-meta">
          <div class="card-name">${esc(x.name)}</div>
          <div class="card-cat">${esc(x.categoryFa)}${showVariant ? ` · <span class="v">${variantFa(x)}</span>` : ""}</div>
        </div>
      </article>`;
  }

  function renderGrid() {
    const { list, counts, perCat } = compute();
    const grid = $("#grid");
    if (!grid) return;
    const part = list.slice(0, state.shown);
    grid.innerHTML = part.map(x => card(x, state.v === "all")).join("");
    settleImages(grid);
    observeReveal();

    $$(".tabs [data-n]").forEach(n => { n.textContent = fa(counts[n.dataset.n]); });
    let total = 0;
    $$("#cats .cat").forEach(b => {
      const k = b.dataset.cat;
      if (k === "all") return;
      const n = perCat.get(k) || 0; total += n;
      b.querySelector("em").textContent = fa(n);
    });
    $('#cats .cat[data-cat="all"] em').textContent = fa(total);

    const catName = state.cat !== "all" ? cats.find(c => c.key === state.cat)?.fa : "";
    const chips = [];
    if (state.q) chips.push(`<span class="fchip">جستجو: «${esc(state.q)}» <button type="button" data-unset="q" aria-label="حذف جستجو">${icon("close")}</button></span>`);
    if (catName) chips.push(`<span class="fchip">${esc(catName)} <button type="button" data-unset="cat" aria-label="حذف فیلتر دسته">${icon("close")}</button></span>`);
    $("#resbar").innerHTML = `<span><b>${fa(list.length)}</b> لوگو${state.v !== "all" ? `ی ${variantFa({ variant: state.v })}` : ""}</span>${chips.join("")}${chips.length > 1 ? `<button class="linkish" type="button" data-clear>پاک کردن همه</button>` : ""}`;

    $("#empty").classList.toggle("hidden", list.length > 0);
    const more = $("#more");
    more.hidden = list.length <= state.shown;
    if (!more.hidden) {
      $("#moreTxt").textContent = `${fa(part.length)} از ${fa(list.length)} لوگو`;
      $("#prog").style.width = `${(part.length / list.length) * 100}%`;
      more.querySelector("button").textContent = `نمایش ${fa(Math.min(PAGE, list.length - part.length))} لوگوی دیگر`;
    }
  }

  function setFilter(patch, { scroll = false } = {}) {
    Object.assign(state, patch, { shown: PAGE });
    syncControls();
    renderGrid();
    syncUrl();
    if (scroll) scrollToGallery();
  }
  function scrollToGallery(smooth = true) {
    const el = $("#logos");
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.scrollY - $("#top").offsetHeight - 8;
    window.scrollTo({ top: y, behavior: smooth ? "smooth" : "auto" });
  }

  /* ---------- detail ---------- */
  function neighbors(x) {
    const list = data.filter(y => y.category === x.category && y.variant === x.variant)
      .sort((a, b) => a.name.localeCompare(b.name, "en"));
    const i = list.findIndex(y => y.id === x.id);
    return { prev: list[(i - 1 + list.length) % list.length], next: list[(i + 1) % list.length] };
  }
  function twin(x) {
    return data.find(y => y.category === x.category && y.slug === x.slug && y.variant !== x.variant);
  }

  function detail(x) {
    view = "detail";
    document.title = `لوگوی ${x.name} | مخزن لوگوهای ایرانی`;
    const v = variantFa(x);
    const nb = neighbors(x);
    const other = twin(x);
    const related = data.filter(y => y.category === x.category && y.variant === x.variant && y.id !== x.id);
    const shownRelated = related.slice(0, 12);
    const svgUrl = absUrl(x.svg);
    const pngUrl = absUrl(x.png);
    const lt = x.tone === "light";
    const stageBg = lt ? "light" : "dark";
    const invCls = x.variant === "mono" ? (lt ? "inv-on-dark" : "inv-on-light") : "";
    const glow = x.tint && !lt ? ` style="--glow:${rgba(x.tint, 0.22)}"` : "";
    const codes = [
      ["link", "لینک SVG", svgUrl],
      ["link", "لینک PNG", pngUrl],
      ["code", "HTML", `<img src="${svgUrl}" alt="${x.name}" width="96" height="96">`],
      ["code", "Markdown", `![${x.name}](${svgUrl})`],
      ["code", "CSS", `background-image: url("${svgUrl}");`]
    ];

    app.innerHTML = `
      <div class="wrap">
        <nav class="crumbs" aria-label="مسیر">
          <a href="#/">خانه</a>${icon("chev")}
          <a href="#/?cat=${encodeURIComponent(x.category)}">${esc(x.categoryFa)}</a>${icon("chev")}
          <span aria-current="page">${esc(x.name)}</span>
          <span class="nav">
            <a class="icon-btn" href="#/logo/${encodeURIComponent(nb.prev.id)}" title="لوگوی قبلی (→)" aria-label="لوگوی قبلی: ${esc(nb.prev.name)}">${icon("chev-r")}</a>
            <a class="icon-btn" href="#/logo/${encodeURIComponent(nb.next.id)}" title="لوگوی بعدی (←)" aria-label="لوگوی بعدی: ${esc(nb.next.name)}">${icon("chev")}</a>
          </span>
        </nav>

        <div class="product">
          <aside class="side" aria-label="دانلود و مشخصات">
            <div ${tileAttrs(x, "tile cover ld")}>
              ${imgTag(x, "", false)}
              <span class="ribbon">رایگان</span>
            </div>
            <div class="side-actions">
              <a class="btn btn-block btn-lg" href="${esc(x.svg)}" download="${esc(dlName(x, "svg"))}">${icon("download")}دانلود SVG</a>
              <a class="btn btn-block btn-outline" href="${esc(x.png)}" download="${esc(dlName(x, "png"))}">${icon("image")}دانلود PNG ۵۱۲px</a>
            </div>
            <dl class="specs">
              <div><dt>نوع</dt><dd>${icon("palette")}لوگوی ${v}</dd></div>
              <div><dt>دسته</dt><dd>${icon("tag")}<a href="#/?cat=${encodeURIComponent(x.category)}">${esc(x.categoryFa)}</a></dd></div>
              <div><dt>فرمت‌ها</dt><dd>${icon("file")}<span class="ltr">SVG · PNG</span></dd></div>
              <div><dt>ابعاد PNG</dt><dd>${icon("ruler")}<span class="ltr">512 × 512</span></dd></div>
              ${x.svgSize ? `<div><dt>حجم SVG</dt><dd>${icon("vector")}<span class="ltr">${fmtBytes(x.svgSize)}</span></dd></div>` : ""}
              ${x.pngSize ? `<div><dt>حجم PNG</dt><dd>${icon("image")}<span class="ltr">${fmtBytes(x.pngSize)}</span></dd></div>` : ""}
              ${other ? `<div><dt>نسخه‌ی ${variantFa(other)}</dt><dd><a class="mini${other.tone === "light" ? " lt" : ""}" href="#/logo/${encodeURIComponent(other.id)}" title="مشاهده‌ی نسخه‌ی ${variantFa(other)}" aria-label="مشاهده‌ی نسخه‌ی ${variantFa(other)}">${imgTag(other)}</a></dd></div>` : ""}
            </dl>
          </aside>

          <div class="main">
            <header class="p-head">
              <h1 class="p-title" tabindex="-1"><span>${esc(x.name)}</span></h1>
              <p class="p-sub">لوگوی ${esc(x.name)} از دسته‌ی ${esc(x.categoryFa)} — نسخه‌ی ${v}، آماده‌ی دانلود با فرمت‌های وکتوری و تصویری.</p>
              <div class="chips">
                <span class="score">فرمت <b>SVG</b></span>
                <span class="chip">PNG ۵۱۲px</span>
                <span class="chip">${icon("palette")}${v}</span>
                <span class="chip">${icon("tag")}${esc(x.categoryFa)}</span>
              </div>
            </header>

            <section class="promo promo-sm" aria-labelledby="cv-t">
              <div class="promo-bg"></div>
              <div class="promo-art" aria-hidden="true">
                <div ${tileAttrs(x, "art-one tile")}>${imgTag(x, "", false)}</div>
              </div>
              <div class="promo-body">
                <h2 id="cv-t">لوگوی <span class="ltr">${esc(x.name)}</span> را در هر اندازه‌ای بگیرید!</h2>
                <p>فرمت و اندازه را انتخاب کنید؛ تبدیل همین‌جا در مرورگر شما و از روی فایل وکتوری انجام می‌شود.</p>
                <div class="conv">
                  <label class="sr-only" for="fmt">فرمت</label>
                  <select class="select" id="fmt">
                    <option value="png">PNG شفاف</option>
                    <option value="webp">WebP شفاف</option>
                    <option value="jpg">JPG با زمینه‌ی سفید</option>
                  </select>
                  <label class="sr-only" for="fmtSize">اندازه</label>
                  <select class="select" id="fmtSize">
                    <option value="256">۲۵۶ پیکسل</option>
                    <option value="512">۵۱۲ پیکسل</option>
                    <option value="1024" selected>۱۰۲۴ پیکسل</option>
                    <option value="2048">۲۰۴۸ پیکسل</option>
                    <option value="4096">۴۰۹۶ پیکسل</option>
                  </select>
                  <button class="btn btn-white" id="convBtn" type="button">${icon("download")}دانلود</button>
                </div>
              </div>
            </section>

            <div class="detail-tabs">
              <div class="tabs" role="tablist" aria-label="بخش‌ها">
                <button class="tab on" type="button" role="tab" aria-selected="true" data-panel="preview">${icon("eye")}پیش‌نمایش</button>
                <button class="tab" type="button" role="tab" aria-selected="false" data-panel="code">${icon("code")}کد و لینک</button>
                <button class="tab" type="button" role="tab" aria-selected="false" data-panel="related">${icon("grid")}لوگوهای مرتبط <span class="n">${fa(related.length)}</span></button>
              </div>

              <div class="panel" data-panel="preview" role="tabpanel">
                <div class="stage ${stageBg}" id="stage"${glow}>${imgTag(x, invCls, false)}</div>
                <div class="stage-bar">
                  <div class="seg" role="group" aria-label="پس‌زمینه‌ی پیش‌نمایش">
                    ${[["dark", "تیره"], ["light", "روشن"], ["checker", "شفاف"], ["green", "سبز"]].map(([k, t]) =>
                      `<button type="button" data-stage="${k}" class="${k === stageBg ? "on" : ""}"><i class="swatch ${k}"></i><span>${t}</span></button>`).join("")}
                  </div>
                  <div class="sizes" aria-label="نمایش در اندازه‌های کوچک">
                    ${[16, 24, 32, 48, 64].map(s => `<figure><div style="width:${s}px;height:${s}px${lt ? ";background:#f4f5f7;border-radius:4px;padding:2px" : ""}">${imgTag(x, "")}</div><figcaption>${s}px</figcaption></figure>`).join("")}
                  </div>
                </div>
              </div>

              <div class="panel" data-panel="code" role="tabpanel" hidden>
                <div class="codes">
                  ${codes.map(([ic, label, val]) => `
                    <div class="code-row">
                      <span>${icon(ic)}${label}</span>
                      <code title="${esc(val)}">${esc(val)}</code>
                      <button class="icon-btn copy" type="button" data-copy="${esc(val)}" aria-label="کپی ${label}">${icon("copy")}</button>
                    </div>`).join("")}
                </div>
                <div class="code-actions">
                  <button class="btn btn-ghost" type="button" id="copySvg">${icon("copy")}کپی کد SVG</button>
                  <a class="btn btn-ghost" href="${esc(x.svg)}" target="_blank" rel="noopener">${icon("link")}باز کردن فایل SVG</a>
                </div>
                <p class="note">لوگوها متعلق به برندهای مربوطه‌اند؛ پیش از استفاده‌ی تجاری، راهنمای برند را بررسی کنید.</p>
              </div>

              <div class="panel" data-panel="related" role="tabpanel" hidden>
                ${shownRelated.length ? `<div class="grid">${shownRelated.map(y => card(y, false)).join("")}</div>` : `<div class="empty">لوگوی دیگری در این دسته نیست.</div>`}
                ${related.length > shownRelated.length ? `<div class="more"><a class="btn btn-ghost" href="#/?cat=${encodeURIComponent(x.category)}${x.variant === "mono" ? "&v=mono" : ""}">مشاهده‌ی همه‌ی ${fa(related.length + 1)} لوگوی این دسته</a></div>` : ""}
              </div>
            </div>
          </div>
        </div>
      </div>`;
    settleImages(app);

    $("#convBtn").addEventListener("click", () => convert(x, $("#fmt").value, +$("#fmtSize").value));
    $("#copySvg").addEventListener("click", async e => {
      try { copyText(await (await fetch(x.svg)).text(), e.currentTarget, "کد SVG کپی شد"); }
      catch { toast("کپی ناموفق بود"); }
    });
  }

  function notFound() {
    view = "404";
    document.title = "پیدا نشد | مخزن لوگوهای ایرانی";
    app.innerHTML = `
      <div class="wrap nf">
        <b>۴۰۴</b>
        <h1 tabindex="-1">این لوگو پیدا نشد</h1>
        <p>ممکن است نشانی اشتباه باشد یا لوگو جابه‌جا شده باشد.</p>
        <a class="btn" href="#/">${icon("grid")}بازگشت به گالری</a>
      </div>`;
  }

  /* ---------- convert (in-browser rasterising from the SVG) ---------- */
  function loadImage(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  async function convert(x, fmt, size) {
    const btn = $("#convBtn");
    if (btn) btn.disabled = true;
    try {
      const text = await (await fetch(x.svg)).text();
      const doc = new DOMParser().parseFromString(text, "image/svg+xml");
      const svg = doc.documentElement;
      let vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
      const w0 = parseFloat(svg.getAttribute("width")), h0 = parseFloat(svg.getAttribute("height"));
      if (vb.length !== 4 || vb.some(isNaN)) vb = [0, 0, w0 || 512, h0 || 512];
      if (!svg.getAttribute("viewBox")) svg.setAttribute("viewBox", vb.join(" "));
      const ratio = vb[2] / vb[3] || 1;
      const W = ratio >= 1 ? size : Math.round(size * ratio);
      const H = ratio >= 1 ? Math.round(size / ratio) : size;
      svg.setAttribute("width", W); svg.setAttribute("height", H);
      const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" }));
      const img = await loadImage(url);
      const cv = document.createElement("canvas"); cv.width = size; cv.height = size;
      const ctx = cv.getContext("2d");
      if (fmt === "jpg") { ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, size, size); }
      ctx.drawImage(img, (size - W) / 2, (size - H) / 2, W, H);
      URL.revokeObjectURL(url);
      const mime = fmt === "jpg" ? "image/jpeg" : fmt === "webp" ? "image/webp" : "image/png";
      const blob = await new Promise(r => cv.toBlob(r, mime, 0.95));
      if (!blob) throw new Error("toBlob");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = `${x.slug}-${x.variant}-${size}.${fmt}`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast(`فایل ${fmt.toUpperCase()} ${fa(size)}px آماده شد`);
    } catch (e) {
      toast("تبدیل ناموفق بود؛ از دانلود مستقیم SVG/PNG استفاده کنید");
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  /* ---------- clipboard + toast ---------- */
  let toastT;
  function toast(msg) {
    const t = $("#toast");
    t.innerHTML = `${icon("check")}<span>${esc(msg)}</span>`;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }
  async function copyText(text, btn, msg = "کپی شد") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* ignore */ }
      ta.remove();
    }
    toast(msg);
    if (btn && btn.classList.contains("copy")) {
      btn.classList.add("done"); btn.innerHTML = icon("check");
      setTimeout(() => { btn.classList.remove("done"); btn.innerHTML = icon("copy"); }, 1500);
    }
  }

  /* ---------- header: search with suggestions ---------- */
  const hq = $("#hq");
  const sugg = $("#suggest");
  let sgItems = [];
  let sgActive = -1;
  let sgT;

  function suggestions(q) {
    const pool = data.filter(x => x.variant === "color");
    return search(pool, q).sort(sorter("default", true)).slice(0, 7).map(h => h[0]);
  }
  function showSuggest() {
    const q = hq.value.trim();
    if (!q || !data.length) { hideSuggest(); return; }
    const total = search(data.filter(x => x.variant === "color"), q).length;
    sgItems = suggestions(q);
    sgActive = -1;
    sugg.innerHTML = sgItems.length
      ? sgItems.map((x, i) => `
          <div class="sg-item" role="option" id="sg-${i}" data-i="${i}">
            <span class="sg-thumb${x.tone === "light" ? " lt" : ""}">${imgTag(x, "", false)}</span>
            <span><div class="sg-name">${esc(x.name)}</div><div class="sg-cat">${esc(x.categoryFa)}</div></span>
          </div>`).join("") +
        `<div class="sg-all" role="option" id="sg-all" data-i="all">${icon("search")}نمایش همه‌ی ${fa(total)} نتیجه برای «${esc(q)}»</div>`
      : `<div class="sg-empty">نتیجه‌ای برای «${esc(q)}» پیدا نشد.</div>`;
    sugg.hidden = false;
    hq.setAttribute("aria-expanded", "true");
  }
  function hideSuggest() {
    sugg.hidden = true; sgActive = -1;
    hq.setAttribute("aria-expanded", "false");
    hq.removeAttribute("aria-activedescendant");
  }
  function moveActive(d) {
    const opts = $$(".sg-item,.sg-all", sugg);
    if (!opts.length) return;
    sgActive = (sgActive + d + opts.length) % opts.length;
    opts.forEach((o, i) => o.classList.toggle("on", i === sgActive));
    hq.setAttribute("aria-activedescendant", opts[sgActive].id);
    opts[sgActive].scrollIntoView({ block: "nearest" });
  }
  function submitSearch(q) {
    hideSuggest();
    hq.blur();
    q = q.trim();
    if (view === "home") setFilter({ q }, { scroll: true });
    else location.hash = buildHash({ ...state, q, cat: "all" });
  }
  function pickSuggestion(i) {
    if (i === "all" || i == null) return submitSearch(hq.value);
    const x = sgItems[+i];
    if (!x) return;
    hideSuggest(); hq.blur();
    location.hash = `#/logo/${encodeURIComponent(x.id)}`;
  }
  hq.addEventListener("input", () => { clearTimeout(sgT); sgT = setTimeout(showSuggest, 70); });
  hq.addEventListener("focus", () => { if (hq.value.trim()) showSuggest(); });
  hq.addEventListener("keydown", e => {
    if (e.key === "ArrowDown") { e.preventDefault(); if (sugg.hidden) showSuggest(); else moveActive(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); moveActive(-1); }
    else if (e.key === "Escape") { hideSuggest(); hq.blur(); }
  });
  $("#hsForm").addEventListener("submit", e => {
    e.preventDefault();
    const active = $$(".sg-item,.sg-all", sugg)[sgActive];
    if (!sugg.hidden && active) pickSuggestion(active.dataset.i);
    else submitSearch(hq.value);
  });
  sugg.addEventListener("mousedown", e => e.preventDefault()); // keep focus in the input
  sugg.addEventListener("click", e => {
    const o = e.target.closest("[data-i]");
    if (o) pickSuggestion(o.dataset.i);
  });

  /* ---------- header: menus, drawer, scroll ---------- */
  function closeMenus() {
    $$(".dd.open").forEach(d => { d.classList.remove("open"); d.querySelector(".dd-btn").setAttribute("aria-expanded", "false"); });
  }
  function setDrawer(open) {
    $("#drawer").hidden = !open;
    $("#burger").setAttribute("aria-expanded", String(open));
    $("#burger").innerHTML = icon(open ? "close" : "menu");
  }

  document.addEventListener("click", e => {
    const t = e.target;
    const sp = t.closest("[data-spot]");
    if (sp) { scrollSpot(+sp.dataset.spot); return; }
    const ddBtn = t.closest(".dd-btn");
    if (ddBtn) {
      const dd = ddBtn.parentElement;
      const open = !dd.classList.contains("open");
      closeMenus();
      if (open) { dd.classList.add("open"); ddBtn.setAttribute("aria-expanded", "true"); }
      return;
    }
    if (!t.closest(".dd-menu")) closeMenus();
    else if (t.closest("a")) { closeMenus(); t.closest("a").blur(); }
    if (!t.closest(".hd-search")) hideSuggest();
    if (t.closest("#burger")) { setDrawer($("#drawer").hidden); return; }
    if (t.closest("#drawer a")) setDrawer(false);

    // remember gallery position before opening a logo, so "back" returns to the same spot
    const link = t.closest('a[href^="#/logo/"]');
    if (link && view === "home") {
      try { history.replaceState({ y: window.scrollY, shown: state.shown }, "", location.hash || "#/"); } catch { /* ignore */ }
    }

    if (t.closest("[data-random]")) { e.preventDefault(); goRandom(); return; }
    const go = t.closest("[data-go]");
    if (go) { e.preventDefault(); scrollToGallery(); return; }

    // gallery controls
    const catBtn = t.closest("#cats .cat");
    if (catBtn) { setFilter({ cat: catBtn.dataset.cat }); catBtn.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }); return; }
    const tab = t.closest(".tabs .tab[data-v]");
    if (tab) { setFilter({ v: tab.dataset.v }); return; }
    const tileBtn = t.closest("[data-tiles]");
    if (tileBtn && tileBtn.tagName === "BUTTON") { setTiles(tileBtn.dataset.tiles); return; }
    if (t.closest("[data-more]")) { state.shown += PAGE; renderGrid(); return; }
    const unset = t.closest("[data-unset]");
    if (unset) { setFilter({ [unset.dataset.unset]: DEFAULTS[unset.dataset.unset] }); return; }
    if (t.closest("[data-clear]")) { setFilter({ q: "", cat: "all" }); return; }

    // detail controls
    const ptab = t.closest(".tab[data-panel]");
    if (ptab) {
      $$(".tab[data-panel]").forEach(b => { const on = b === ptab; b.classList.toggle("on", on); b.setAttribute("aria-selected", String(on)); });
      $$(".panel[data-panel]").forEach(p => { p.hidden = p.dataset.panel !== ptab.dataset.panel; });
      settleImages(app);
      return;
    }
    const st = t.closest("[data-stage]");
    if (st) {
      $("#stage").className = `stage ${st.dataset.stage}`;
      $$("[data-stage]").forEach(b => b.classList.toggle("on", b === st));
      return;
    }
    const cp = t.closest("[data-copy]");
    if (cp) { copyText(cp.dataset.copy, cp); return; }
  });

  document.addEventListener("change", e => {
    if (e.target.id === "sort") setFilter({ sort: e.target.value });
  });

  function setTiles(mode) {
    document.body.dataset.tiles = mode;
    try { localStorage.setItem(TILE_KEY, mode); } catch { /* ignore */ }
    $$(".seg [data-tiles]").forEach(b => { const on = b.dataset.tiles === mode; b.classList.toggle("on", on); b.setAttribute("aria-pressed", String(on)); });
  }
  try {
    const saved = localStorage.getItem(TILE_KEY);
    if (["auto", "dark", "light"].includes(saved)) document.body.dataset.tiles = saved;
  } catch { /* ignore */ }

  function goRandom() {
    const pool = data.filter(x => x.variant === "color");
    if (!pool.length) return;
    const x = pool[Math.floor(Math.random() * pool.length)];
    location.hash = `#/logo/${encodeURIComponent(x.id)}`;
  }

  const hd = $("#top");
  const fab = $("#toTop");
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      hd.classList.toggle("scrolled", window.scrollY > 4);
      fab.hidden = window.scrollY < 700;
      ticking = false;
    });
  }, { passive: true });
  fab.addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));

  /* keyboard: "/" focuses search, arrows move between logos on a logo page */
  document.addEventListener("keydown", e => {
    if (e.target.matches("input,textarea,select")) return;
    if (e.key === "Escape") { closeMenus(); setDrawer(false); }
    if (e.key === "/" && !e.ctrlKey && !e.metaKey) { e.preventDefault(); hq.focus(); hq.select(); }
    if (view === "detail" && !e.altKey && !e.ctrlKey && !e.metaKey) {
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

  /* ---------- router ---------- */
  function focusMain() {
    const h = app.querySelector("h1");
    if (h) h.focus({ preventScroll: true });
  }
  function route() {
    const h = location.hash || "#/";
    closeMenus(); hideSuggest(); setDrawer(false);

    const m = h.match(/^#\/logo\/([^?]+)/);
    if (m) {
      const x = byId.get(decodeURIComponent(m[1]));
      if (x) detail(x); else notFound();
      window.scrollTo({ top: 0 });
      focusMain();
      return;
    }
    if (h === "#/random") { const pool = data.filter(x => x.variant === "color"); location.replace(`#/logo/${encodeURIComponent(pool[Math.floor(Math.random() * pool.length)].id)}`); return; }
    if (!h.startsWith("#/")) {
      // in-page anchors: #about lives in the footer, #logos / #download on the home page
      const id = decodeURIComponent(h.slice(1));
      if (!view) home();
      const outside = document.getElementById(id);
      if (outside && !app.contains(outside)) { outside.scrollIntoView({ behavior: "smooth" }); return; }
      if (view !== "home") home();
      const el = document.getElementById(id);
      if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 30);
      return;
    }

    // home, optionally with filters: #/?q=..&cat=..&v=..&sort=..
    const params = new URLSearchParams(h.split("?")[1] || "");
    const saved = history.state;
    applyParams(params);
    state.shown = saved && saved.shown ? Math.max(PAGE, saved.shown) : PAGE;
    if (view === "home") { syncControls(); renderGrid(); } else home();

    if (saved && typeof saved.y === "number") {
      window.scrollTo({ top: saved.y });
    } else if (params.has("cat") || params.has("q") || params.has("v")) {
      scrollToGallery(false);
    } else {
      window.scrollTo({ top: 0 });
      focusMain();
    }
  }
  window.addEventListener("hashchange", route);
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  /* ---------- data ---------- */
  function buildMenus() {
    const catLink = c => `<a href="#/?cat=${encodeURIComponent(c.key)}"><span>${esc(c.fa)}</span><em>${fa(c.total / 2)}</em></a>`;
    $("#catMenu").innerHTML = cats.map(catLink).join("");
    $("#drawerCats").innerHTML = cats.map(catLink).join("");
    $("#ftCats").innerHTML = cats.slice(0, 6).map(c => `<li><a href="#/?cat=${encodeURIComponent(c.key)}">${esc(c.fa)} <em>(${fa(c.total / 2)})</em></a></li>`).join("");
    const year = new Intl.DateTimeFormat("fa-IR-u-ca-persian", { year: "numeric" }).format(new Date());
    $("#meta").textContent = `داده‌ها: ${fa(stats.files)} فایل · ${fa(stats.logos)} لوگو · ${year}`;
    $("#ghCount").textContent = String(stats.files);
  }

  fetch("data/logos.json")
    .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(json => {
      data = json;
      for (const x of data) {
        x._n = norm(x.name);
        x._slug = norm(x.slug);
        x._c = norm(x.categoryFa);
        x._s = skel(x.name);
      }
      byId = new Map(data.map(x => [x.id, x]));
      const m = new Map();
      for (const x of data) {
        if (!m.has(x.category)) m.set(x.category, { key: x.category, fa: x.categoryFa, total: 0 });
        m.get(x.category).total++;
      }
      cats = [...m.values()].sort((a, b) => b.total - a.total || a.fa.localeCompare(b.fa, "fa"));
      catOrder = new Map(cats.map((c, i) => [c.key, i]));
      stats = {
        files: data.length,
        logos: data.filter(x => x.variant === "color").length,
        brands: new Set(data.map(x => x.slug)).size,
        cats: cats.length
      };
      buildMenus();
      route();
      if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
        navigator.serviceWorker.register("sw.js").catch(() => {});
      }
    })
    .catch(() => {
      app.innerHTML = `<div class="wrap nf" role="alert"><b>!</b><h1>بارگذاری داده‌ها ناموفق بود</h1><p>اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.</p><button class="btn" id="retry" type="button">تلاش دوباره</button></div>`;
      $("#retry").addEventListener("click", () => location.reload());
    });
})();
