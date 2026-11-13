import type { RouteObject } from 'react-router-dom'

import { AppLayout } from '../components/AppLayout'
import { ProtectedRoute } from '../features/auth/ProtectedRoute'
import { PublicOnlyRoute } from '../features/auth/PublicOnlyRoute'
import { AddMedicationPage } from '../pages/AddMedicationPage'
import { AboutPage } from '../pages/AboutPage'
import { AuthCallbackPage } from '../pages/AuthCallbackPage'
import { CalendarPage } from '../pages/CalendarPage'
import { ConfirmIntakePage } from '../pages/ConfirmIntakePage'
import { HistoryPage } from '../pages/HistoryPage'
import { HomePage } from '../pages/HomePage'
import { MedicationsPage } from '../pages/MedicationsPage'
import { MedicationDetailPage } from '../pages/MedicationDetailPage'
import { NotFoundPage } from '../pages/NotFoundPage'
import { SettingsPage } from '../pages/SettingsPage'
import { TodayPage } from '../pages/TodayPage'

export const appRoutes: RouteObject[] = [
  {
    element: <PublicOnlyRoute />,
    children: [
      {
        path: '/',
        element: <HomePage />,
      },
    ],
  },
  {
    path: 'auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            path: 'hoy',
            element: <TodayPage />,
          },
          {
            path: 'medicamentos',
            element: <MedicationsPage />,
          },
          {
            path: 'medicamentos/agregar',
            element: <AddMedicationPage />,
          },
          {
            path: 'medicamentos/:medicationId',
            element: <MedicationDetailPage />,
          },
          {
            path: 'medicamentos/:medicationId/editar',
            element: <AddMedicationPage />,
          },
          {
            path: 'calendario',
            element: <CalendarPage />,
          },
          {
            path: 'tomas/:intakeId/confirmar',
            element: <ConfirmIntakePage />,
          },
          {
            path: 'historial',
            element: <HistoryPage />,
          },
          {
            path: 'configuracion',
            element: <SettingsPage />,
          },
          {
            path: 'acerca-de-tuga',
            element: <AboutPage />,
          },
          {
            path: '*',
            element: <NotFoundPage />,
          },
        ],
      },
    ],
  },
]
