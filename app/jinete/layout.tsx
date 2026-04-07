import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { User, Star, TrendingUp, LogOut } from 'lucide-react'

export default async function JineteLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, role')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role !== 'jinete') redirect('/')

  const NAV = [
    { href: '/jinete',          label: 'Mi perfil',   icon: <User size={17} />       },
    { href: '/jinete/caballos', label: 'Mis caballos', icon: <Star size={17} />      },
    { href: '/jinete/ranking',  label: 'Mi ranking',   icon: <TrendingUp size={17} /> },
  ]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-md bg-green-700 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">A</span>
              </div>
            </Link>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-sm font-medium text-gray-700">Panel Jinete</span>
          </div>
          <form action="/auth/signout" method="post">
            <Link href="/" className="btn-ghost text-sm text-gray-500">
              <LogOut size={15} /> Salir
            </Link>
          </form>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Welcome */}
        <div className="mb-6">
          <h1 className="text-xl font-bold text-gray-900">Hola, {profile.full_name.split(' ')[0]}</h1>
          <p className="text-sm text-gray-400">Bienvenido a tu panel personal</p>
        </div>

        {/* Nav tabs */}
        <div className="flex gap-1 mb-6 bg-gray-100 rounded-xl p-1 w-fit">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600
                         hover:text-gray-900 hover:bg-white transition-all">
              {n.icon}
              {n.label}
            </Link>
          ))}
        </div>

        {children}
      </div>
    </div>
  )
}
