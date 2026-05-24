import { Navigate, Route, Routes } from "react-router-dom";

import AppLayout from "./components/AppLayout";
import AlertsPage from "./pages/AlertsPage";
import DashboardPage from "./pages/DashboardPage";
import JobsPage from "./pages/JobsPage";
import NotFoundPage from "./pages/NotFoundPage";
import ProductDetailPage from "./pages/ProductDetailPage";
import ProductsPage from "./pages/ProductsPage";
import UploadPage from "./pages/UploadPage";

function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/upload" element={<UploadPage />} />
        <Route path="/jobs" element={<JobsPage />} />
        <Route path="/products" element={<ProductsPage />} />
        <Route path="/products/:skuId" element={<ProductDetailPage />} />
        <Route path="/alerts" element={<AlertsPage />} />
        <Route path="/home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AppLayout>
  );
}

export default App;
