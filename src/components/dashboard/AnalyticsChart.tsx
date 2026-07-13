import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";
import { useReducedMotion } from "framer-motion";

type ChartPoint = Readonly<{ date: string; views: number }>;
type BarPoint = Readonly<Record<string, string | number>>;

const tooltipStyle = {
  background: "var(--chart-tooltip-bg)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  fontSize: 12.5,
};

function BrandTooltip({ active, payload, label }: TooltipProps<number, string>) {
  if (!active || !payload?.length) return null;
  return (
    <div style={tooltipStyle} className="px-3 py-2 shadow-lg">
      <p className="mb-1 text-xs text-white/70">{label}</p>
      <p className="text-sm font-semibold text-white">{payload[0]?.value?.toLocaleString()}</p>
    </div>
  );
}

export function ViewsOverTimeChart({ data }: Readonly<{ data: ChartPoint[] }>) {
  const reduceMotion = useReducedMotion();

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-primary)" stopOpacity={0.35} />
            <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis
          dataKey="date"
          stroke="rgba(255,255,255,0.35)"
          fontSize={11}
          tickLine={false}
          axisLine={false}
        />
        <YAxis stroke="rgba(255,255,255,0.35)" fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip
          content={<BrandTooltip />}
          cursor={{ stroke: "var(--chart-primary)", strokeWidth: 1, strokeDasharray: "4 4" }}
        />
        <Area
          type="monotone"
          dataKey="views"
          stroke="var(--chart-primary)"
          strokeWidth={2.5}
          fill="url(#viewsGradient)"
          isAnimationActive={!reduceMotion}
          animationDuration={900}
          animationEasing="ease-out"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

type BrandBarChartProps = Readonly<{
  data: BarPoint[];
  xKey: string;
  yKey: string;
  height?: number;
  fill?: string;
  tooltipFormatter?: (value: number) => string;
}>;

export function BrandBarChart({
  data,
  xKey,
  yKey,
  height = 224,
  fill = "var(--chart-primary)",
  tooltipFormatter,
}: BrandBarChartProps) {
  const reduceMotion = useReducedMotion();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          labelStyle={{ color: "#fff" }}
          formatter={tooltipFormatter ? (v: number) => tooltipFormatter(v) : undefined}
          cursor={{ fill: "rgba(255,255,255,0.04)" }}
        />
        <Bar
          dataKey={yKey}
          fill={fill}
          radius={4}
          isAnimationActive={!reduceMotion}
          animationDuration={700}
          animationEasing="ease-out"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BrandLineChart({
  data,
  xKey,
  yKey,
  height = 224,
  stroke = "var(--chart-tertiary)",
}: Readonly<{
  data: BarPoint[];
  xKey: string;
  yKey: string;
  height?: number;
  stroke?: string;
}>) {
  const reduceMotion = useReducedMotion();

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "#fff" }} />
        <Line
          type="monotone"
          dataKey={yKey}
          stroke={stroke}
          strokeWidth={2.5}
          dot={false}
          isAnimationActive={!reduceMotion}
          animationDuration={900}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
