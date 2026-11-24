import { useEffect, useRef } from 'preact/hooks';
import {
  Chart,
  BarController,
  BarElement,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
  type ChartConfiguration,
} from 'chart.js';

Chart.register(
  BarController,
  BarElement,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
);

/** Reads design tokens from CSS so charts follow light/dark mode. */
export interface Theme {
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  surface: string;
  series1: string;
  series2: string;
  pos: string;
  neg: string;
}

export function readTheme(): Theme {
  const s = getComputedStyle(document.documentElement);
  const v = (name: string) => s.getPropertyValue(name).trim();
  return {
    ink: v('--ink'),
    ink2: v('--ink-2'),
    muted: v('--muted'),
    grid: v('--grid'),
    axis: v('--axis'),
    surface: v('--surface'),
    series1: v('--series-1'),
    series2: v('--series-2'),
    pos: v('--pos'),
    neg: v('--neg'),
  };
}

/** Translucent version of a hex color, for area fills. */
export function alpha(hex: string, a: number): string {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

interface Props {
  /** Build the Chart.js config from the current theme. */
  config: (theme: Theme) => ChartConfiguration;
  height: number;
  label: string;
}

export default function ChartCanvas({ config, height, label }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
    let chart = new Chart(ref.current, config(readTheme()));
    // Rebuild when the OS color scheme flips.
    const mq = matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      chart.destroy();
      chart = new Chart(ref.current!, config(readTheme()));
    };
    mq.addEventListener('change', onChange);
    return () => {
      mq.removeEventListener('change', onChange);
      chart.destroy();
    };
  }, [config]);

  return (
    <div style={{ position: 'relative', height: `${height}px` }}>
      <canvas ref={ref} role="img" aria-label={label} />
    </div>
  );
}
