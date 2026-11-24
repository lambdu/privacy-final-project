import { useEffect, useMemo, useState } from 'preact/hooks';
import {
  allQuestions,
  computeResults,
  loadAnswers,
  clearAnswers,
  type Answers,
  type TriggeredEffect,
  type ToolResult,
} from '../lib/scoring';
import { ConfidenceChart, BalanceRadar, ContributionChart } from './charts/Charts';
import './results.css';

interface Props {
  base: string;
  /** Fixed answers (used by the demo page). When omitted, answers come from localStorage. */
  answers?: Answers;
  demo?: boolean;
}

const EFFECT_META: Record<TriggeredEffect['type'], { label: string; icon: string; tone: string }> = {
  require: { label: 'Required', icon: '✔', tone: 'good' },
  exclude: { label: 'Ruled out', icon: '✕', tone: 'muted' },
  boost: { label: 'Recommended', icon: '▲', tone: 'good' },
  'not-alone': { label: 'Not enough alone', icon: '◐', tone: 'warning' },
  warning: { label: 'Warning', icon: '!', tone: 'critical' },
  note: { label: 'Note', icon: 'i', tone: 'info' },
};

export default function Results({ base, answers: fixed, demo = false }: Props) {
  const [answers, setAnswers] = useState<Answers | null>(fixed ?? null);
  useEffect(() => {
    if (!fixed) setAnswers(loadAnswers());
  }, []);

  const results = useMemo(() => (answers ? computeResults(answers) : null), [answers]);
  const [focusId, setFocusId] = useState<string | null>(null);

  if (!answers || !results) return <p class="muted">Loading…</p>;

  if (results.answeredCount === 0) {
    return (
      <div class="card empty">
        <h1>No answers yet</h1>
        <p class="secondary">Take the questionnaire to get recommendations, or look at an example.</p>
        <div class="row">
          <a class="btn primary" href={`${base}quiz/`}>Start questionnaire</a>
          <a class="btn" href={`${base}results/demo/`}>See example results</a>
        </div>
      </div>
    );
  }

  const { ranked, effects, overallConfidence, answeredCount, totalQuestions } = results;
  const required = ranked.filter((r) => r.required);
  const open = ranked.filter((r) => !r.required && !r.excluded);
  const excluded = ranked.filter((r) => r.excluded);
  const topPicks = [...required, ...open.slice(0, Math.max(1, 3 - required.length))];
  const focus = ranked.find((r) => r.tool.id === focusId) ?? topPicks[0];
  const warnings = effects.filter((e) => e.type === 'warning' || e.type === 'not-alone');
  const notes = effects.filter((e) => !(e.type === 'warning' || e.type === 'not-alone'));
  const confidenceWord = overallConfidence >= 70 ? 'High' : overallConfidence >= 40 ? 'Moderate' : 'Low';

  return (
    <div class="results">
      {demo && (
        <div class="banner">
          <strong>Example results.</strong> These come from a sample project (sensitive health data, multiple
          organizations, public release, ML training). <a href={`${base}quiz/`}>Take the questionnaire</a> to see your own.
        </div>
      )}

      <header class="results-head">
        <div>
          <p class="eyebrow">Your recommendation</p>
          <h1>{topPicks.map((r) => r.tool.name).join(' + ')}</h1>
          <p class="secondary">
            Based on {answeredCount} of {totalQuestions} answers.
            {answeredCount < totalQuestions && ' Answer the rest for a sharper result.'}
          </p>
        </div>
        <div class="hero-stat card" title="How clearly the top pick stands out, scaled by how many questions were answered">
          <span class="hero-num">{overallConfidence}%</span>
          <span class="hero-label">{confidenceWord} confidence</span>
        </div>
      </header>

      <section class="picks">
        {topPicks.map((r, i) => (
          <ToolCard result={r} primary={i === 0} />
        ))}
      </section>

      {(warnings.length > 0 || notes.length > 0) && (
        <section class="card notes">
          <h2>Notes &amp; warnings</h2>
          <ul>
            {[...warnings, ...notes].map((e) => {
              const m = EFFECT_META[e.type];
              return (
                <li class={`note tone-${m.tone}`}>
                  <span class="note-icon" aria-hidden="true">{m.icon}</span>
                  <div>
                    <span class="note-kind">{m.label}</span>
                    <p>{e.text}</p>
                    <span class="muted note-src">
                      Because you answered <em>{e.when}</em> to “{e.questionLabel}”
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section class="chart-grid">
        <div class="card">
          <h2>Confidence by tool</h2>
          <p class="muted chart-sub">Relative fit, 0–100%. Required tools are pinned to 100%, ruled-out tools to 0.</p>
          <ConfidenceChart ranked={ranked} />
        </div>
        <div class="card">
          <h2>Support vs. concerns</h2>
          <p class="muted chart-sub">Points your answers added for (support) and against (concerns) each tool.</p>
          <BalanceRadar ranked={ranked} />
        </div>
        <div class="card wide">
          <div class="chart-head">
            <div>
              <h2>What drove the score</h2>
              <p class="muted chart-sub">Each answer's contribution to the selected tool.</p>
            </div>
            <select value={focus.tool.id} onChange={(e) => setFocusId((e.target as HTMLSelectElement).value)}>
              {ranked.map((r) => (
                <option value={r.tool.id}>{r.tool.name}</option>
              ))}
            </select>
          </div>
          {focus.contributions.length > 0 ? (
            <ContributionChart result={focus} />
          ) : (
            <p class="muted">None of your answers changed this tool's score (its weights may still be 0).</p>
          )}
        </div>
      </section>

      {excluded.length > 0 && (
        <section class="card">
          <h2>Ruled out</h2>
          <ul class="plain">
            {excluded.map((r) => (
              <li>
                <strong>{r.tool.name}</strong>
                <span class="secondary"> — {r.effects.filter((e) => e.type === 'exclude').map((e) => e.text).join(' ')}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="card">
        <h2>Your answers</h2>
        <table class="answers">
          <tbody>
            {allQuestions.map((q) => {
              const a = answers[q.id];
              return (
                <tr>
                  <td>{q.label}</td>
                  <td class="ans">{a === undefined ? <span class="muted">—</span> : typeof a === 'number' ? `${a} / 5` : a === 'yes' ? 'Yes' : 'No'}</td>
                  <td class="edit">{!demo && <a href={`${base}quiz/?q=${q.id}`}>Edit</a>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!demo && (
          <div class="row">
            <a class="btn" href={`${base}quiz/`}>Back to questionnaire</a>
            <button
              class="btn ghost"
              onClick={() => {
                clearAnswers();
                location.href = `${base}quiz/`;
              }}
            >
              Start over
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function ToolCard({ result: r, primary }: { result: ToolResult; primary: boolean }) {
  return (
    <article class={`card pick ${primary ? 'primary' : ''}`}>
      <div class="pick-head">
        <h3>{r.tool.name}</h3>
        <span class="pick-conf">{r.confidence}%</span>
      </div>
      <div class="badges">
        {r.required && <span class="badge"><span class="dot" style={{ background: 'var(--good)' }} />Required</span>}
        {r.notAlone && <span class="badge"><span class="dot" style={{ background: 'var(--warning)' }} />Pair with another tool</span>}
        {!r.required && <span class="badge">Score {r.score > 0 ? '+' : ''}{r.score}</span>}
      </div>
      <p class="secondary">{r.tool.description}</p>
    </article>
  );
}
