/* ============================================
   Vkusno Polezno — Universal data loader
   ============================================
   Loads /data/*.json on every page and renders
   content via data-bind attributes.

   Supported attributes on any element:
     data-bind="path.to.value"
       Replaces textContent (or [innerHTML] if value contains "<")
       with the resolved value from JSON. If the value is an
       i18n object {ru,kz,en}, it picks current language.

     data-bind-attr="attr1:path1; attr2:path2"
       Sets attributes on the element from data.

     data-bind-href="contacts.whatsapp" or social.* etc
       Resolves to a URL (mailto:, tel:, https://wa.me/, etc).

     data-bind-list="path.to.array" data-tpl="#templateId"
       Repeats template HTML for each item; placeholders
       inside template are {{field}} or {{field.sub}}.

     data-bind-show="path.to.boolean"
       Hides element if value is falsy.

   Data sources (auto-loaded):
     /data/site.json     → top.site
     /data/products.json → top.products
     /data/pages.json    → top.pages
     /data/reviews.json  → top.reviews
     /data/gallery.json  → top.gallery

   Path examples:
     site.contacts.phone
     site.brand.tagline
     pages.home.hero.title
     pages.home.features.items
     products.items
     reviews.items
   ============================================ */

(function () {
  const VERSION = "v" + Date.now();
  const STORE = { site: {}, products: {}, pages: {}, reviews: {}, gallery: {} };
  const FILES = ["site", "products", "pages", "reviews", "gallery"];

  // ── language ──────────────────────────────────
  function getLang() {
    try {
      const stored = localStorage.getItem("vp_lang");
      if (["ru", "kz", "en"].includes(stored)) return stored;
    } catch (e) {}
    const html = document.documentElement.lang || "ru";
    return ["ru", "kz", "en"].includes(html) ? html : "ru";
  }

  // ── path resolver ─────────────────────────────
  function resolvePath(path) {
    if (!path) return undefined;
    const parts = path.split(".");
    let cur = STORE;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function pickI18n(val, lang) {
    if (val == null) return val;
    if (typeof val === "object" && !Array.isArray(val) && (val.ru || val.kz || val.en)) {
      return val[lang] || val.ru || val.en || "";
    }
    return val;
  }

  // ── template interpolation ────────────────────
  function fillTemplate(html, item, lang, index) {
    return html.replace(/\{\{\s*([^}]+)\s*\}\}/g, function (_, key) {
      key = key.trim();
      if (key === "@index") return String(index);
      if (key === "@index1") return String(index + 1);
      const parts = key.split(".");
      let cur = item;
      for (const p of parts) {
        if (cur == null) return "";
        cur = cur[p];
      }
      const v = pickI18n(cur, lang);
      if (v == null) return "";
      return String(v);
    });
  }

  // ── core renderers ────────────────────────────
  function applyText(el, value) {
    if (value == null) {
      el.textContent = "";
      return;
    }
    const s = String(value);
    if (/<[a-z][\s\S]*>/i.test(s)) {
      el.innerHTML = s;
    } else {
      el.textContent = s;
    }
  }

  function renderBinds(root, lang) {
    // 1. data-bind (text/html)
    root.querySelectorAll("[data-bind]").forEach(function (el) {
      const path = el.getAttribute("data-bind");
      const raw = resolvePath(path);
      const v = pickI18n(raw, lang);
      if (v != null && typeof v !== "object") applyText(el, v);
    });

    // 2. data-bind-attr="src:contacts.ogImage; alt:brand.name"
    root.querySelectorAll("[data-bind-attr]").forEach(function (el) {
      const spec = el.getAttribute("data-bind-attr");
      spec.split(";").forEach(function (pair) {
        const m = pair.split(":");
        if (m.length < 2) return;
        const attr = m[0].trim();
        const path = m.slice(1).join(":").trim();
        const raw = resolvePath(path);
        const v = pickI18n(raw, lang);
        if (v != null) el.setAttribute(attr, String(v));
      });
    });

    // 3. data-bind-href="kind:path"
    //    kinds: tel, mailto, wa (whatsapp), tg, ig (instagram username), url
    root.querySelectorAll("[data-bind-href]").forEach(function (el) {
      const spec = el.getAttribute("data-bind-href");
      const m = spec.split(":");
      const kind = (m[0] || "url").trim();
      const path = m.slice(1).join(":").trim();
      const raw = resolvePath(path);
      const v = pickI18n(raw, lang);
      if (!v) return;
      const s = String(v).replace(/^\s+|\s+$/g, "");
      let href = s;
      if (kind === "tel")     href = "tel:" + s.replace(/[^+\d]/g, "");
      else if (kind === "mailto") href = "mailto:" + s;
      else if (kind === "wa") href = "https://wa.me/" + s.replace(/[^\d]/g, "");
      else if (kind === "tg") href = s.startsWith("http") ? s : "https://t.me/" + s.replace(/^@/, "");
      else if (kind === "ig") href = s.startsWith("http") ? s : "https://instagram.com/" + s.replace(/^@/, "");
      el.setAttribute("href", href);
    });

    // 4. data-bind-show="path"
    root.querySelectorAll("[data-bind-show]").forEach(function (el) {
      const path = el.getAttribute("data-bind-show");
      const raw = resolvePath(path);
      const v = pickI18n(raw, lang);
      const visible =
        v != null &&
        v !== "" &&
        v !== false &&
        !(Array.isArray(v) && v.length === 0);
      el.style.display = visible ? "" : "none";
    });

    // 5. data-bind-list="path" data-tpl="#tplId"
    root.querySelectorAll("[data-bind-list]").forEach(function (el) {
      const path = el.getAttribute("data-bind-list");
      const tplSel = el.getAttribute("data-tpl");
      const tpl = tplSel ? document.querySelector(tplSel) : null;
      if (!tpl) return;
      const arr = resolvePath(path);
      if (!Array.isArray(arr)) return;
      const html = tpl.innerHTML;
      const filtered = arr.filter(function (it) {
        return it && it.active !== false;
      });
      el.innerHTML = filtered
        .map(function (item, i) {
          return fillTemplate(html, item, lang, i);
        })
        .join("");
      // Re-apply binds inside generated children (in case template
      // contains data-bind-href etc on plain values — usually it
      // doesn't, but harmless).
      renderBinds(el, lang);
    });

    // 6. data-bind-product="?id=..." — resolve current product on page
    root.querySelectorAll("[data-bind-product]").forEach(function (el) {
      const field = el.getAttribute("data-bind-product"); // "title" / "description" etc
      const product = getCurrentProduct();
      if (!product) return;
      const v = pickI18n(getDeep(product, field), lang);
      if (v != null) applyText(el, v);
    });
  }

  function getDeep(obj, path) {
    if (!obj || !path) return undefined;
    const parts = path.split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur == null) return undefined;
      cur = cur[p];
    }
    return cur;
  }

  function getCurrentProduct() {
    const params = new URLSearchParams(location.search);
    const id = params.get("id");
    const items = (STORE.products && STORE.products.items) || [];
    if (id) return items.find(function (p) { return p.id === id; });
    return items[0]; // fallback to first
  }

  // ── load data ─────────────────────────────────
  async function loadAll() {
    const cb = "?_=" + VERSION;
    const results = await Promise.all(
      FILES.map(function (name) {
        return fetch("/data/" + name + ".json" + cb)
          .then(function (r) { return r.ok ? r.json() : {}; })
          .catch(function () { return {}; });
      })
    );
    FILES.forEach(function (name, i) { STORE[name] = results[i] || {}; });
  }

  // ── public api ────────────────────────────────
  const api = {
    get store() { return STORE; },
    getLang: getLang,
    resolve: resolvePath,
    pickI18n: pickI18n,
    render: function (root) {
      renderBinds(root || document, getLang());
    },
    refresh: async function () {
      await loadAll();
      renderBinds(document, getLang());
      document.dispatchEvent(new CustomEvent("vp:data-ready", { detail: STORE }));
    },
    // SEO: write title/description from pages.seo
    applySeo: function () {
      const lang = getLang();
      const seo = (STORE.pages && STORE.pages.seo) || {};
      const t = pickI18n(seo.title, lang);
      const d = pickI18n(seo.description, lang);
      if (t) document.title = t;
      if (d) {
        let m = document.querySelector('meta[name="description"]');
        if (!m) {
          m = document.createElement("meta");
          m.setAttribute("name", "description");
          document.head.appendChild(m);
        }
        m.setAttribute("content", d);
      }
    }
  };
  window.VP_DATA = api;

  // ── boot ──────────────────────────────────────
  document.addEventListener("DOMContentLoaded", async function () {
    await loadAll();
    renderBinds(document, getLang());
    api.applySeo();
    document.dispatchEvent(new CustomEvent("vp:data-ready", { detail: STORE }));
  });

  // re-render on language change (i18n.js dispatches this)
  window.addEventListener("vp:lang-changed", function () {
    renderBinds(document, getLang());
    api.applySeo();
  });
})();
