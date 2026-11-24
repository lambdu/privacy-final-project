import questionsData from '../data/questions.json';
import toolsData from '../data/tools.json';

// ---------- Types ----------

export type ToolId = string;
export type YesNo = 'yes' | 'no';
export type Answer = number | YesNo;
export type Answers = Record<string, Answer>;

export interface Tool {
  id: ToolId;
  name: string;
  short: string;
  description: string;
}

export interface RatingQuestion {
  id: string;
  label: string;
  low: string;
  high: string;
  weights: Record<ToolId, number>;
}

export type EffectType = 'require' | 'exclude' | 'boost' | 'not-alone' | 'warning' | 'note';

export interface RuleEffect {
  when: YesNo;
  type: EffectType;
  tool?: ToolId;
  text: string;
}

export interface RuleQuestion {
  id: string;
  label: string;
  effects: RuleEffect[];
}

export type Question =
  | ({ kind: 'rating' } & RatingQuestion)
  | ({ kind: 'rule' } & RuleQuestion);

export interface TriggeredEffect extends RuleEffect {
  questionId: string;
  questionLabel: string;
}

export interface ToolResult {
  tool: Tool;
  /** Raw weighted score (sum of contributions). */
  score: number;
  /** 0–100, relative to other tools; overridden by require/exclude. */
  confidence: number;
  required: boolean;
  excluded: boolean;
  notAlone: boolean;
  /** Sum of positive contributions. */
  support: number;
  /** Absolute sum of negative contributions. */
  concerns: number;
  /** Per-question contribution to this tool's score (non-zero only). */
  contributions: { questionId: string; label: string; value: number }[];
  /** Effects from rule questions that mention this tool. */
  effects: TriggeredEffect[];
}

export interface Results {
  ranked: ToolResult[];
  /** Every triggered rule effect, in question order. */
  effects: TriggeredEffect[];
  /** Overall confidence (0–100) in the top recommendation. */
  overallConfidence: number;
  answeredCount: number;
  totalQuestions: number;
}

// ---------- Data ----------

export const tools: Tool[] = toolsData;
export const ratingQuestions: RatingQuestion[] = questionsData.ratings;
export const ruleQuestions: RuleQuestion[] = questionsData.rules as RuleQuestion[];

/** The order questions are asked in: all ratings, then all yes/no rules. */
export const allQuestions: Question[] = [
  ...ratingQuestions.map((q) => ({ kind: 'rating' as const, ...q })),
  ...ruleQuestions.map((q) => ({ kind: 'rule' as const, ...q })),
];

// ---------- Tunables ----------

/** Neutral point of the 1–5 scale. Ratings above it push weights up, below pull down. */
export const RATING_MIDPOINT = 3;
/** Points added to a tool's score by a `boost` rule effect. */
export const BOOST_POINTS = 2;

/** How a single rating answer contributes to a tool's score. Change here to change the model. */
export function ratingContribution(weight: number, rating: number): number {
  return weight * (rating - RATING_MIDPOINT);
}

// ---------- Scoring ----------

export function computeResults(answers: Answers): Results {
  const byTool = new Map<ToolId, ToolResult>();
  for (const tool of tools) {
    byTool.set(tool.id, {
      tool,
      score: 0,
      confidence: 0,
      required: false,
      excluded: false,
      notAlone: false,
      support: 0,
      concerns: 0,
      contributions: [],
      effects: [],
    });
  }

  const addContribution = (toolId: ToolId, questionId: string, label: string, value: number) => {
    const r = byTool.get(toolId);
    if (!r || value === 0) return;
    r.score += value;
    if (value > 0) r.support += value;
    else r.concerns += -value;
    r.contributions.push({ questionId, label, value });
  };

  // 1. Weighted ratings
  for (const q of ratingQuestions) {
    const a = answers[q.id];
    if (typeof a !== 'number') continue;
    for (const [toolId, weight] of Object.entries(q.weights)) {
      addContribution(toolId, q.id, q.label, ratingContribution(weight, a));
    }
  }

  // 2. Yes/no rules
  const effects: TriggeredEffect[] = [];
  for (const q of ruleQuestions) {
    const a = answers[q.id];
    if (a !== 'yes' && a !== 'no') continue;
    for (const e of q.effects) {
      if (e.when !== a) continue;
      const triggered: TriggeredEffect = { ...e, questionId: q.id, questionLabel: q.label };
      effects.push(triggered);
      const r = e.tool ? byTool.get(e.tool) : undefined;
      if (!r) continue;
      r.effects.push(triggered);
      if (e.type === 'require') r.required = true;
      if (e.type === 'exclude') r.excluded = true;
      if (e.type === 'not-alone') r.notAlone = true;
      if (e.type === 'boost') addContribution(r.tool.id, q.id, q.label, BOOST_POINTS);
    }
  }

  // A tool that is both required and excluded: requirement wins (flagged by both effects in notes).
  for (const r of byTool.values()) if (r.required) r.excluded = false;

  // 3. Confidence: min-max normalize scores across non-excluded tools.
  const all = [...byTool.values()];
  const candidates = all.filter((r) => !r.excluded);
  const scores = candidates.map((r) => r.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  for (const r of all) {
    if (r.excluded) r.confidence = 0;
    else if (r.required) r.confidence = 100;
    else r.confidence = max === min ? 50 : Math.round(((r.score - min) / (max - min)) * 100);
  }

  // 4. Rank: required first, then by score, excluded last.
  const rankKey = (r: ToolResult) => (r.required ? 2 : r.excluded ? 0 : 1);
  const ranked = all.sort((a, b) => rankKey(b) - rankKey(a) || b.score - a.score);

  // 5. Overall confidence: how far the top non-required pick stands out, scaled by how much was answered.
  const answeredCount = allQuestions.filter((q) => answers[q.id] !== undefined).length;
  const totalQuestions = allQuestions.length;
  const open = ranked.filter((r) => !r.excluded && !r.required);
  const spread = max - min;
  const separation =
    open.length < 2 ? 1 // rules alone decided everything
    : spread === 0 ? 0
    : Math.max(0, Math.min(1, (open[0].score - open[1].score) / spread));
  const coverage = answeredCount / totalQuestions;
  const overallConfidence = Math.round(100 * coverage * (0.5 + 0.5 * separation));

  return { ranked, effects, overallConfidence, answeredCount, totalQuestions };
}

// ---------- Persistence ----------

export const STORAGE_KEY = 'privacy-tool-answers-v1';

export function loadAnswers(): Answers {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Answers) : {};
  } catch {
    return {};
  }
}

export function saveAnswers(answers: Answers): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers));
  } catch {
    /* storage unavailable (private mode etc.) — quiz still works in-memory */
  }
}

export function clearAnswers(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}
