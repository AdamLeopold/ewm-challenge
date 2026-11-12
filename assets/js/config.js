/* EWM Challenge — the one file for dates, links and switches.
   Dates are ISO strings in UTC. `label` overrides the printed date (e.g. "10 月底").
   The opening is published as a month only (December 2026): the countdown shows that label instead of a clock,
   and the timeline entry carries a date purely so it sorts and highlights correctly.
   Edit here; pages render timelines and countdowns from this file. */
window.SW_CONFIG = {
  contactEmail: "YLU063@e.ntu.edu.sg",
  registerUrl: "register.html", // stable public entry shared by all QR codes
  registrationFormUrl: "https://forms.cloud.microsoft/Pages/ResponsePage.aspx?id=SJPOFSq-K0aPwOF2WpsgSh36z_V7kpxKobXwnxZyIJ9UNTZCWUhGU0VMTU0yMFZMTE5HRjZCR0NRQi4u",
  rulesUrl: "",
  starterKitUrl: "",

  holobit: {
    name: "Economic World Model Challenge",
    hostLine: { zh: "Track 1–2 · 世界由 HoloBit 提供", en: "Tracks 1–2 · world provided by HoloBit" },
    countdown: {
      label: { zh: "2026 年 12 月", en: "December 2026" },
      zh: "赛道开启", en: "Track opening"
    },
    timeline: [
      { date: "2026-12-31T00:00:00Z", label: { zh: "2026 年 12 月", en: "Dec 2026" }, zh: "Track 1–2 赛道开启", en: "Tracks 1–2 open",
        dzh: "2026 年 12 月统一开启；参赛任务、上手步骤、交付物与评测流程见参赛指南。", den: "Opens in December 2026. See the participant guide for tasks, getting started, deliverables and evaluation." }
    ]
  },

  city: {
    name: "Agentic City",
    countdown: {
      label: { zh: "2026 年 12 月", en: "December 2026" },
      zh: "赛道开启", en: "Track opening"
    },
    timeline: [
      { date: "2026-12-31T00:00:00Z", label: { zh: "2026 年 12 月", en: "Dec 2026" }, zh: "Track 3 赛道开启", en: "Track 3 opens",
        dzh: "2026 年 12 月统一开启。交互 Demo 现已开放，可提前体验城市规划流程。", den: "Opens in December 2026. The interactive demo is available now to explore the city-planning workflow." }
    ]
  }
};
