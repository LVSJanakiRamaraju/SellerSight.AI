import { useParams } from "react-router-dom";

export default function ProductDetailPage() {
  const { skuId } = useParams();

  return (
    <section className="space-y-4">
      <h2 className="text-3xl font-extrabold text-slate-900">Product Detail</h2>
      <p className="text-slate-600">SKU: {skuId}</p>
      <p className="text-slate-600">Detailed product view with issues, enhanced title, and competitor prices will be built next.</p>
    </section>
  );
}
