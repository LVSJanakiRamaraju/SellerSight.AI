import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getAlerts,
  markAlertsRead,
  refreshCompetitorPrices,
  type AlertFilters,
  type ProductAlert,
} from "@/lib/api";

function badgeForSeverity(severity: "HIGH" | "MEDIUM" | "LOW"): string {
  if (severity === "HIGH") return "bg-rose-100 text-rose-800";
  if (severity === "MEDIUM") return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-800";
}

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<number[]>([]);
  const [filters, setFilters] = useState<AlertFilters>({});

  const alertsQuery = useQuery({
    queryKey: ["alerts", filters],
    queryFn: () => getAlerts(filters),
    refetchInterval: 8000,
  });

  const markReadMutation = useMutation({
    mutationFn: (ids: number[]) => markAlertsRead(ids),
    onSuccess: () => {
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["quality-summary"] });
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => refreshCompetitorPrices(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const alerts = alertsQuery.data ?? [];

  const counts = useMemo(() => {
    const total = alerts.length;
    const unread = alerts.filter((a) => !a.is_read).length;
    const high = alerts.filter((a) => a.severity === "HIGH").length;
    return { total, unread, high };
  }, [alerts]);

  const toggleOne = (id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleAll = () => {
    if (alerts.length === 0) return;
    const allIds = alerts.map((a) => a.id);
    setSelected((prev) => (prev.length === allIds.length ? [] : allIds));
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900">Alerts</h2>
          <p className="mt-1 text-slate-600">Track listing and pricing alerts, then mark reviewed items as read.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => markReadMutation.mutate(selected)}
            disabled={selected.length === 0 || markReadMutation.isPending}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {markReadMutation.isPending ? "Marking..." : `Mark Read (${selected.length})`}
          </button>
          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {refreshMutation.isPending ? "Refreshing..." : "Refresh Competitor Prices"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <SummaryCard label="Total Alerts" value={counts.total} />
        <SummaryCard label="Unread" value={counts.unread} tone="amber" />
        <SummaryCard label="High Severity" value={counts.high} tone="rose" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Severity</label>
            <select
              value={filters.severity ?? ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  severity: (e.target.value as AlertFilters["severity"]) || undefined,
                }))
              }
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              <option value="">All</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Read State</label>
            <select
              value={filters.is_read === undefined ? "" : filters.is_read ? "true" : "false"}
              onChange={(e) => {
                const val = e.target.value;
                setFilters((prev) => ({
                  ...prev,
                  is_read: val === "" ? undefined : val === "true",
                }));
              }}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              <option value="">All</option>
              <option value="false">Unread</option>
              <option value="true">Read</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">SKU</label>
            <input
              value={filters.sku_id ?? ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  sku_id: e.target.value.trim() || undefined,
                }))
              }
              placeholder="e.g. SHOE001"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {alertsQuery.isLoading ? <p className="px-4 py-6 text-sm text-slate-500">Loading alerts...</p> : null}
        {alertsQuery.isError ? <p className="px-4 py-6 text-sm text-rose-600">Failed to load alerts.</p> : null}

        {!alertsQuery.isLoading && !alertsQuery.isError && alerts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No alerts match the selected filters.</p>
        ) : null}

        {alerts.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.length === alerts.length && alerts.length > 0}
                      onChange={toggleAll}
                      className="h-4 w-4 rounded border-slate-300 text-brand-500"
                    />
                  </th>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Message</th>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alerts.map((alert) => (
                  <AlertRow key={alert.id} alert={alert} selected={selected.includes(alert.id)} onToggle={toggleOne} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AlertRow({
  alert,
  selected,
  onToggle,
}: {
  alert: ProductAlert;
  selected: boolean;
  onToggle: (id: number) => void;
}) {
  return (
    <tr className={alert.is_read ? "opacity-75" : ""}>
      <td className="px-4 py-3 align-top">
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(alert.id)}
          className="h-4 w-4 rounded border-slate-300 text-brand-500"
        />
      </td>
      <td className="px-4 py-3 align-top">
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeForSeverity(alert.severity)}`}>{alert.severity}</span>
      </td>
      <td className="px-4 py-3 align-top text-slate-700">{alert.alert_type}</td>
      <td className="px-4 py-3 align-top text-slate-700">{alert.message}</td>
      <td className="px-4 py-3 align-top font-mono text-xs text-slate-600">{alert.sku_id || "-"}</td>
      <td className="px-4 py-3 align-top">
        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${alert.is_read ? "bg-slate-100 text-slate-700" : "bg-amber-100 text-amber-900"}`}>
          {alert.is_read ? "READ" : "UNREAD"}
        </span>
      </td>
      <td className="px-4 py-3 align-top text-slate-600">{new Date(alert.created_at).toLocaleString()}</td>
    </tr>
  );
}

function SummaryCard({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number;
  tone?: "slate" | "amber" | "rose";
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "rose"
      ? "border-rose-200 bg-rose-50 text-rose-900"
      : "border-slate-200 bg-white text-slate-900";

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-extrabold leading-none">{value}</p>
    </div>
  );
}
