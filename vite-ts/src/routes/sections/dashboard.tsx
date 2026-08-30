import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { Outlet, Navigate } from 'react-router';

import { getToken } from 'src/lib/creche-api';
import { DashboardLayout } from 'src/layouts/dashboard';

import { LoadingScreen } from 'src/components/loading-screen';

import { usePathname } from '../hooks';

// ----------------------------------------------------------------------

// Creche (Inscrição e Classificação)
const CrecheUnidadesListPage = lazy(() => import('src/pages/dashboard/creche/unidades-list'));
const CrecheUnidadeDetailPage = lazy(() => import('src/pages/dashboard/creche/unidade-detail'));
const CrechePainelPage = lazy(() => import('src/pages/dashboard/creche/painel'));

// ----------------------------------------------------------------------

function SuspenseOutlet() {
  const pathname = usePathname();
  return (
    <Suspense key={pathname} fallback={<LoadingScreen />}>
      <Outlet />
    </Suspense>
  );
}

function AdminGuard({ children }: { children: React.ReactNode }) {
  if (!getToken('admin')) {
    return <Navigate to="/admin-login" replace />;
  }
  return <>{children}</>;
}

const dashboardLayout = () => (
  <AdminGuard>
    <DashboardLayout>
      <SuspenseOutlet />
    </DashboardLayout>
  </AdminGuard>
);

export const dashboardRoutes: RouteObject[] = [
  {
    path: 'dashboard',
    element: dashboardLayout(),
    children: [
      { index: true, element: <Navigate to="/dashboard/creche/unidades" replace /> },
      {
        path: 'creche',
        children: [
          { index: true, element: <CrecheUnidadesListPage /> },
          { path: 'unidades', element: <CrecheUnidadesListPage /> },
          { path: 'unidades/:id', element: <CrecheUnidadeDetailPage /> },
          { path: 'painel', element: <CrechePainelPage /> },
        ],
      },
    ],
  },
];
