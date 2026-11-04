(function () {
  function routeLegacyAnchor() {
    if (/^#(?:how|tracks)$/.test(location.hash)) {
      location.replace('challenge.html' + location.search + location.hash);
    }
  }
  addEventListener('hashchange', routeLegacyAnchor);
  function updateMetadata() {
    var english = window.SW_LANG === 'en';
    var title = english ? 'Economic World Models Initiative · Led by GIFTS' : '经济世界模型计划 · GIFTS 发起与牵头';
    var description = english
      ? 'A GIFTS-led initiative advancing the Economic World Models and Data-Driven Generative Equilibria framework proposed by Prof. Lin William Cong through research, simulation platforms and open challenges.'
      : '由 GIFTS 发起并牵头，以丛林教授提出的经济世界模型与数据驱动生成均衡（DDGE）研究框架为基础，连接学术研究、仿真平台与开放比赛。';
    document.title = title;
    document.querySelectorAll('meta[name="description"], meta[property="og:description"], meta[name="twitter:description"]').forEach(function (tag) { tag.content = description; });
    document.querySelectorAll('meta[property="og:title"], meta[name="twitter:title"]').forEach(function (tag) { tag.content = title; });
    var locale = document.querySelector('meta[property="og:locale"]');
    if (locale) locale.content = english ? 'en_GB' : 'zh_CN';
  }
  document.addEventListener('sw:lang', updateMetadata);
  updateMetadata();
})();
