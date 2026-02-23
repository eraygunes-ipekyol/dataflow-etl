import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import ForceChangePasswordDialog from './ForceChangePasswordDialog'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const mustChangePassword = useAuthStore((s) => s.mustChangePassword)

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <>
      {mustChangePassword && <ForceChangePasswordDialog />}
      {children}
    </>
  )
}
