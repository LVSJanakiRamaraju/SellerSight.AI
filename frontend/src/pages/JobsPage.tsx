import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getJobs, type Job } from "@/lib/api";

function statusBadgeClasses(status: Job["status"]): string {
  if (status === "COMPLETED") return "bg-emerald-100 text-emerald-800";
  if (status === "FAILED") return "bg-rose-100 text-rose-800";
  if (status === "PARTIALLY_COMPLETED") return "bg-amber-100 text-amber-900";
  if (status === "RUNNING") return "bg-blue-100 text-blue-800";
  return "bg-slate-100 text-slate-700";
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function JobsPage() {
  const jobsQuery = useQuery({
    queryKey: ["jobs"],
    queryFn: getJobs,
    refetchInterval: (query) => {
      const jobs = (query.state.data as Job[] | undefined) ?? [];
      const shouldPoll = jobs.some((j) => j.status === "RUNNING" || j.status === "PENDING");
      return shouldPoll ? 2000 : 10000;
    },
  });

  const jobs = jobsQuery.data ?? [];

  const summary = useMemo(() => {
    const total = jobs.length;
    const running = jobs.filter((j) => j.status === "RUNNING").length;
    const pending = jobs.filter((j) => j.status === "PENDING").length;
    const completed = jobs.filter((j) => j.status === "COMPLETED").length;
    const failed = jobs.filter((j) => j.status === "FAILED").length;
    return { total, running, pending, completed, failed };
  }, [jobs]);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-3xl font-extrabold text-slate-900">Jobs</h2>
        <p className="mt-1 text-slate-600">
          Track background processing for video extraction, CSV import, and competitor price refresh.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-3">
          <p className="text-xs text-slate-500">Total</p>
          <p className="text-2xl font-extrabold text-slate-900">{summary.total}</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-700">Running</p>
          <p className="text-2xl font-extrabold text-blue-900">{summary.running}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs text-slate-600">Pending</p>
          <p className="text-2xl font-extrabold text-slate-900">{summary.pending}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-xs text-emerald-700">Completed</p>
          <p className="text-2xl font-extrabold text-emerald-900">{summary.completed}</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="text-xs text-rose-700">Failed</p>
          <p className="text-2xl font-extrabold text-rose-900">{summary.failed}</p>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-lg font-bold text-slate-900">Recent Jobs</h3>
        </div>

        {jobsQuery.isLoading ? <p className="px-4 py-6 text-sm text-slate-500">Loading jobs...</p> : null}

        {jobsQuery.isError ? (
          <p className="px-4 py-6 text-sm text-rose-600">Failed to load jobs. Please check backend connectivity.</p>
        ) : null}

        {!jobsQuery.isLoading && !jobsQuery.isError && jobs.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500">No jobs found yet. Upload video or CSV to start processing.</p>
        ) : null}

        {jobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Started</th>
                  <th className="px-4 py-3">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-semibold text-slate-900">{job.job_type.replace(/_/g, " ")}</p>
                      <p className="font-mono text-xs text-slate-500">{job.id}</p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeClasses(job.status)}`}>
                        {job.status}
                      </span>
                      {job.error_message ? <p className="mt-1 max-w-xs text-xs text-rose-600">{job.error_message}</p> : null}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="w-44">
                        <div className="h-2.5 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full bg-brand-500" style={{ width: `${Math.max(0, Math.min(100, job.progress))}%` }} />
                        </div>
                        <p className="mt-1 text-xs text-slate-600">{job.progress}%</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-slate-700">
                      <p>{job.processed_items}/{job.total_items}</p>
                      {job.failed_items > 0 ? <p className="text-xs text-rose-600">failed: {job.failed_items}</p> : null}
                    </td>
                    <td className="px-4 py-3 align-top text-slate-600">{formatDateTime(job.started_at)}</td>
                    <td className="px-4 py-3 align-top text-slate-600">{formatDateTime(job.completed_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </section>
  );
}
