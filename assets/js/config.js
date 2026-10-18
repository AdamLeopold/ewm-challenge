/* SimuWorld — the one file for dates, links and switches.
   Dates are ISO strings in UTC. `label` overrides the printed date (e.g. "10 月底").
   Edit here; pages render timelines and countdowns from this file. */
window.SW_CONFIG = {
  contactEmail: "",      // official address; empty = "coming soon"
  registerUrl: "",      // empty = button shows "即将开放 / Soon"
  rulesUrl: "",
  starterKitUrl: "",

  holobit: {
    name: "SimuWorld Challenge",
    hostLine: { zh: "HoloBit 赛道由 HoloBit 主办", en: "HoloBit track hosted by HoloBit" },
    timeline: [
      { date: "2026-10-23T00:00:00Z", zh: "比赛公告 · 开放报名", en: "Announcement · Registration opens",
        dzh: "发布规则、接口规格、文档预览与历史数据。", den: "Rules, interface spec, docs preview and historical data released." },
      { date: "2026-11-02T00:00:00Z", end: "2026-11-06T23:59:00Z", label: { zh: "11/02–06", en: "2–6 Nov" },
        zh: "香港金融科技周 · 现场宣讲", en: "Hong Kong FinTech Week · Showcase",
        dzh: "SimuWorld Challenge 两条赛道现场介绍。", den: "Both SimuWorld Challenge tracks presented on site." },
      { date: "2026-11-03T00:00:00Z", zh: "练习平台开放", en: "Practice platform opens",
        dzh: "远程练习接口与托管试跑开放，可查看练习排行榜。", den: "Remote practice API and hosted trial runs open, with a practice leaderboard." },
      { date: "2026-11-06T23:59:00Z", zh: "报名截止", en: "Registration closes",
        dzh: "UTC 23:59 截止。", den: "Closes 23:59 UTC." },
      { date: "2026-11-07T00:00:00Z", zh: "热身轮", en: "Warm-up round",
        dzh: "不计分；完成热身是进入正式赛的资格。", den: "Unscored; completing it qualifies your team for the main round." },
      { date: "2026-11-11T00:00:00Z", zh: "提交冻结", en: "Submission freeze",
        dzh: "签名并冻结最终 Agent，此后不可更改。", den: "Sign and freeze your final agent. No changes after this point." },
      { date: "2026-11-14T00:00:00Z", zh: "线上赛结果 · 决赛名单", en: "Online results · Finalists",
        dzh: "公布线上赛名次与各组别决赛队伍。", den: "Online rankings and finalists for each division announced." },
      { date: "2026-11-18T00:00:00Z", end: "2026-11-20T23:59:00Z", label: { zh: "11/18–20", en: "18–20 Nov" },
        zh: "现场决赛 · 新加坡金融科技节", en: "Live finals · Singapore FinTech Festival",
        dzh: "现场开跑、重放前向段、颁奖，并公开全部压力测试与种子。", den: "Live run, forward-window replay, awards, and full reveal of stress tests and seeds." },
      { date: "2026-11-27T23:59:00Z", zh: "申诉截止", en: "Appeals close",
        dzh: "可用公开的种子与记录自行复核成绩。", den: "Verify your own results with the published seeds and logs." }
    ]
  },

  city: {
    name: "Agentic City",
    timeline: [
      { date: "2026-10-31T00:00:00Z", label: { zh: "10 月底", en: "End of Oct" },
        zh: "演示视频与体验 Demo 上线", en: "Demo video & playable demo",
        dzh: "先看平台怎么工作：用对话搭一片城区，并跑一项评估（如居民容纳率）。", den: "See how it works: build a district by chat and run one evaluation, such as resident capacity." },
      { date: "2026-11-02T00:00:00Z", end: "2026-11-06T23:59:00Z", label: { zh: "11/02–06", en: "2–6 Nov" },
        zh: "香港金融科技周 · 现场展示", en: "Hong Kong FinTech Week · Showcase",
        dzh: "与 HoloBit 赛道一同亮相，现场演示 Agentic City 平台。", den: "Showcased alongside the HoloBit track, with a live demo of the Agentic City platform." },
      { date: "2026-11-18T00:00:00Z", end: "2026-11-20T23:59:00Z", label: { zh: "11/18–20", en: "18–20 Nov" },
        zh: "新加坡金融科技节 · 现场展示", en: "Singapore FinTech Festival · Showcase",
        dzh: "与 HoloBit 赛道一同亮相。", den: "Showcased alongside the HoloBit track." },
      { date: "2026-11-25T00:00:00Z", label: { zh: "11 月下旬", en: "Late Nov" },
        zh: "完整平台开放 · 正式报名与提交", en: "Full platform · Registration & submissions open",
        dzh: "具体日期以官方公告为准。", den: "Exact date to be announced." }
    ]
  }
};
