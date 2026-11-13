import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { AuthLoadingScreen } from './AuthLoadingScreen'
import { useAuth } from './authContext'

export function ProtectedRoute() {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  if (!session) {
    return <Navigate replace state={{ from: location.pathname }} to="/" />
  }

  return <Outlet />
}
