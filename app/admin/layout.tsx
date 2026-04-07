import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard, Trophy, Newspaper, Users,
  TrendingUp, Settings, LogOut, ChevronRight
} from 'lucide-react'

const NAV = [
  { href: '/admin',          label: 'Dashboard',   icon: LayoutDashboard },
  { href: '/admin/concursos', label: 'Concursos',  icon: Trophy          },
  { href: '/admin/ranking',   label: 'Ranking',    icon: TrendingUp      },
  { href: '/admin/noticias',  label: 'Noticias',   icon: Newspaper       },
  { href: '/admin/usuarios',  label: 'Usuarios',   icon: Users           },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/')

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 z-30">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-100">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 leading-none">ADESCRUZ</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Super Admin</p>
            </div>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-gray-600
                         hover:text-gray-900 hover:bg-gray-50 transition-colors group">
              <Icon size={16} className="text-gray-400 group-hover:text-green-600 transition-colors" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-gray-100">
          <div className="px-3 py-2 mb-1">
            <p className="text-xs font-medium text-gray-700 truncate">{profile.full_name}</p>
            <p className="text-[10px] text-gray-400">Administrador</p>
          </div>
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-gray-400
                                     hover:text-red-500 hover:bg-red-50 transition-colors">
            <LogOut size={14} /> Salir
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 ml-56 min-h-screen">
        {children}
      </main>
    </div>
  )
}
