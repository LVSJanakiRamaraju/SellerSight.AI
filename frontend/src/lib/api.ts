import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

export type UploadResponse = {
  job_id: string;
  message: string;
  status: string;
};

export type ProductListItem = {
  sku_id: string;
  product_title: string | null;
  brand: string | null;
  category: string | null;
  price: number | null;
  mrp: number | null;
  description: string | null;
  image_url: string | null;
  product_url: string | null;
  availability: string | null;
  color: string | null;
  size: string | null;
  material: string | null;
  job_id: string | null;
  enhance_title: boolean;
  enhanced_title: string | null;
  title_keywords: string | null;
  title_attributes: string | null;
  title_enhancement_reason: string | null;
  quality_score: number | null;
  created_at: string;
  updated_at: string;
};

export type ProductFilters = {
  category?: string;
  severity?: "HIGH" | "MEDIUM" | "LOW";
  availability?: "in_stock" | "out_of_stock";
  search?: string;
};

export type ProductIssue = {
  id: number;
  sku_id: string;
  issue_type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  suggested_fix: string | null;
  created_at: string;
};

export type CompetitorPrice = {
  id: number;
  sku_id: string;
  product_name: string | null;
  platform: string;
  competitor_url: string | null;
  competitor_price: number;
  currency: string;
  last_checked_at: string;
  price_history: string | null;
};

export type ProductAlert = {
  id: number;
  sku_id: string | null;
  alert_type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  message: string;
  is_read: boolean;
  created_at: string;
};

export type ProductDetail = ProductListItem & {
  issues: ProductIssue[];
  competitor_prices: CompetitorPrice[];
  alerts: ProductAlert[];
};

export type PriceComparison = {
  sku_id: string;
  product_title: string | null;
  our_price: number | null;
  lowest_competitor_price: number | null;
  highest_competitor_price: number | null;
  avg_competitor_price: number | null;
  price_gap: number | null;
  percentage_diff: number | null;
  recommended_action: string;
  competitor_prices: CompetitorPrice[];
};

export async function getProducts(filters: ProductFilters = {}): Promise<ProductListItem[]> {
  const { data } = await api.get<ProductListItem[]>("/products", {
    params: {
      category: filters.category || undefined,
      severity: filters.severity || undefined,
      availability: filters.availability || undefined,
      search: filters.search || undefined,
    },
  });
  return data;
}

export async function getProductDetail(skuId: string): Promise<ProductDetail> {
  const { data } = await api.get<ProductDetail>(`/products/${skuId}`);
  return data;
}

export async function getProductCompetitorComparison(skuId: string): Promise<PriceComparison> {
  const { data } = await api.get<PriceComparison>(`/products/${skuId}/competitor-prices`);
  return data;
}

export async function enhanceProductTitle(skuId: string): Promise<ProductListItem> {
  const { data } = await api.post<ProductListItem>(`/products/${skuId}/enhance-title`);
  return data;
}

export async function refreshCompetitorPrices(skuId?: string): Promise<UploadResponse> {
  const formData = new FormData();
  if (skuId) {
    formData.append("sku_id", skuId);
  }
  const { data } = await api.post<UploadResponse>("/competitor-prices/refresh", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export type Job = {
  id: string;
  job_type: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED" | "PARTIALLY_COMPLETED";
  progress: number;
  total_items: number;
  processed_items: number;
  failed_items: number;
  started_at: string;
  completed_at: string | null;
  error_message: string | null;
  result_summary: string | null;
};

export type IssueBreakdownItem = {
  issue_type: string;
  severity: "HIGH" | "MEDIUM" | "LOW";
  count: number;
};

export type QualitySummary = {
  total_products: number;
  high_issue_count: number;
  medium_issue_count: number;
  low_issue_count: number;
  no_issue_count: number;
  avg_quality_score: number;
  missing_image_count: number;
  invalid_price_count: number;
  out_of_stock_count: number;
  total_alerts: number;
  unread_alerts: number;
  issue_breakdown: IssueBreakdownItem[];
};

export async function getQualitySummary(): Promise<QualitySummary> {
  const { data } = await api.get<QualitySummary>("/dashboard/quality-summary");
  return data;
}

export async function getJobs(): Promise<Job[]> {
  const { data } = await api.get<Job[]>("/jobs");
  return data;
}

export async function uploadVideo(file: File, enhanceTitle: boolean): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("enhance_title", String(enhanceTitle));

  const { data } = await api.post<UploadResponse>("/upload-video", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function uploadProductsCsv(file: File, enhanceTitle: boolean): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("enhance_title", String(enhanceTitle));

  const { data } = await api.post<UploadResponse>("/upload-products-csv", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
