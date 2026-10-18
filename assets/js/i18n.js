/* Bilingual switch. Chinese lives in the markup; English in data-en (HTML allowed).
   English is the default; ?lang=zh / ?lang=en force a language, and a visitor's own choice is remembered. */
(function () {
  var KEY = "sw-lang-v2";   // new key so earlier saved choices don't override the English default
  function read() {
    var q = new URLSearchParams(location.search).get("lang");
    if (q === "en" || q === "zh") return q;
    try { return localStorage.getItem(KEY) || "en"; } catch (e) { return "en"; }
  }
  function setText(lang) {
    document.documentElement.lang = lang === "en" ? "en" : "zh-CN";
    document.querySelectorAll("[data-en]").forEach(function (el) {
      if (el.dataset.zh === undefined) el.dataset.zh = el.innerHTML;
      el.innerHTML = lang === "en" ? el.dataset.en : el.dataset.zh;
    });
    document.querySelectorAll("[data-en-aria]").forEach(function (el) {
      if (el.dataset.zhAria === undefined) el.dataset.zhAria = el.getAttribute("aria-label") || "";
      el.setAttribute("aria-label", lang === "en" ? el.dataset.enAria : el.dataset.zhAria);
    });
    document.querySelectorAll(".lang-toggle").forEach(function (b) { b.textContent = lang === "en" ? "中文" : "EN"; });
  }
  function apply(lang) {
    setText(lang);
    window.SW_LANG = lang;
    document.dispatchEvent(new CustomEvent("sw:lang", { detail: lang }));
    if (lang !== "en") { keepPhrases(); bindTails(); }
    keepLabelParts();
  }
  /* Chinese has no spaces, so the browser may break a heading anywhere ("一座城 / 市").
     Split short text at punctuation and keep each phrase (up to 14 characters) on one line. */
  var PHRASE_SEL = "h1, h2, h3, h4, summary, .step p, .card li, .stat > span, .tl-body p, .flip-face p, .tier p, .dims td, .k, .lede";
  function keepPhrases() {
    document.querySelectorAll(PHRASE_SEL).forEach(function (el) {
      if (el.closest("[data-chars]") || el.querySelector(".ph")) return;
      // longest phrase that still fits the element's width at its font size
      var fs = parseFloat(getComputedStyle(el).fontSize) || 16, max = Math.min(14, Math.floor((el.clientWidth || 9999) / fs) - 1);
      if (max < 3) return;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), nodes = [], n;
      while ((n = walker.nextNode())) if (/[\u4e00-\u9fff]/.test(n.data) && !n.parentNode.closest("code")) nodes.push(n);
      nodes.forEach(function (node) {
        var parts = node.data.match(/[^，、：；。！？,+·]*[，、：；。！？,+·]?/g).filter(Boolean);
        if (parts.length < 2 && node.data.length > max) return;
        var frag = document.createDocumentFragment();
        parts.forEach(function (p) {
          if (p.length <= max && /[\u4e00-\u9fff]/.test(p)) { var sp = document.createElement("span"); sp.className = "ph"; sp.textContent = p; frag.appendChild(sp); }
          else frag.appendChild(document.createTextNode(p));
        });
        node.parentNode.replaceChild(frag, node);
      });
    });
  }
  // no one- or two-character last lines: bind the final few characters of a paragraph together
  var TAIL_SEL = "p, li, td, summary, .lede, h2, h3, h4";
  function bindTails() {
    document.querySelectorAll(TAIL_SEL).forEach(function (el) {
      if (el.closest("[data-chars]") || el.querySelector(".tail")) return;
      var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), last = null, n;
      while ((n = walker.nextNode())) if (n.data.trim()) last = n;
      if (!last || last.parentNode.closest(".ph, code")) return;
      var m = last.data.match(/[\u4e00-\u9fff]{1,4}[，。、！？：；”）」]*\s*$/);
      if (!m || m.index === 0) return;
      var sp = document.createElement("span"); sp.className = "ph tail"; sp.textContent = m[0];
      last.data = last.data.slice(0, m.index);
      last.parentNode.insertBefore(sp, last.nextSibling);
    });
  }
  // small labels like "Track 02 · Agentic City · 香港北部都会区" break only at the dots
  function keepLabelParts() {
    document.querySelectorAll(".eyebrow, .track-tag, .chip, .events").forEach(function (el) {
      el.querySelectorAll(".ph").forEach(function (p) { p.replaceWith(document.createTextNode(p.textContent)); });
      el.normalize();
      Array.prototype.slice.call(el.childNodes).forEach(function (node) {
        if (node.nodeType !== 3 || node.data.indexOf("·") < 0 && node.data.length < 4) return;
        var frag = document.createDocumentFragment();
        node.data.split(/(\s*·\s*)/).forEach(function (part) {
          if (!part) return;
          if (/·/.test(part)) frag.appendChild(document.createTextNode(part));
          else { var sp = document.createElement("span"); sp.className = "ph"; sp.textContent = part; frag.appendChild(sp); }
        });
        node.parentNode.replaceChild(frag, node);
      });
    });
  }
  window.SW_keepPhrases = keepPhrases;

  window.SW_setLang = function (lang) {
    try { localStorage.setItem(KEY, lang); } catch (e) {}
    apply(lang);
  };
  window.SW_t = function (zh, en) { return window.SW_LANG === "en" ? en : zh; };
  // This script sits at the end of <body>: swap the text now, before the first paint, so English
  // visitors never see a flash of Chinese. Other scripts get the language event on DOMContentLoaded.
  window.SW_LANG = read(); setText(window.SW_LANG);
  document.addEventListener("DOMContentLoaded", function () {
    apply(read());
    document.querySelectorAll(".lang-toggle").forEach(function (b) {
      b.addEventListener("click", function () { window.SW_setLang(window.SW_LANG === "en" ? "zh" : "en"); });
    });
  });
})();
