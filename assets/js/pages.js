/* Renders timelines, countdowns and links from SW_CONFIG. Re-renders on language change. */
(function () {
  var C = window.SW_CONFIG;
  function t(zh, en) { return window.SW_t ? window.SW_t(zh, en) : zh; }
  function fmt(iso) {
    var d = new Date(iso);
    return (d.getUTCMonth() + 1) + "/" + String(d.getUTCDate()).padStart(2, "0");
  }
  function sgt(iso) {
    var d = new Date(new Date(iso).getTime() + 8 * 3600e3);
    return (d.getUTCMonth() + 1) + "/" + String(d.getUTCDate()).padStart(2, "0") + " " + String(d.getUTCHours()).padStart(2, "0") + ":" + String(d.getUTCMinutes()).padStart(2, "0") + " SGT";
  }

  function renderTimeline(el) {
    var items = C[el.dataset.timeline].timeline, now = Date.now(), nextFound = false, showTime = el.hasAttribute("data-times");
    el.innerHTML = items.map(function (it) {
      var end = new Date(it.end || it.date).getTime(), cls = "";
      if (end < now) cls = "done"; else if (!nextFound) { cls = "next"; nextFound = true; }
      var date = it.label ? t(it.label.zh, it.label.en) : fmt(it.date);
      var sub = showTime && !it.label ? "<small>" + sgt(it.date) + "</small>" : "";
      return '<div class="tl-item reveal ' + cls + '"><div class="tl-date">' + date + sub + '</div><div class="tl-dot"></div>' +
        '<div class="tl-body"><h4>' + t(it.zh, it.en) + "</h4><p>" + t(it.dzh, it.den) + "</p></div></div>";
    }).join("");
    el.querySelectorAll(".reveal").forEach(function (r, i) { setTimeout(function () { r.classList.add("in"); }, 60 * i); });
  }

  function renderCountdown(el) {
    var items = C[el.dataset.countdown].timeline, now = Date.now();
    var next = items.find(function (it) { return new Date(it.date).getTime() > now; });
    if (!next) { el.hidden = true; return; }
    var target = new Date(next.date).getTime();
    function tick() {
      var s = Math.max(0, Math.floor((target - Date.now()) / 1000));
      var parts = [[Math.floor(s / 86400), t("天", "DAYS")], [Math.floor(s % 86400 / 3600), t("时", "HRS")], [Math.floor(s % 3600 / 60), t("分", "MIN")], [s % 60, t("秒", "SEC")]];
      el.innerHTML = '<span class="lbl">' + t("距 ", "Until ") + t(next.zh, next.en) + "</span>" +
        parts.map(function (p) { return '<span class="u"><b>' + String(p[0]).padStart(2, "0") + "</b><i>" + p[1] + "</i></span>"; }).join("");
    }
    tick(); clearInterval(el._iv); el._iv = setInterval(tick, 1000);
  }

  function renderLinks() {
    document.querySelectorAll("[data-link]").forEach(function (a) {
      var url = C[a.dataset.link];
      if (url) { a.href = url; a.removeAttribute("aria-disabled"); a.querySelectorAll(".soon").forEach(function (s) { s.remove(); }); }
      else { a.setAttribute("aria-disabled", "true"); a.removeAttribute("href"); }
    });
    document.querySelectorAll("[data-contact]").forEach(function (el) {
      el.innerHTML = C.contactEmail
        ? '<a class="btn btn-primary" href="mailto:' + C.contactEmail + '">' + C.contactEmail + "</a>"
        : '<span class="btn" aria-disabled="true">' + t("联系邮箱即将公布", "Contact email coming soon") + "</span>";
    });
  }

  function all() {
    document.querySelectorAll("[data-timeline]").forEach(renderTimeline);
    document.querySelectorAll("[data-countdown]").forEach(renderCountdown);
    renderLinks();
  }
  document.addEventListener("sw:lang", all);
})();
