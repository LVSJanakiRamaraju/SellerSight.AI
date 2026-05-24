import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

import { getProducts, getQualityReportUrl, type ProductFilters, type ProductListItem } from "@/lib/api";

function qualityTone(score: number | null): string {
  if (score === null) return "bg-slate-100 text-slate-700";
  if (score >= 80) return "bg-emerald-100 text-emerald-800";
  if (score >= 60) return "bg-amber-100 text-amber-900";
  return "bg-rose-100 text-rose-800";
}

function currency(value: number | null): string {
  if (value === null || Number.isNaN(value)) return "-";
  return `INR ${value.toFixed(2)}`;
}

export default function ProductsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [filters, setFilters] = useState<ProductFilters>({});

  const productsQuery = useQuery({
    queryKey: ["products", filters],
    queryFn: () => getProducts(filters),
    refetchInterval: 10000,
  });

  const products = productsQuery.data ?? [];

  const stats = useMemo(() => {
    const total = products.length;
    const inStock = products.filter((p) => p.availability === "in_stock").length;
    const outOfStock = products.filter((p) => p.availability === "out_of_stock").length;
    const weakQuality = products.filter((p) => (p.quality_score ?? 0) < 60).length;
    return { total, inStock, outOfStock, weakQuality };
  }, [products]);

  const applySearch = () => {
    setFilters((prev) => ({ ...prev, search: searchInput.trim() || undefined }));
  };

  const setFilter = (key: keyof ProductFilters, value: string) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value ? value : undefined,
    }));
  };

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900">Products</h2>
        <p className="mt-1 text-slate-600">Filter listings by severity, category, stock status, and search query.</p>
        <div className="mt-3">
          <a
            href={getQualityReportUrl(filters)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            Download Quality Report
          </a>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <SummaryCard label="Total" value={stats.total} />
        <SummaryCard label="In Stock" value={stats.inStock} tone="emerald" />
        <SummaryCard label="Out of Stock" value={stats.outOfStock} tone="amber" />
        <SummaryCard label="Weak Quality" value={stats.weakQuality} tone="rose" />
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Search</label>
            <div className="flex gap-2">
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applySearch();
                }}
                placeholder="SKU or title"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
              />
              <button
                onClick={applySearch}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Apply
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Severity</label>
            <select
              value={filters.severity ?? ""}
              onChange={(e) => setFilter("severity", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              <option value="">All</option>
              <option value="HIGH">HIGH</option>
              <option value="MEDIUM">MEDIUM</option>
              <option value="LOW">LOW</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Availability</label>
            <select
              value={filters.availability ?? ""}
              onChange={(e) => setFilter("availability", e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
            >
              <option value="">All</option>
              <option value="in_stock">In Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
            <input
              value={filters.category ?? ""}
              onChange={(e) => setFilter("category", e.target.value)}
              placeholder="e.g. Shoes"
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-700"
            />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        {productsQuery.isLoading ? <p className="px-4 py-6 text-sm text-slate-500">Loading products...</p> : null}
        {productsQuery.isError ? <p className="px-4 py-6 text-sm text-rose-600">Failed to load products.</p> : null}
        {!productsQuery.isLoading && !productsQuery.isError && products.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No products match the selected filters.</p>
        ) : null}

        {products.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">SKU</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Price</th>
                  <th className="px-4 py-3">Quality</th>
                  <th className="px-4 py-3">Availability</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {products.map((p) => (
                  <ProductRow key={p.sku_id} product={p} />
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ProductRow({ product }: { product: ProductListItem }) {
  return (
    <tr>
      <td className="px-4 py-3 align-top font-mono text-xs text-slate-700">{product.sku_id}</td>
      <td className="px-4 py-3 align-top">
        <p className="font-semibold text-slate-900">{product.product_title || "Untitled Product"}</p>
        <p className="text-xs text-slate-500">{product.brand || "Unknown brand"}</p>
      </td>
      <td className="px-4 py-3 align-top text-slate-700">{product.category || "-"}</td>
      <td className="px-4 py-3 align-top text-slate-700">
        <p>{currency(product.price)}</p>
        <p className="text-xs text-slate-500">MRP: {currency(product.mrp)}</p>
      </td>
      <td className="px-4 py-3 align-top">
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${qualityTone(product.quality_score)}`}>
          {product.quality_score !== null ? `${product.quality_score.toFixed(0)}%` : "N/A"}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            product.availability === "in_stock"
              ? "bg-emerald-100 text-emerald-800"
              : "bg-slate-100 text-slate-700"
          }`}
        >
          {product.availability === "in_stock" ? "In Stock" : "Out of Stock"}
        </span>
      </td>
      <td className="px-4 py-3 align-top">
        <Link
          to={`/products/${product.sku_id}`}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Open
        </Link>
      </td>
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
  tone?: "slate" | "emerald" | "amber" | "rose";
}) {
  const toneClass =
    tone === "emerald"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : tone === "amber"
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
