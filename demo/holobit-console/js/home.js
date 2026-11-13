'use strict';
/* The cover: HoloBit's front page. Pictures, icons and the headline face are local copies in assets/hb; only the film streams from holobit.xyz. */
const Home = (() => {
  const HB = 'https://holobit.xyz', AS = 'assets/hb', home = $('#home');
  const ext = (href, t, cls = '') => `<a ${cls ? `class="${cls}" ` : ''}href="${href}" target="_blank" rel="noopener">${t}</a>`;
  const img = (src, alt, w, h) => `<img src="${AS}/${src}" alt="${alt}" width="${w}" height="${h}" loading="lazy" decoding="async">`;
  const chev = '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';

  const NAV = [
    ['Community', [['Overview', '/community'], ['Marketplace', '/marketplace'], ['Insights', '/insights']]],
    ['Product', [['Model', '/product/model'], ['Experiment', '/product/experiment'], ['Insights', '/product/insights'], ['Marketplace', '/product/marketplace']]],
    ['Solutions', '/solutions'], ['Pricing', '/pricing'],
    ['Resources', [['Tutorials', '/tutorials'], ['Docs', '/docs']]],
    ['Company', [['About', '/company'], ['Contact us', '/contact-us']]],
  ];
  const FEAT = [
    ['Brainstorm', 'Simulation-Led Thinking, not Forum Debates', 'Join a community of builders, governors, traders, strategists and more. Share models. Brainstorm. Uncover truths. Fork better ways forward.', 'Insights', '/product/insights', 'brainstorm.png', 642, 506],
    ['Build', 'From Ideas to Live Prototypes in Minutes', 'Drag, drop, and model your design logic without code. Tweak parameters. Track behaviors. Visualize the future.', 'Model', '/product/model', 'build.png', 677, 534],
    ['Battle &amp; Balance', 'Test, Adapt, Evolve in Parallel Universes', 'Run experiments. Surface vulnerabilities. Tune for real-world performance. Navigate the delicate equilibrium between efficiency and resilience.', 'Experiment', '/product/experiment', 'battle-balance.png', 549, 534],
    ['Bloom', 'Insight → Influence → Income → Infrastructure', 'Publish to the marketplace. Get forked. Get rewarded. Turn models into economic primitives others build on.', 'Marketplace', '/product/marketplace', 'bloom.png', 589, 416],
  ];
  const WHO = [
    ['Token Engineers', 'token-engineer', 'Will this incentive model still work under different user behaviors?'], ['Protocol Builders', 'protocol-builder', 'Will the protocol hold up in extreme scenarios?'],
    ['Auditors &amp; Consultants', 'auditor-consultant', 'How do we explain risks in user-friendly terms?'], ['DAOs', 'dao', 'Would adjusting incentives increase participation?'],
    ['Retail Traders', 'retail-trader', 'Can I trust this protocol and clearly understand where the yield comes from?'], ['Quant Funds', 'quant-fund', 'What happens when multiple strategies compete in the same environment?'],
    ['Market Makers', 'market-maker', 'Can my liquidity strategy survive under volatility and unpredictable behavior?'], ['VC &amp; Risk Evaluators', 'vc-risk-evaluator', 'What\'s the worst-case scenario and how resilient is the protocol under stress?'],
    ['KOLs &amp; Media', 'kol-media', 'Can I support my views with data‑driven models?'], ['Regulators', 'regulators', 'Are there tools to simulate policy impact and support rulemaking?'],
    ['Educators', 'educator', 'How do we make token dynamics easier to understand?'], ['Attackers', 'attacker', 'Is there MEV to exploit? What\'s the minimum cost of this attack?'],
  ];
  const CORE = [['Generative ABM', 'agent-based-modeling'], ['Auto Modeling', 'auto-modeling'], ['No-code &amp; visualized', 'no-code-visualized'], ['Built-in transparency', 'built-in-transparency'], ['Model-driven Community', 'model-driven-community'], ['Marketplace', 'marketplace'], ['AI-native', 'ai-native'], ['Cloud-based', 'cloud-based'], ['Collaborative', 'collaborative'], ['1-click share', '1-click-share']];
  const FOOT = [['Resources', [['Tutorials', HB + '/tutorials'], ['Docs', HB + '/docs']]], ['Company', [['About', HB + '/company'], ['Terms of Service', HB + '/legal/terms-of-service'], ['Privacy Policy', HB + '/legal/privacy-policy']]], ['Social', [['X', 'https://twitter.com/HolobitOfficial'], ['Discord', 'https://discord.gg/SPkcUn2CNN'], ['YouTube', 'https://www.youtube.com/@HoloBit']]]];

  $('#h-nav').innerHTML = NAV.map(([t, v]) => Array.isArray(v) ? `<div class="dd"><button aria-haspopup="true">${t} ${chev}</button><div class="dd-m">${v.map(([a, h]) => ext(HB + h, a)).join('')}</div></div>` : ext(HB + v, t)).join('');
  $('#h-drawer').innerHTML = NAV.map(([t, v]) => Array.isArray(v) ? `<div><h6>${t}</h6>${v.map(([a, h]) => ext(HB + h, a)).join('')}</div>` : `<div>${ext(HB + v, t, 'solo')}</div>`).join('');
  $('#h-sections').innerHTML =
    FEAT.map((f, i) => `<section class="h-sec h-feat ${i % 2 ? 'rev' : ''}"><div class="h-in"><div class="tx"><h2 class="h-h2">${f[0]}</h2><h3>${f[1]}</h3><p>${f[2]}</p>${ext(HB + f[4], f[3] + ' →', 'hb o')}</div><div class="pic">${img(f[5], '', f[6], f[7])}</div></div></section>`).join('') +
    `<section class="h-sec h-who"><div class="h-in"><h2 class="h-h2">Leverage the superpowers of transparency</h2><div class="who-g">${WHO.map(w => `<div><header>${img('icons/' + w[1] + '.svg', '', 20, 20)}<h3>${w[0]}</h3></header><p>${w[2]}</p></div>`).join('')}</div>
      <p class="h-fine">*HoloBit is built for onchain economy, but applied far beyond. From public transit to supply chains and healthcare, complex systems everywhere depend on Simulation.</p><div class="h-mid">${ext(HB + '/solutions', 'Explore Solutions by Users →', 'hb o')}</div></div></section>` +
    `<section class="h-sec h-core"><div class="h-in"><h2 class="h-h2">At the core</h2><div class="core-g">${CORE.map(c => `<div>${img('icons/' + c[1] + '.svg', '', 20, 20)}<h3>${c[0]}</h3></div>`).join('')}</div></div></section>` +
    `<section class="h-sec h-end" id="h-end"><div class="h-in"><div class="h-end-h"><h2>Stop making</h2><h2>Gut decisions</h2></div><p>Looking for a new paradigm in the evolution of protocols, AI Agents and strategies?</p><div class="h-cta"><button class="hb g" data-act="start">Start for Free</button>${ext(HB + '/contact-us', 'Get in Touch', 'hb o')}</div></div></section>`;
  $('#h-foot-cols').innerHTML = FOOT.map(([t, v]) => `<div><h4>${t}</h4><ul>${v.map(([a, h]) => `<li>${ext(h, a)}</li>`).join('')}</ul></div>`).join('');

  // an asset that fails to arrive leaves a quiet gap, never a broken-image icon
  home.addEventListener('error', e => { const t = e.target; if (t.tagName === 'IMG') t.classList.add('gone'); else if (t.tagName === 'VIDEO') $('.h-video').classList.add('gone'); }, true);
  home.addEventListener('scroll', () => home.classList.toggle('scrolled', home.scrollTop > 8), { passive: true });
  $('#h-burger').onclick = () => { const d = $('#h-drawer'); d.hidden = !d.hidden; $('#h-burger').setAttribute('aria-expanded', String(!d.hidden)); home.classList.toggle('menu', !d.hidden); };

  let warmed = false;
  function show() {
    if (warmed) return; warmed = true;
    const paint = (file, el, cls) => { const i = new Image(), u = new URL(`${AS}/${file}`, location.href).href; i.onload = () => { el.style.setProperty('--img', `url("${u}")`); el.classList.add(cls); }; i.src = u; };
    paint('home-bg.png', $('#h-glow'), 'lit'); paint('home-bg-2.png', $('#h-end'), 'lit');
    $('#h-vid').src = HB + '/holobit.mp4';
  }
  return { show, top() { home.scrollTo({ top: 0, behavior: REDUCED ? 'auto' : 'smooth' }); } };
})();
