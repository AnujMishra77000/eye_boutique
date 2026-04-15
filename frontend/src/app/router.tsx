import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/layouts/AppShell";
import { AuthLayout } from "@/layouts/AuthLayout";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

const AnalyticsPage = lazy(() =>
  import("@/pages/analytics/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage }))
);
const AdminRegisterPage = lazy(() =>
  import("@/pages/auth/AdminRegisterPage").then((module) => ({ default: module.AdminRegisterPage }))
);
const LandingPage = lazy(() => import("@/pages/auth/LandingPage").then((module) => ({ default: module.LandingPage })));
const LoginPage = lazy(() => import("@/pages/auth/LoginPage").then((module) => ({ default: module.LoginPage })));

const BillingPage = lazy(() => import("@/pages/billing/BillingPage").then((module) => ({ default: module.BillingPage })));
const BillingRecordsPage = lazy(() =>
  import("@/pages/billing/BillingRecordsPage").then((module) => ({ default: module.BillingRecordsPage }))
);
const BillingEditPage = lazy(() =>
  import("@/pages/billing/BillingEditPage").then((module) => ({ default: module.BillingEditPage }))
);

const CampaignsPage = lazy(() =>
  import("@/pages/campaigns/CampaignsPage").then((module) => ({ default: module.CampaignsPage }))
);

const CustomersPage = lazy(() =>
  import("@/pages/customers/CustomersPage").then((module) => ({ default: module.CustomersPage }))
);
const CustomerRecordsPage = lazy(() =>
  import("@/pages/customers/CustomerRecordsPage").then((module) => ({ default: module.CustomerRecordsPage }))
);

const DashboardPage = lazy(() =>
  import("@/pages/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);

const PrescriptionsPage = lazy(() =>
  import("@/pages/prescriptions/PrescriptionsPage").then((module) => ({ default: module.PrescriptionsPage }))
);
const PrescriptionsRecordsPage = lazy(() =>
  import("@/pages/prescriptions/PrescriptionsRecordsPage").then((module) => ({ default: module.PrescriptionsRecordsPage }))
);

const StaffManagementPage = lazy(() =>
  import("@/pages/staff/StaffManagementPage").then((module) => ({ default: module.StaffManagementPage }))
);

const VendorsPage = lazy(() => import("@/pages/vendors/VendorsPage").then((module) => ({ default: module.VendorsPage })));

const routeFallback = (
  <div className="rounded-xl border border-pink-300/25 bg-matte-850/90 px-4 py-6 text-sm text-slate-200 shadow-neon-ring">
    Loading module...
  </div>
);

function renderLazyPage(element: ReactNode) {
  return <Suspense fallback={routeFallback}>{element}</Suspense>;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={renderLazyPage(<LandingPage />)} />

      <Route element={<AuthLayout />}>
        <Route path="/login" element={<Navigate to="/login/admin" replace />} />
        <Route path="/login/admin" element={renderLazyPage(<LoginPage mode="admin" />)} />
        <Route path="/login/staff" element={renderLazyPage(<LoginPage mode="staff" />)} />
        <Route path="/admin-register" element={renderLazyPage(<AdminRegisterPage />)} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={renderLazyPage(<DashboardPage />)} />

        <Route path="/customers" element={renderLazyPage(<CustomersPage />)} />
        <Route path="/customers/records" element={renderLazyPage(<CustomerRecordsPage />)} />

        <Route path="/prescriptions" element={renderLazyPage(<PrescriptionsPage />)} />
        <Route path="/prescriptions/records" element={renderLazyPage(<PrescriptionsRecordsPage />)} />

        <Route path="/vendors" element={renderLazyPage(<VendorsPage />)} />

        <Route path="/billing" element={renderLazyPage(<BillingPage />)} />
        <Route path="/billing/records" element={renderLazyPage(<BillingRecordsPage />)} />
        <Route
          path="/billing/edit/:billId"
          element={<ProtectedRoute allowedRoles={["admin"]}>{renderLazyPage(<BillingEditPage />)}</ProtectedRoute>}
        />

        <Route path="/campaigns" element={renderLazyPage(<CampaignsPage />)} />

        <Route
          path="/analytics"
          element={<ProtectedRoute allowedRoles={["admin"]}>{renderLazyPage(<AnalyticsPage />)}</ProtectedRoute>}
        />
        <Route
          path="/staff-management"
          element={<ProtectedRoute allowedRoles={["admin"]}>{renderLazyPage(<StaffManagementPage />)}</ProtectedRoute>}
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
