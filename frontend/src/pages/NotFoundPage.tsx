import { Link } from "react-router-dom";

export default function NotFoundPage() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <h2 className="text-4xl font-extrabold text-slate-900">404</h2>
      <p className="max-w-md text-slate-600">This route does not exist in SellerSight.AI.</p>
      <Link to="/" className="rounded-xl bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
        Back to Dashboard
      </Link>
    </section>
  );
}
