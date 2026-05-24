import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { getQualitySummary } from "@/lib/api";

const severityColors = {
  HIGH: "#ef4444",
  MEDIUM: "#f59e0b",
  LOW: "#22c55e",
} as const;

export default function DashboardPage() {
  const summaryQuery = useQuery({
    queryKey: ["quality-summary"],
    queryFn: getQualitySummary,
    refetchInterval: 10000,
  });

  const summary = summaryQuery.data;

  const severityData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: "HIGH", value: summary.high_issue_count },
      { name: "MEDIUM", value: summary.medium_issue_count },
      { name: "LOW", value: summary.low_issue_count },
    ];
  }, [summary]);

  const topIssueData = useMemo(() => {
    if (!summary) return [];
    return summary.issue_breakdown.slice(0, 7).map((item) => ({
      issue: item.issue_type,
      count: item.count,
      severity: item.severity,
    }));
  }, [summary]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900">Dashboard</h2>
        <p className="mt-1 text-slate-600">Real-time listing quality, issue severity, and alert insights.</p>
      </div>

      {summaryQuery.isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">Loading dashboard metrics...</div>
      ) : null}

      {summaryQuery.isError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          Failed to load dashboard summary. Verify backend availability and refresh.
        </div>
      ) : null}

      {summary ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard title="Products" value={summary.total_products} tone="slate" />
            <MetricCard title="Avg Quality" value={`${summary.avg_quality_score.toFixed(1)}%`} tone="brand" />
            <MetricCard title="High Issues" value={summary.high_issue_count} tone="rose" />
            <MetricCard title="Missing Images" value={summary.missing_image_count} tone="amber" />
            <MetricCard title="Invalid Prices" value={summary.invalid_price_count} tone="rose" />
            <MetricCard title="Unread Alerts" value={summary.unread_alerts} tone="emerald" />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-lg font-bold text-slate-900">Issue Severity Mix</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={severityData} dataKey="value" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={3}>
                      {severityData.map((entry) => (
                        <Cell key={entry.name} fill={severityColors[entry.name as keyof typeof severityColors]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-2 flex gap-4 text-xs font-semibold">
                <span className="text-rose-600">HIGH: {summary.high_issue_count}</span>
                <span className="text-amber-600">MEDIUM: {summary.medium_issue_count}</span>
                <span className="text-emerald-600">LOW: {summary.low_issue_count}</span>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-lg font-bold text-slate-900">Top Issue Types</h3>
              <div className="h-72 w-full">
                <ResponsiveContainer>
                  <BarChart data={topIssueData} margin={{ top: 10, right: 10, left: 0, bottom: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="issue" tick={{ fontSize: 11 }} angle={-22} textAnchor="end" height={56} />
                    <YAxis allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                      {topIssueData.map((entry, idx) => (
                        <Cell
                          key={`${entry.issue}-${idx}`}
                          fill={
                            entry.severity === "HIGH"
                              ? severityColors.HIGH
                              : entry.severity === "MEDIUM"
                              ? severityColors.MEDIUM
                              : severityColors.LOW
                          }
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </article>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Operational Snapshot</h3>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <MiniCard label="No Issue Listings" value={summary.no_issue_count} />
              <MiniCard label="Out of Stock" value={summary.out_of_stock_count} />
              <MiniCard label="Total Alerts" value={summary.total_alerts} />
              <MiniCard label="Low Priority Issues" value={summary.low_issue_count} />
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

function MetricCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: number | string;
  tone: "slate" | "brand" | "rose" | "amber" | "emerald";
}) {
  const toneClass =
    tone === "brand"
      ? "border-brand-200 bg-brand-50 text-brand-900"
      : tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-xs font-medium opacity-80">{title}</p>
      <p className="mt-1 text-2xl font-extrabold leading-none">{value}</p>
    </div>
  );
}

function MiniCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  );
}
