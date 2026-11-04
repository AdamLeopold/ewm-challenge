# Economic World Models Initiative

The initiative website is led by GIFTS. `index.html` introduces the research framework, publications, partnering institutions and team; `challenge.html` is the Economic World Model Challenge entry point.

The challenge has three tracks across two platforms: **HoloBit** hosts Track 1 (strategy agents) and Track 2 (protocol risk agents); **Agentic City** hosts Track 3 (urban planning).

Static site, no build step. Dates, links and the contact address live in `assets/js/config.js`.

Run locally:

```bash
python3 -m http.server 8093
```

Run the countdown, policy-export and environment checks:

```bash
node --test tests/countdown.test.cjs demo/agentic-city/policy.test.mjs demo/agentic-city/city3d/environment-state.test.mjs
```
