import { useCallback } from 'preact/hooks';
import type { ChartConfiguration } from 'chart.js';
import ChartCanvas, { alpha, type Theme } from './ChartCanvas';
import type { ToolResult } from '../../lib/scoring';

const tooltipStyle = (t: Theme) => ({
  backgroundColor: t.surface,
  titleColor: t.ink,
  bodyColor: t.ink2,
  borderColor: t.axis,
  borderWidth: 1,
  padding: 10,
  boxPadding: 4,
});

/** Horizontal bar: 0–100 confidence per tool. */
export function ConfidenceChart({ ranked }: { ranked: ToolResult[] }) {
  const config = useCallback(
    (t: Theme): ChartConfiguration => ({
      type: 'bar',
      data: {
        labels: ranked.map((r) => r.tool.name),
        datasets: [
          {
            label: 'Confidence',
            data: ranked.map((r) => r.confidence),
            backgroundColor: ranked.map((r) => (r.excluded ? t.axis : t.series1)),
            borderRadius: { topRight: 4, bottomRight: 4 },
            borderSkipped: 'start',
            barThickness: 18,
          },
        ],
      },
      options: {
        indexAxis: 'y',
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            ...tooltipStyle(t),
            callbacks: {
              label: (ctx) => {
                const r = ranked[ctx.dataIndex];
                if (r.required) return 'Required by your answers (100%)';
                if (r.excluded) return 'Ruled out by your answers';
                return `Confidence: ${r.confidence}% (score ${r.score > 0 ? '+' : ''}${r.score})`;
              },
            },
          },
        },
        scales: {
          x: {
            min: 0,
            max: 100,
            ticks: { color: t.muted, callback: (v) => `${v}%`, stepSize: 25 },
            grid: { color: t.grid },
            border: { color: t.axis },
          },
          y: { ticks: { color: t.ink2 }, grid: { display: false }, border: { color: t.axis } },
        },
      },
    }),
    [ranked],
  );
  return <ChartCanvas config={config} height={260} label="Bar chart of confidence for each privacy tool" />;
}

/** Spider chart: how much your answers support vs. argue against each tool. */
export function BalanceRadar({ ranked }: { ranked: ToolResult[] }) {
  const config = useCallback(
    (t: Theme): ChartConfiguration => {
      // Keep a fixed tool order on the radar (not rank order) so the shape is comparable across runs.
      const ordered = [...ranked].sort((a, b) => a.tool.id.localeCompare(b.tool.id));
      return {
        type: 'radar',
        data: {
          labels: ordered.map((r) => r.tool.short),
          datasets: [
            {
              label: 'Support',
              data: ordered.map((r) => r.support),
              borderColor: t.series1,
              backgroundColor: alpha(t.series1, 0.18),
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: t.series1,
              pointBorderColor: t.surface,
              pointBorderWidth: 2,
            },
            {
              label: 'Concerns',
              data: ordered.map((r) => r.concerns),
              borderColor: t.series2,
              backgroundColor: alpha(t.series2, 0.12),
              borderWidth: 2,
              pointRadius: 4,
              pointBackgroundColor: t.series2,
              pointBorderColor: t.surface,
              pointBorderWidth: 2,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { color: t.ink2, usePointStyle: true, boxWidth: 8 } },
            tooltip: {
              ...tooltipStyle(t),
              callbacks: { title: (items) => ordered[items[0].dataIndex].tool.name },
            },
          },
          scales: {
            r: {
              beginAtZero: true,
              angleLines: { color: t.grid },
              grid: { color: t.grid },
              pointLabels: { color: t.ink2, font: { size: 12, weight: 600 } },
              ticks: { color: t.muted, backdropColor: 'transparent', precision: 0 },
            },
          },
        },
      };
    },
    [ranked],
  );
  return <ChartCanvas config={config} height={320} label="Radar chart of support versus concerns for each tool" />;
}

/** Diverging bar: which answers pushed one tool's score up (blue) or down (red). */
export function ContributionChart({ result }: { result: ToolResult }) {
  const config = useCallback(
    (t: Theme): ChartConfiguration => {
      const items = [...result.contributions].sort((a, b) => b.value - a.value);
      return {
        type: 'bar',
        data: {
          labels: items.map((c) => c.label),
          datasets: [
            {
              label: 'Contribution',
              data: items.map((c) => c.value),
              backgroundColor: items.map((c) => (c.value >= 0 ? t.pos : t.neg)),
              borderRadius: 4,
              borderSkipped: 'start',
              barThickness: 16,
            },
          ],
        },
        options: {
          indexAxis: 'y',
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              ...tooltipStyle(t),
              callbacks: { label: (ctx) => `${(ctx.raw as number) > 0 ? '+' : ''}${ctx.raw} points` },
            },
          },
          scales: {
            x: {
              ticks: { color: t.muted, precision: 0 },
              grid: { color: (ctx) => (ctx.tick.value === 0 ? t.axis : t.grid) },
              border: { display: false },
            },
            y: { ticks: { color: t.ink2 }, grid: { display: false }, border: { color: t.axis } },
          },
        },
      };
    },
    [result],
  );
  const height = Math.max(120, result.contributions.length * 34 + 50);
  return <ChartCanvas config={config} height={height} label={`What drove the ${result.tool.name} score`} />;
}
