import type { RouteObject } from 'react-router';

import { lazy, Suspense } from 'react';
import { Navigate } from 'react-router';

import { SplashScreen } from 'src/components/loading-screen';

import { dashboardRoutes } from './dashboard';

// ----------------------------------------------------------------------

const Page404 = lazy(() => import('src/pages/error/404'));
const AdminLoginPage = lazy(() => import('src/pages/admin-login'));
const PortalPage = lazy(() => import('src/pages/portal'));

export const routesSection: RouteObject[] = [
  {
    path: '/admin-login',
    element: (
      <Suspense fallback={<SplashScreen />}>
        <AdminLoginPage />
      </Suspense>
    ),
  },
  {
    path: '/portal',
    element: (
      <Suspense fallback={<SplashScreen />}>
        <PortalPage />
      </Suspense>
    ),
  },
  { path: '/', element: <Navigate to="/admin-login" replace /> },

  // Dashboard
  ...dashboardRoutes,

  // No match
  { path: '*', element: <Page404 /> },
];
