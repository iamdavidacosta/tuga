import { Navigate, Outlet } from 'react-router-dom'

import { AuthLoadingScreen } from './AuthLoadingScreen'
import { useAuth } from './authContext'

export function PublicOnlyRoute() {
  const { session, isLoading } = useAuth()

  if (isLoading) {
    return <AuthLoadingScreen />
  }

  return session ? <Navigate replace to="/hoy" /> : <Outlet />
}
