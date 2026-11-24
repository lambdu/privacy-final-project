import { describe, expect, it } from 'vitest';
import { computeResults, ratingContribution, ruleQuestions, ratingQuestions, tools } from './scoring';
import demoAnswers from '../data/demo-answers.json';

const byId = (r: ReturnType<typeof computeResults>, id: string) => r.ranked.find((x) => x.tool.id === id)!;

describe('data', () => {
  it('every weight and rule effect references a known tool', () => {
    const ids = new Set(tools.map((t) => t.id));
    for (const q of ratingQuestions) for (const k of Object.keys(q.weights)) expect(ids).toContain(k);
    for (const q of ruleQuestions) for (const e of q.effects) if (e.tool) expect(ids).toContain(e.tool);
  });
});

describe('scoring', () => {
  it('ratings are centered on 3', () => {
    expect(ratingContribution(1, 3)).toBe(0);
    expect(ratingContribution(1, 5)).toBe(2);
    expect(ratingContribution(-1, 5)).toBe(-2);
    expect(ratingContribution(1, 1)).toBe(-2);
  });

  it('applies weighted ratings', () => {
    const r = computeResults({ sensitivity: 5 });
    expect(byId(r, 'dp').score).toBe(2);
    expect(byId(r, 'anonymization').score).toBe(-2);
    expect(byId(r, 'zkp').score).toBe(0);
  });

  it('require pins a tool to the top at 100%', () => {
    const r = computeResults({ sensitivity: 1, regulated: 'yes' });
    expect(r.ranked[0].tool.id).toBe('law');
    expect(r.ranked[0].required).toBe(true);
    expect(r.ranked[0].confidence).toBe(100);
  });

  it('exclude rules a tool out and ranks it last', () => {
    const r = computeResults({ distrust: 5, ml_training: 'no' });
    const fl = byId(r, 'fl');
    expect(fl.excluded).toBe(true);
    expect(fl.confidence).toBe(0);
    expect(r.ranked.at(-1)!.tool.id).toBe('fl');
  });

  it('collects notes and warnings from triggered rules', () => {
    const r = computeResults({ small_dataset: 'yes', cross_border: 'yes', images: 'no' });
    expect(r.effects.map((e) => e.questionId)).toEqual(['small_dataset', 'cross_border']);
  });

  it('demo answers produce a full result', () => {
    const r = computeResults(demoAnswers as never);
    expect(r.answeredCount).toBe(r.totalQuestions);
    expect(byId(r, 'law').required).toBe(true);
    expect(byId(r, 'cryptography').required).toBe(true);
    expect(byId(r, 'zkp').excluded).toBe(true);
    expect(r.overallConfidence).toBeGreaterThan(0);
  });
});
