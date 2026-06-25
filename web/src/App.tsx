import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./lib/auth";
import AppLayout from "./layouts/AppLayout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Servers from "./pages/Servers";
import ServerNew from "./pages/ServerNew";
import ServerDetail from "./pages/ServerDetail";
import SiteNew from "./pages/SiteNew";
import SiteDetail from "./pages/SiteDetail";
import ActivityLog from "./pages/ActivityLog";
import Profile from "./pages/Profile";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
});

function ProtectedRoute() {
  const { isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  return <Outlet />;
}

const router = createBrowserRouter([
  { path: "/login", element: <Login /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: "/", element: <Dashboard /> },
          { path: "/servers", element: <Servers /> },
          { path: "/servers/new", element: <ServerNew /> },
          { path: "/servers/:id", element: <ServerDetail /> },
          { path: "/servers/:id/sites/new", element: <SiteNew /> },
          { path: "/servers/:id/sites/:siteId", element: <SiteDetail /> },
          { path: "/activity", element: <ActivityLog /> },
          { path: "/profile", element: <Profile /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  );
}
