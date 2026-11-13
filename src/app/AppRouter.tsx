import { createBrowserRouter, RouterProvider } from 'react-router-dom'

import { AuthProvider } from '../features/auth/AuthProvider'
import { appRoutes } from './routes'

const router = createBrowserRouter(appRoutes)

export function AppRouter() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
