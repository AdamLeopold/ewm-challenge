# Economic World Model Challenge

Competition website for three tracks across two platforms: **HoloBit** hosts Track 1 (strategy agents) and Track 2 (protocol risk agents); **Agentic City** hosts Track 3 (urban planning).

`demo/holobit-console/` is a front-end walkthrough of the Track 1–2 participant console (HoloBit cover, application channel, conversation console). It has no backend and submits nothing.

Static site, no build step. Dates, links and the contact address live in `assets/js/config.js`.

Run locally:

```bash
python3 -m http.server 8093
```

Run the countdown, policy-export and environment checks:

```bash
node --test tests/countdown.test.cjs demo/agentic-city/policy.test.mjs demo/agentic-city/city3d/environment-state.test.mjs
```
