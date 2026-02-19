import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import AppShell from '@/components/layout/AppShell'
import ProtectedRoute from '@/components/auth/ProtectedRoute'
import LoginPage from '@/pages/LoginPage'
import DashboardPage from '@/pages/DashboardPage'
import ConnectionsPage from '@/pages/ConnectionsPage'
import WorkflowsPage from '@/pages/WorkflowsPage'
import WorkflowEditorPage from '@/pages/WorkflowEditorPage'
import ExecutionsPage from '@/pages/ExecutionsPage'
import OrchestrationsPage from '@/pages/OrchestrationsPage'
import SchedulesPage from '@/pages/SchedulesPage'
import SettingsPage from '@/pages/SettingsPage'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      retry: 1,
    },
  },
})

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'connections', element: <ConnectionsPage /> },
      { path: 'workflows', element: <WorkflowsPage /> },
      { path: 'workflows/:id', element: <WorkflowEditorPage /> },
      { path: 'executions', element: <ExecutionsPage /> },
      { path: 'schedules', element: <SchedulesPage /> },
      { path: 'orchestrations', element: <OrchestrationsPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: 'var(--toast-bg)',
            border: '1px solid var(--toast-border)',
            color: 'var(--toast-color)',
          },
        }}
      />
    </QueryClientProvider>
  )
}
