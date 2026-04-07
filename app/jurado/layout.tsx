import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ClipboardList, Upload, LogOut } from 'lucide-react'

export default async function JuradoLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role').eq('id', user.id).single()

  if (!profile || !['jurado', 'admin'].includes(profile.role)) redirect('/')

  const NAV = [
    { href: '/jurado',          label: 'Carga de resultados', icon: <Upload size={16} />        },
    { href: '/jurado/historial', label: 'Historial',          icon: <ClipboardList size={16} /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-green-700 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">A</span>
              </div>
            </Link>
            <span className="text-xs text-gray-300">|</span>
            <span className="text-sm font-medium text-gray-700">Portal Jurado</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>{profile.full_name}</span>
            <Link href="/" className="btn-ghost text-gray-400 text-sm">
              <LogOut size={14} />
            </Link>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Portal de Jurado</h1>
          <p className="text-sm text-gray-400">Carga y gestión de resultados de competencias</p>
        </div>

        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium
                         text-gray-600 hover:text-gray-900 hover:bg-white transition-all">
              {n.icon} {n.label}
            </Link>
          ))}
        </div>

        {children}
      </div>
    </div>
  )
}
