import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  allQuestions,
  computeResults,
  loadAnswers,
  saveAnswers,
  clearAnswers,
  type Answers,
  type Answer,
} from '../lib/scoring';
import './quiz.css';

interface Props {
  base: string;
}

export default function Quiz({ base }: Props) {
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState<'fwd' | 'back'>('fwd');
  const advancing = useRef(false);
  const total = allQuestions.length;
  const q = allQuestions[index];

  // Restore saved progress (client only). `?q=<id>` jumps to a specific question (used by "edit" on results).
  useEffect(() => {
    const saved = loadAnswers();
    setAnswers(saved);
    const jump = new URLSearchParams(location.search).get('q');
    const jumpIdx = jump ? allQuestions.findIndex((x) => x.id === jump) : -1;
    if (jumpIdx >= 0) setIndex(jumpIdx);
    else {
      const firstUnanswered = allQuestions.findIndex((x) => saved[x.id] === undefined);
      setIndex(firstUnanswered === -1 ? 0 : firstUnanswered);
    }
  }, []);

  const results = useMemo(() => computeResults(answers), [answers]);
  const maxAbs = Math.max(1, ...results.ranked.map((r) => Math.abs(r.score)));

  const go = (next: number) => {
    setDirection(next < index ? 'back' : 'fwd');
    setIndex(next);
  };

  const finish = (final: Answers) => {
    saveAnswers(final);
    location.href = `${base}results/`;
  };

  const answer = (value: Answer) => {
    if (advancing.current) return; // ignore double clicks during the advance delay
    advancing.current = true;
    const next = { ...answers, [q.id]: value };
    setAnswers(next);
    saveAnswers(next);
    // Brief pause so the selection is visible before advancing.
    setTimeout(() => {
      advancing.current = false;
      if (index < total - 1) go(index + 1);
      else finish(next);
    }, 140);
  };

  // Keyboard: 1–5 for ratings, Y/N for yes/no, ←/Backspace to go back, → to skip forward.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (q.kind === 'rating' && /^[1-5]$/.test(e.key)) answer(Number(e.key));
      else if (q.kind === 'rule' && (e.key === 'y' || e.key === 'Y')) answer('yes');
      else if (q.kind === 'rule' && (e.key === 'n' || e.key === 'N')) answer('no');
      else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && index > 0) go(index - 1);
      else if (e.key === 'ArrowRight' && index < total - 1 && answers[q.id] !== undefined) go(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const current = answers[q.id];
  const sectionLabel = q.kind === 'rating' ? 'Rate your project' : 'Yes or no';
  const allAnswered = results.answeredCount === total;

  return (
    <div class="quiz">
      <div class="quiz-progress" aria-label={`Question ${index + 1} of ${total}`}>
        <div class="quiz-progress-bar" style={{ width: `${(results.answeredCount / total) * 100}%` }} />
      </div>
      <div class="quiz-meta">
        <span>{sectionLabel}</span>
        <span>
          {index + 1} / {total}
        </span>
      </div>

      <div class={`quiz-card card slide-${direction}`} key={q.id}>
        {q.kind === 'rating' ? (
          <>
            <h2>{q.label}</h2>
            <p class="secondary">How would you rate your project from 1 to 5?</p>
            <div class="scale" role="radiogroup" aria-label={q.label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={current === n}
                  class={`scale-btn ${current === n ? 'selected' : ''}`}
                  onClick={() => answer(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div class="scale-ends">
              <span>
                <strong>1</strong> = {q.low}
              </span>
              <span>
                <strong>5</strong> = {q.high}
              </span>
            </div>
          </>
        ) : (
          <>
            <h2>{q.label}</h2>
            <div class="yesno" role="radiogroup" aria-label={q.label}>
              {(['yes', 'no'] as const).map((v) => (
                <button
                  type="button"
                  role="radio"
                  aria-checked={current === v}
                  class={`yesno-btn ${current === v ? 'selected' : ''}`}
                  onClick={() => answer(v)}
                >
                  {v === 'yes' ? 'Yes' : 'No'}
                  <kbd>{v === 'yes' ? 'Y' : 'N'}</kbd>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div class="quiz-nav">
        <button class="btn ghost" disabled={index === 0} onClick={() => go(index - 1)}>
          ← Back
        </button>
        <span class="muted kbd-hint">
          {q.kind === 'rating' ? 'Press 1–5' : 'Press Y or N'} · ← to go back
        </span>
        {allAnswered ? (
          <button class="btn primary" onClick={() => finish(answers)}>
            See results →
          </button>
        ) : (
          <button
            class="btn ghost"
            disabled={index === total - 1 || current === undefined}
            onClick={() => go(index + 1)}
          >
            Next →
          </button>
        )}
      </div>

      <section class="live-score card" aria-label="Running score">
        <div class="live-score-head">
          <h3>Running score</h3>
          <button
            class="btn ghost small"
            onClick={() => {
              clearAnswers();
              setAnswers({});
              go(0);
            }}
          >
            Reset
          </button>
        </div>
        <ul>
          {results.ranked.map((r) => (
            <li class={r.excluded ? 'excluded' : ''}>
              <span class="ls-name">{r.tool.name}</span>
              <span class="ls-track">
                <span class="ls-zero" />
                <span
                  class={`ls-bar ${r.score >= 0 ? 'pos' : 'neg'}`}
                  style={{
                    width: `${(Math.abs(r.score) / maxAbs) * 50}%`,
                    [r.score >= 0 ? 'left' : 'right']: '50%',
                  }}
                />
              </span>
              <span class="ls-val">
                {r.required ? 'Required' : r.excluded ? 'Ruled out' : r.score > 0 ? `+${r.score}` : r.score}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
