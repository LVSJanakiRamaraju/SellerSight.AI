import { useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  enhanceProductTitle,
  getProductCompetitorComparison,
  getProductDetail,
  refreshCompetitorPrices,
  type ProductIssue,
} from "@/lib/api";

function badgeForSeverity(severity: "HIGH" | "MEDIUM" | "LOW"): string {
  if (severity === "HIGH") return "bg-rose-100 text-rose-800";
  if (severity === "MEDIUM") return "bg-amber-100 text-amber-900";
  return "bg-emerald-100 text-emerald-800";
}

function formatCurrency(v: number | null): string {
  if (v === null || Number.isNaN(v)) return "-";
  return `INR ${v.toFixed(2)}`;
}

function parseJson<T>(value: string | null): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

type PriceHistoryPoint = {
  price: number;
  checked_at: string;
};

function buildPriceHistoryChart(
  rows: Array<{ platform: string; price_history: string | null }>
): Array<Record<string, number | string | null>> {
  const byTimestamp = new Map<string, Record<string, number | string | null>>();

  rows.forEach((row) => {
    const history = parseJson<PriceHistoryPoint[]>(row.price_history) ?? [];
    history.forEach((point) => {
      if (!point.checked_at || typeof point.price !== "number") return;

      const existing = byTimestamp.get(point.checked_at) ?? {
        timestamp: point.checked_at,
        label: new Date(point.checked_at).toLocaleDateString(),
      };

      existing[row.platform] = point.price;
      byTimestamp.set(point.checked_at, existing);
    });
  });

  return Array.from(byTimestamp.values()).sort(
    (left, right) => new Date(String(left.timestamp)).getTime() - new Date(String(right.timestamp)).getTime()
  );
}

const CHART_COLORS = ["#0f766e", "#ea580c", "#2563eb", "#be123c", "#65a30d", "#7c3aed"];

