import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Trophy, Users, TrendingUp, Newspaper, ChevronRight, AlertCircle } from 'lucide-react'

export const revalidate = 60

export default async function AdminDashboard() {
  const supabase = createClient()
  const year = new Date().getFullYear()

  const [concursosRes, usuariosRes, jineteRes, rankingRes, pendingRes] = await Promise.all([
    supabase.from('concursos').select('id, nombre, estado, numero').eq('temporada', year).order('numero'),
    supabase.from('profiles').select('id, role', { count: 'exact' }),
    supabase.from('jinetes').select('id', { count: 'exact' }).eq('active', true),
    supabase.from('ranking').select('id', { count: 'exact' }).eq('temporada', year),
    supabase.from('pruebas').select('id', { count: 'exact' }).eq('estado', 'pending'),
  ])

  const stats = [
    {
      label: 'CDS este año',
      value: concursosRes.data?.length ?? 0,
      icon: <Trophy size={18} className="text-green-600" />,
      href: '/admin/concursos',
    },
    {
      label: 'Jinetes activos',
      value: jineteRes.count ?? 0,
      icon: <Users size={18} className="text-blue-500" />,
      href: '/admin/usuarios',
    },
    {
      label: 'Entradas ranking',
      value: rankingRes.count ?? 0,
      icon: <TrendingUp size={18} className="text-purple-500" />,
      href: '/admin/ranking',
    },
    {
      label: 'Pruebas pendientes',
      value: pendingRes.count ?? 0,
      icon: <AlertCircle size={18} className="text-amber-500" />,
      href: '/admin/concursos',
    },
  ]

  const concursos = concursosRes.data ?? []

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-400 text-sm mt-1">Temporada {year}</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {stats.map((s, i) => (
          <Link key={i} href={s.href}
            className="card p-5 hover:shadow-md hover:border-gray-200 transition-all group">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-xl bg-gray-50 flex items-center justify-center">
                {s.icon}
              </div>
              <ChevronRight size={14} className="text-gray-200 group-hover:text-gray-400 transition-colors" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* CDS this season */}
      <div className="card overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">CDS {year}</h2>
          <Link href="/admin/concursos" className="text-xs text-green-700 hover:underline">
            Gestionar
          </Link>
        </div>
        {concursos.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-400 text-sm">
            No hay CDS registrados para {year}.{' '}
            <Link href="/admin/concursos" className="text-green-700 hover:underline">Crear uno</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                <th className="text-left px-6 py-3">#</th>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {concursos.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-gray-400 text-xs font-medium">CDS {c.numero}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{c.nombre}</td>
                  <td className="px-4 py-3">
                    <span className={`badge ${
                      c.estado === 'active' ? 'badge-green' :
                      c.estado === 'upcoming' ? 'badge-gray' :
                      'bg-gray-50 text-gray-400 badge'
                    }`}>
                      {c.estado === 'active' ? 'En curso' : c.estado === 'upcoming' ? 'Próximo' : 'Finalizado'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/admin/concursos/${c.id}`}
                      className="text-xs text-green-700 hover:underline">
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: '/admin/concursos/nuevo', label: 'Nuevo CDS',     icon: <Trophy size={15} />   },
          { href: '/admin/noticias/nueva',  label: 'Nueva noticia', icon: <Newspaper size={15} /> },
          { href: '/admin/usuarios',         label: 'Ver usuarios',  icon: <Users size={15} />    },
          { href: '/admin/ranking',          label: 'Ver ranking',   icon: <TrendingUp size={15} />},
        ].map((a, i) => (
          <Link key={i} href={a.href}
            className="card p-4 hover:shadow-sm hover:border-green-100 transition-all flex items-center gap-2.5 text-sm font-medium text-gray-700">
            <div className="text-green-600">{a.icon}</div>
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  )
}
