// Online demo adjustments to the planning studio page.
(() => {
  const videos = '/agentic-city.html#video-guides';
  const nav = document.querySelector('nav [data-page="videos"]');
  if (nav) nav.addEventListener('click', e => {
    e.stopImmediatePropagation(); e.preventDefault();
    window.open(videos, '_top');
  }, true);
  // Model settings: the online demo never connects a model, so it does not take an API key.
  new MutationObserver(() => {
    const key = document.getElementById('apiKey');
    if (!key || key.dataset.demo) return;
    key.dataset.demo = '1'; key.disabled = true; key.placeholder = 'Not used in the online demo';
    const note = key.closest('label')?.nextElementSibling;
    if (note && note.classList.contains('footnote')) note.textContent = 'The online demo uses scripted planning dialogue and does not connect a model. Do not enter real keys.';
  }).observe(document.body, { childList: true, subtree: true });
})();
