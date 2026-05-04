import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "./components/AppShell";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminPage } from "./pages/AdminPage";
import { DashboardPage } from "./pages/DashboardPage";
import { LegalizationPage } from "./pages/LegalizationPage";
import { LoginPage } from "./pages/LoginPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { ScanPage } from "./pages/ScanPage";
import { SupplyPage } from "./pages/SupplyPage";
import { supplyModuleRoles } from "./utils/access";

const queryClient = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/legalizacion" element={<LegalizationPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute allowedRoles={supplyModuleRoles} />}>
            <Route element={<AppShell />}>
              <Route path="/abastecimiento" element={<SupplyPage />} />
            </Route>
          </Route>
          <Route element={<ProtectedRoute allowedRoles={["SuperAdmin"]} />}>
            <Route element={<AppShell />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
          <Route path="/404" element={<NotFoundPage />} />
          <Route path="*" element={<Navigate to="/404" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
