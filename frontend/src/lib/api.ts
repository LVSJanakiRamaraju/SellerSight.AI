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
