import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppLayout from './components/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'
import LogoLoader from './components/LogoLoader'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Production = lazy(() => import('./pages/Production'))
const Products = lazy(() => import('./pages/Products'))
const Reports = lazy(() => import('./pages/Reports'))
const Producers = lazy(() => import('./pages/Producers'))
const Operators = lazy(() => import('./pages/Operators'))
const Settings = lazy(() => import('./pages/Settings'))
const NotFound = lazy(() => import('./pages/NotFound'))

export default function App() {
  return (
    <Suspense fallback={<LogoLoader label="در حال بارگذاری صفحه…" />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/production" element={<Production />} />
          <Route path="/products" element={<Products />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/producers" element={<Producers />} />
          <Route path="/operators" element={<Operators />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  )
}
