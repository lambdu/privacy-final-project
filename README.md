# Privacy Tool Picker

A short questionnaire that recommends which **privacy-enhancing tools** fit a project. It covers six tool families: Anonymization, Differential Privacy, Cryptography, Law & Policy, Zero-Knowledge Proofs, and Federated Learning. The results page lists the recommended tools, notes and warnings set off by specific answers, and charts that show what drove the result.

Built with [Astro](https://astro.build) and a [Preact](https://preactjs.com) island, and hosted on GitHub Pages. There is no backend. Answers stay in the browser's `localStorage`.

- **Live site:** https://lambdu.github.io/privacy-final-project/
- **Example results page:** `/results/demo/` shows a filled-in results page without taking the quiz.

## Running locally

Requires Node 22.23.4+ (Astro's minimum). With nvm, run `nvm install` in the repo, which reads `.nvmrc`.

```sh
npm install
npm run dev        # http://localhost:4321/privacy-final-project/
npm test           # scoring unit tests (vitest)
npm run build      # static site -> dist/
npm run preview    # serve the built site
```

## How it works

```
src/
  data/
    questions.json      <- all questions, weights, and rule effects (edit this!)
    tools.json          <- the six tools (name, short label, description)
    demo-answers.json   <- answers used by the example results page
  lib/scoring.ts        <- pure scoring logic shared by quiz + results
  components/
    Quiz.tsx            <- one-question-at-a-time flow, running score
    Results.tsx         <- recommendations, notes, charts, answer table
    charts/             <- Chart.js wrappers (bar, radar, diverging bar)
  pages/
    index.astro         <- landing page
    quiz.astro          <- questionnaire
    results/index.astro <- your results (reads localStorage)
    results/demo.astro  <- example results (uses demo-answers.json)
```

### The questionnaire

There are 22 questions, asked one at a time with no page reloads:

1. **11 rating questions (1–5)**, such as *Data Sensitivity* or *Linkage Risk*. Each one has a **weight per tool**.
2. **11 yes/no rule questions**, such as *"The data is regulated (ex. HIPAA, GDPR)"*. Each one has **effects** that fire on *yes* or *no*.

Keyboard shortcuts: `1`–`5` for ratings, `Y`/`N` for yes/no, `←` to go back. Progress is saved after every answer. A "Running score" panel under each question shows the tools' scores update live.

### Scoring (`src/lib/scoring.ts`)

**Ratings.** Each answer adds `weight × (rating − 3)` to each tool's score. Ratings are centered on 3, so a 3 is neutral, a 5 with weight `+1` adds **+2**, and a 1 with weight `+1` adds **−2**. To change the formula, edit `ratingContribution()`.

**Rules.** Each rule effect has a `type`:

| `type`      | What it does                                                                    |
|-------------|---------------------------------------------------------------------------------|
| `require`   | Tool is always recommended, pinned to the top, and shown at 100% confidence     |
| `exclude`   | Tool is ruled out, moved to the bottom, and shown at 0%                         |
| `boost`     | Adds `BOOST_POINTS` (default 2) to the tool's score                             |
| `not-alone` | Adds a "Pair with another tool" badge and a warning                             |
| `warning`   | Shows a warning on the results page                                            |
| `note`      | Shows an informational note on the results page                                 |

Every effect's `text` appears on the results page, along with the question and answer that triggered it.

**Confidence.**
- *Per tool:* scores are min-max normalized to 0–100% across the tools that weren't ruled out, then `require` and `exclude` override the value.
- *Overall* (the big number): `coverage × (0.5 + 0.5 × separation)`. *Coverage* is the fraction of questions answered. *Separation* is how far the top non-required tool leads the runner-up, relative to the full score range.

### Results page

- **Recommendation:** all required tools plus the top-scoring tools, up to 3 cards.
- **Notes & warnings:** every rule effect that fired.
- **Confidence by tool:** bar chart of per-tool confidence.
- **Support vs. concerns:** spider chart of how many points answers added *for* and *against* each tool.
- **What drove the score:** diverging bar chart of each answer's contribution to a chosen tool. Use the dropdown to switch tools.
- **Your answers:** table with an *Edit* link that jumps back to that question.

## Contributing

Most changes only touch JSON files in `src/data/`. You don't need to change any code.

### Fill in or change weights

The brainstorm only set weights for the first four ratings: Data Sensitivity, Linkage Risk, Need for Exact Results, and Distrust of Data Holder. **All other rating weights are `0` and still need to be filled in.** In `questions.json`:

```json
{
  "id": "speed",
  "label": "Need for Speed",
  "low": "Days or weeks okay",
  "high": "Real-time",
  "weights": { "anonymization": 0, "dp": 0, "cryptography": -1, "law": 0, "zkp": -1, "fl": 0 }
}
```

Weights can be any number. We have used `-1`, `0`, and `+1` so far, but `2` works if a factor should count double.

### Add a note to a question

Append an effect to the rule's `effects` array. `tool` is optional and only links the note to a tool:

```json
{ "when": "yes", "type": "note", "tool": "law", "text": "Consider a DPIA before processing." }
```

A single question can have several effects, including different ones for `yes` and `no`. See `prove_fact` for an example.

### Add or edit a question

Add an object to `ratings` or `rules` in `questions.json`. Use a unique snake_case `id`, because saved answers are keyed by it. Questions are asked in file order: all ratings first, then all rules. The tests check that every `tool` id in the data exists.

### Add a tool

Add an entry to `tools.json`, then add its id to every rating's `weights` (missing ids count as 0).

### Change the example results page

Edit `src/data/demo-answers.json`. The keys are question ids, the values are `1`–`5` or `"yes"`/`"no"`.

### Code changes

- Keep scoring logic in `src/lib/scoring.ts` as pure functions, and add a test in `src/lib/scoring.test.ts`.
- Colors are CSS variables in `src/styles/global.css`, with light and dark mode values. Charts read them at render time.
- Internal links must start with the site base path (`import.meta.env.BASE_URL`, passed to components as `base`). On Pages, the site lives under `/privacy-final-project/`.
- Run `npm test && npm run build` before opening a PR.

## Deployment

`.github/workflows/deploy.yml` builds, tests, and deploys on every push to `main`.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**.

If the repo is renamed or forked, update `site` and `base` in `astro.config.mjs`.