export default function ProductDetailPage() {
  const { skuId } = useParams();
  const queryClient = useQueryClient();

  const productQuery = useQuery({
    queryKey: ["product", skuId],
    queryFn: () => getProductDetail(skuId as string),
    enabled: Boolean(skuId),
    refetchInterval: 10000,
  });

  const comparisonQuery = useQuery({
    queryKey: ["product-comparison", skuId],
    queryFn: () => getProductCompetitorComparison(skuId as string),
    enabled: Boolean(skuId),
    refetchInterval: 10000,
  });

  const enhanceMutation = useMutation({
    mutationFn: () => enhanceProductTitle(skuId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product", skuId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const refreshPricesMutation = useMutation({
    mutationFn: () => refreshCompetitorPrices(skuId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["jobs"] });
    },
  });

  const product = productQuery.data;
  const comparison = comparisonQuery.data;

  const keywordList = useMemo(() => parseJson<string[]>(product?.title_keywords ?? null) ?? [], [product]);
  const attrMap = useMemo(
    () => parseJson<Record<string, string>>(product?.title_attributes ?? null) ?? {},
    [product]
  );
  const priceHistoryChartData = useMemo(
    () => buildPriceHistoryChart(comparison?.competitor_prices ?? []),
    [comparison]
  );

  if (!skuId) {
    return (
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-slate-900">Product Detail</h2>
        <p className="text-slate-600">Missing SKU parameter in route.</p>
      </section>
    );
  }

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900">Product Detail</h2>
          <p className="mt-1 font-mono text-xs text-slate-500">{skuId}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => enhanceMutation.mutate()}
            disabled={enhanceMutation.isPending || !product}
            className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {enhanceMutation.isPending ? "Enhancing..." : "Enhance Title"}
          </button>
          <button
            onClick={() => refreshPricesMutation.mutate()}
            disabled={refreshPricesMutation.isPending || !product}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {refreshPricesMutation.isPending ? "Refreshing..." : "Refresh Competitor Prices"}
          </button>
          <Link to="/products" className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Back to Products
          </Link>
        </div>
      </div>

      {productQuery.isLoading ? <p className="text-sm text-slate-500">Loading product details...</p> : null}
      {productQuery.isError ? <p className="text-sm text-rose-600">Failed to load product detail.</p> : null}

      {product ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <StatCard label="Quality" value={product.quality_score !== null ? `${product.quality_score.toFixed(0)}%` : "N/A"} />
            <StatCard label="Price" value={formatCurrency(product.price)} />
            <StatCard label="MRP" value={formatCurrency(product.mrp)} />
            <StatCard label="Issues" value={product.issues.length} />
            <StatCard label="Alerts" value={product.alerts.length} />
          </div>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Listing Snapshot</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Title" value={product.product_title || "Untitled"} />
              <Field label="Brand" value={product.brand || "-"} />
              <Field label="Category" value={product.category || "-"} />
              <Field label="Availability" value={product.availability || "-"} />
              <Field label="Color" value={product.color || "-"} />
              <Field label="Size" value={product.size || "-"} />
              <Field label="Material" value={product.material || "-"} />
              <Field label="Image URL" value={product.image_url || "-"} />
            </div>
            <div className="mt-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p>
              <p className="mt-1 text-sm text-slate-700">{product.description || "No description"}</p>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Enhanced Title</h3>
            <p className="text-sm text-slate-600">Original: {product.product_title || "-"}</p>
            <p className="mt-1 text-sm font-semibold text-brand-700">Suggested: {product.enhanced_title || "Not generated yet"}</p>
            <p className="mt-1 text-xs text-slate-500">{product.title_enhancement_reason || "No enhancement reason yet"}</p>

            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Extracted Attributes</p>
                {Object.keys(attrMap).length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">No attributes extracted.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(attrMap).map(([k, v]) => (
                      <span key={k} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {k}: {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Keywords</p>
                {keywordList.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">No keywords generated.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {keywordList.map((k) => (
                      <span key={k} className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700">
                        {k}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </article>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-lg font-bold text-slate-900">Validation Issues</h3>
              {product.issues.length === 0 ? <p className="text-sm text-slate-500">No issues detected.</p> : <IssuesList issues={product.issues} />}
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-lg font-bold text-slate-900">Alerts</h3>
              {product.alerts.length === 0 ? (
                <p className="text-sm text-slate-500">No alerts for this product.</p>
              ) : (
                <ul className="space-y-2">
                  {product.alerts.slice(0, 8).map((a) => (
                    <li key={a.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex items-center justify-between">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeForSeverity(a.severity)}`}>{a.severity}</span>
                        <span className="text-xs text-slate-500">{a.alert_type}</span>
                      </div>
                      <p className="mt-2 text-sm text-slate-700">{a.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </article>
          </div>

          <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="mb-3 text-lg font-bold text-slate-900">Competitor Price Comparison</h3>
            {comparisonQuery.isLoading ? <p className="text-sm text-slate-500">Loading comparison...</p> : null}
            {comparisonQuery.isError ? <p className="text-sm text-rose-600">Failed to load competitor comparison.</p> : null}

            {comparison ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatCard label="Our Price" value={formatCurrency(comparison.our_price)} />
                  <StatCard label="Lowest" value={formatCurrency(comparison.lowest_competitor_price)} />
                  <StatCard label="Average" value={formatCurrency(comparison.avg_competitor_price)} />
                  <StatCard label="Gap %" value={comparison.percentage_diff !== null ? `${comparison.percentage_diff.toFixed(2)}%` : "-"} />
                </div>
                <p className="mt-3 text-sm text-slate-700">Recommendation: {comparison.recommended_action}</p>

                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Platform</th>
                        <th className="px-3 py-2">Price</th>
                        <th className="px-3 py-2">Checked</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {comparison.competitor_prices.map((r) => (
                        <tr key={r.id}>
                          <td className="px-3 py-2">{r.platform}</td>
                          <td className="px-3 py-2">{formatCurrency(r.competitor_price)}</td>
                          <td className="px-3 py-2">{new Date(r.last_checked_at).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-6">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 className="text-base font-bold text-slate-900">Price History Chart</h4>
                    <p className="text-xs text-slate-500">Trend by competitor platform</p>
                  </div>

                  {priceHistoryChartData.length === 0 ? (
                    <p className="text-sm text-slate-500">No competitor price history available yet.</p>
                  ) : (
                    <div className="h-80 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={priceHistoryChartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#cbd5e1" />
                          <XAxis dataKey="label" stroke="#64748b" tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                          <Tooltip />
                          <Legend />
                          {comparison.competitor_prices.map((row, index) => (
                            <Line
                              key={row.id}
                              type="monotone"
                              dataKey={row.platform}
                              stroke={CHART_COLORS[index % CHART_COLORS.length]}
                              strokeWidth={2}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          ))}
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </article>
        </>
      ) : null}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-sm text-slate-700">{value}</p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-slate-900">{value}</p>
    </div>
  );
}

function IssuesList({ issues }: { issues: ProductIssue[] }) {
  return (
    <ul className="space-y-2">
      {issues.map((issue) => (
        <li key={issue.id} className="rounded-xl border border-slate-200 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded-full px-2 py-1 text-xs font-semibold ${badgeForSeverity(issue.severity)}`}>{issue.severity}</span>
            <span className="text-xs text-slate-500">{issue.issue_type}</span>
          </div>
          <p className="mt-2 text-sm text-slate-700">{issue.message}</p>
          {issue.suggested_fix ? <p className="mt-1 text-xs text-slate-500">Fix: {issue.suggested_fix}</p> : null}
        </li>
      ))}
    </ul>
  );
}
