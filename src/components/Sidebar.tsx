'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
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
  PlusCircle,
  ScrollText,
  PackageSearch,
  Truck,
  RotateCcw,
  Wallet,
  FileBarChart
} from 'lucide-react'
import { useAuth } from '@/lib/auth'
import { t, ROLE_LABELS } from '@/lib/labels'
import Logo from '@/components/Logo'

interface NavItem {
  href: string
  label: string
  icon: JSX.Element
  adminOnly?: boolean
  exact?: boolean
}

const items: NavItem[] = [
  { href: '/', label: t('dashboard'), icon: <LayoutDashboard size={18} />, exact: true },
  { href: '/orders/new', label: t('new_order'), icon: <PlusCircle size={18} /> },
  { href: '/orders', label: t('orders'), icon: <ScissorsSquare size={18} />, exact: true },
  { href: '/customers', label: t('customers'), icon: <Users size={18} /> },
  { href: '/products', label: t('products'), icon: <PackageSearch size={18} /> },
  { href: '/stock', label: t('stock'), icon: <Boxes size={18} />, exact: true },
  { href: '/suppliers', label: t('suppliers'), icon: <Truck size={18} /> },
  { href: '/returns', label: t('returns'), icon: <RotateCcw size={18} /> },
  { href: '/stock-history', label: 'Stock History', icon: <ScrollText size={18} /> },
  { href: '/sales', label: t('sales_history'), icon: <History size={18} /> },
  { href: '/expenses', label: t('expenses'), icon: <Wallet size={18} /> },
  { href: '/notify', label: t('notify'), icon: <BellRing size={18} /> },
  { href: '/reports', label: t('reports'), icon: <FileBarChart size={18} /> },
  { href: '/analytics', label: t('analytics'), icon: <BarChart3 size={18} />, adminOnly: true },
  { href: '/staff', label: t('staff'), icon: <UserCog size={18} />, adminOnly: true }
]

export default function Sidebar(): JSX.Element {
  const { user, isAdmin, logout } = useAuth()
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = async (): Promise<void> => {
    await logout()
    router.push('/')
  }

  const isActive = (item: NavItem): boolean =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href)

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-gray-900 text-gray-200 no-print">
      <div className="border-b border-white/10 p-3">
        <div className="flex items-center justify-center rounded-lg bg-white p-2">
          <Logo className="block max-h-16 w-auto max-w-full" />
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {items
          .filter((i) => !i.adminOnly || isAdmin)
          .map((i) => (
            <Link
              key={i.href}
              href={i.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                isActive(i) ? 'bg-brand-600 text-white' : 'text-gray-300 hover:bg-white/10'
              }`}
            >
              {i.icon}
              {i.label}
            </Link>
          ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        <div className="mb-2 px-2">
          <div className="text-sm font-medium text-white">{user?.name}</div>
          <div className="text-[11px] text-gray-400">{user ? ROLE_LABELS[user.role] : ''}</div>
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
  )
}
