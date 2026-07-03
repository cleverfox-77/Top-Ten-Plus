import { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  ScissorsSquare,
  Users,
  Boxes,
  History,
  BarChart3,
  BellRing,
  UserCog,
  LogOut,
  PlusCircle
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { t, ROLE_LABELS } from '@shared/labels'

interface NavItem {
  to: string
  label: string
  icon: JSX.Element
  adminOnly?: boolean
  end?: boolean
}

const items: NavItem[] = [
  { to: '/', label: t('dashboard'), icon: <LayoutDashboard size={18} />, end: true },
  { to: '/orders/new', label: t('new_order'), icon: <PlusCircle size={18} /> },
  { to: '/orders', label: t('orders'), icon: <ScissorsSquare size={18} />, end: true },
  { to: '/customers', label: t('customers'), icon: <Users size={18} /> },
  { to: '/stock', label: t('stock'), icon: <Boxes size={18} /> },
  { to: '/sales', label: t('sales_history'), icon: <History size={18} /> },
  { to: '/notify', label: t('notify'), icon: <BellRing size={18} /> },
  { to: '/analytics', label: t('analytics'), icon: <BarChart3 size={18} />, adminOnly: true },
  { to: '/staff', label: t('staff'), icon: <UserCog size={18} />, adminOnly: true }
]

export default function Layout({ children }: { children: ReactNode }): JSX.Element {
  const { user, isAdmin, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async (): Promise<void> => {
    await logout()
    navigate('/')
  }

  return (
    <div className="flex h-full">
      <aside className="flex w-60 shrink-0 flex-col bg-gray-900 text-gray-200 no-print">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 font-bold text-white">
            T
          </div>
          <div>
            <div className="font-bold leading-tight">Top Ten Plus</div>
            <div className="text-[11px] text-gray-400">Tailors • Fabrics • Fashion</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto p-3">
          {items
            .filter((i) => !i.adminOnly || isAdmin)
            .map((i) => (
              <NavLink
                key={i.to}
                to={i.to}
                end={i.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                    isActive ? 'bg-brand-600 text-white' : 'text-gray-300 hover:bg-white/10'
                  }`
                }
              >
                {i.icon}
                {i.label}
              </NavLink>
            ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <div className="mb-2 px-2">
            <div className="text-sm font-medium text-white">{user?.name}</div>
            <div className="text-[11px] text-gray-400">
              {user ? ROLE_LABELS[user.role] : ''}
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-300 hover:bg-white/10"
          >
            <LogOut size={18} />
            {t('logout')}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl p-6">{children}</div>
      </main>
    </div>
  )
}
