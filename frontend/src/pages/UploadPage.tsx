import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { uploadProductsCsv, uploadVideo } from "@/lib/api";

type LastJob = {
  source: "video" | "csv";
  jobId: string;
  message: string;
  status: string;
};

function getErrorMessage(error: unknown): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const maybeResponse = error as { response?: { data?: { detail?: string } } };
    if (maybeResponse.response?.data?.detail) {
      return maybeResponse.response.data.detail;
    }
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Upload failed. Please try again.";
}

export default function UploadPage() {
  const [enhanceTitle, setEnhanceTitle] = useState<boolean>(true);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [lastJob, setLastJob] = useState<LastJob | null>(null);
  const [pageError, setPageError] = useState<string>("");

  const videoUploadMutation = useMutation({
    mutationFn: () => {
      if (!videoFile) {
        throw new Error("Please choose a video file first.");
      }
      return uploadVideo(videoFile, enhanceTitle);
    },
    onSuccess: (res) => {
      setPageError("");
      setLastJob({ source: "video", jobId: res.job_id, message: res.message, status: res.status });
    },
    onError: (err) => setPageError(getErrorMessage(err)),
  });

  const csvUploadMutation = useMutation({
    mutationFn: () => {
      if (!csvFile) {
        throw new Error("Please choose a CSV file first.");
      }
      return uploadProductsCsv(csvFile, enhanceTitle);
    },
    onSuccess: (res) => {
      setPageError("");
      setLastJob({ source: "csv", jobId: res.job_id, message: res.message, status: res.status });
    },
    onError: (err) => setPageError(getErrorMessage(err)),
  });

  const isSubmitting = videoUploadMutation.isPending || csvUploadMutation.isPending;

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900">Upload Inputs</h2>
        <p className="mt-1 text-slate-600">
          Start with product video upload. If extraction is incomplete, upload product CSV as fallback.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <label className="inline-flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={enhanceTitle}
            onChange={(e) => setEnhanceTitle(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-500"
          />
          <span className="text-sm font-medium text-slate-700">Enhance product title</span>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">Primary: Product Video</h3>
          <p className="mt-1 text-sm text-slate-600">Accepted formats: mp4, mov, avi, mkv, webm</p>

          <div className="mt-4 space-y-3">
            <input
              type="file"
              accept="video/*,.mp4,.mov,.avi,.mkv,.webm"
              onChange={(e) => setVideoFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />
            {videoFile ? <p className="text-xs text-slate-500">Selected: {videoFile.name}</p> : null}
            <button
              type="button"
              disabled={isSubmitting || !videoFile}
              onClick={() => videoUploadMutation.mutate()}
              className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {videoUploadMutation.isPending ? "Uploading video..." : "Upload Video"}
            </button>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-xl font-bold text-slate-900">Fallback: Product CSV</h3>
          <p className="mt-1 text-sm text-slate-600">Use this if video extraction is incomplete.</p>

          <div className="mt-4 space-y-3">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
              className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
            />
            {csvFile ? <p className="text-xs text-slate-500">Selected: {csvFile.name}</p> : null}
            <button
              type="button"
              disabled={isSubmitting || !csvFile}
              onClick={() => csvUploadMutation.mutate()}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {csvUploadMutation.isPending ? "Uploading CSV..." : "Upload CSV"}
            </button>
          </div>
        </article>
      </div>

      {pageError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{pageError}</div>
      ) : null}

      {lastJob ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <p className="font-semibold">{lastJob.source.toUpperCase()} upload started</p>
          <p className="mt-1">{lastJob.message}</p>
          <p className="mt-1">
            Job ID: <span className="font-mono">{lastJob.jobId}</span> | Status: {lastJob.status}
          </p>
          <Link to="/jobs" className="mt-3 inline-block rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700">
            View Job Progress
          </Link>
        </div>
      ) : null}
    </section>
  );
}
