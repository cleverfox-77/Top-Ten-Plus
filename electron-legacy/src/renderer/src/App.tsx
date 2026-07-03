import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { Spinner } from './components/ui'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import NewOrder from './pages/NewOrder'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Stock from './pages/Stock'
import SalesHistory from './pages/SalesHistory'
import Analytics from './pages/Analytics'
import Notify from './pages/Notify'
import Staff from './pages/Staff'

export default function App(): JSX.Element {
  const { user, loading, isAdmin } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner label="Loading…" />
      </div>
    )
  }

  if (!user) {
    return (
      <Routes>
        <Route path="*" element={<Login />} />
      </Routes>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/orders/new" element={<NewOrder />} />
        <Route path="/orders/:id" element={<OrderDetail />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/stock" element={<Stock />} />
        <Route path="/sales" element={<SalesHistory />} />
        <Route path="/notify" element={<Notify />} />
        <Route path="/analytics" element={isAdmin ? <Analytics /> : <Navigate to="/" />} />
        <Route path="/staff" element={isAdmin ? <Staff /> : <Navigate to="/" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Layout>
  )
}
