import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Trophy, Calendar, ChevronRight, TrendingUp, Users, Award } from 'lucide-react'
import type { Concurso, Noticia, RankingEntry } from '@/types'

export const revalidate = 300 // revalidate every 5 min

async function getHomeData() {
  const supabase = createClient()

  const [concursosRes, noticiasRes, rankingRes] = await Promise.all([
    supabase
      .from('concursos')
      .select('*')
      .order('fecha_inicio', { ascending: true })
      .limit(3),
    supabase
      .from('noticias')
      .select('id, titulo, imagen_url, fecha_publicacion')
      .eq('publicado', true)
      .order('fecha_publicacion', { ascending: false })
      .limit(3),
    supabase
      .from('ranking')
      .select('*, jinete:jinetes(full_name), caballo:caballos(nombre), categoria:categorias(nombre, altura_cm)')
      .eq('temporada', new Date().getFullYear())
      .order('puntos_total', { ascending: false })
      .limit(6),
  ])

  return {
    concursos: concursosRes.data as Concurso[] ?? [],
    noticias:  noticiasRes.data ?? [],
    ranking:   rankingRes.data as RankingEntry[] ?? [],
  }
}

function estadoBadge(estado: string) {
  const map: Record<string, { label: string; cls: string }> = {
    upcoming:  { label: 'Próximo',     cls: 'badge-gray'  },
    active:    { label: 'En curso',    cls: 'badge-green' },
    completed: { label: 'Finalizado',  cls: 'badge-gray'  },
  }
  const { label, cls } = map[estado] ?? { label: estado, cls: 'badge-gray' }
  return <span className={cls + ' badge'}>{label}</span>
}

export default async function HomePage() {
  const { concursos, noticias, ranking } = await getHomeData()
  const year = new Date().getFullYear()

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative overflow-hidden bg-green-700">
        <div className="absolute inset-0 bg-[url('/images/hero-bg.jpg')] bg-cover bg-center opacity-10" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="max-w-2xl">
            <p className="text-green-300 text-sm font-medium tracking-wide uppercase mb-4">
              Salto Ecuestre · Santa Cruz, Bolivia
            </p>
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight text-balance mb-6">
              Asociación de Deportes Ecuestres de Santa Cruz
            </h1>
            <p className="text-green-100 text-lg leading-relaxed mb-8">
              Resultados, ranking oficial y calendario de competencias del
              Campeonato Departamental de Salto {year}.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link href="/ranking" className="btn-primary bg-white text-green-700 hover:bg-green-50">
                Ver ranking {year}
              </Link>
              <Link href="/cds" className="btn-secondary bg-white/10 text-white border-white/20
                                            hover:bg-white/20">
                Resultados CDS
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats ── */}
      <section className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-3 gap-6 text-center">
            {[
              { icon: <Users size={20} className="text-green-600" />, label: 'Jinetes activos', value: '120+' },
              { icon: <Trophy size={20} className="text-green-600" />, label: 'Categorías', value: '17'  },
              { icon: <Award size={20} className="text-green-600" />, label: `CDS ${year}`, value: concursos.length.toString() },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center gap-2">
                {s.icon}
                <span className="text-2xl font-bold text-gray-900">{s.value}</span>
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Próximos CDS ── */}
      <section className="section">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Competencias {year}</h2>
            <p className="text-gray-500 text-sm mt-1">Calendario de CDS de la temporada</p>
          </div>
          <Link href="/cds" className="btn-ghost text-green-700">
            Ver todos <ChevronRight size={16} />
          </Link>
        </div>

        {concursos.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay competencias programadas.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {concursos.map(c => (
              <Link key={c.id} href={`/cds/${c.id}`}
                className="card p-5 hover:shadow-md hover:border-green-100 transition-all group">
                <div className="flex items-start justify-between mb-3">
                  {estadoBadge(c.estado)}
                  <span className="text-xs text-gray-400">CDS #{c.numero}</span>
                </div>
                <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors mb-1">
                  {c.nombre}
                </h3>
                <p className="text-sm text-gray-500 mb-3">{c.lugar}</p>
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <Calendar size={13} />
                  {new Date(c.fecha_inicio).toLocaleDateString('es-BO', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ── Top Ranking ── */}
      <section className="bg-gray-50 border-y border-gray-100">
        <div className="section">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Ranking Destacado</h2>
              <p className="text-gray-500 text-sm mt-1">Líderes de la temporada {year}</p>
            </div>
            <Link href="/ranking" className="btn-ghost text-green-700">
              Ranking completo <ChevronRight size={16} />
            </Link>
          </div>

          {ranking.length === 0 ? (
            <p className="text-gray-400 text-sm">El ranking aún no tiene datos para esta temporada.</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {ranking.map((entry, i) => (
                <div key={entry.id} className="card p-4 flex items-center gap-4">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                    i === 0 ? 'bg-yellow-50 text-yellow-600' :
                    i === 1 ? 'bg-gray-100 text-gray-500' :
                    i === 2 ? 'bg-orange-50 text-orange-500' :
                    'bg-gray-50 text-gray-400'
                  }`}>
                    {entry.posicion ?? i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate text-sm">
                      {(entry.jinete as any)?.full_name ?? '—'}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {(entry.caballo as any)?.nombre} · {(entry.categoria as any)?.nombre}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <TrendingUp size={13} className="text-green-500" />
                    <span className="text-sm font-semibold text-green-700">{entry.puntos_total}pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Noticias ── */}
      {noticias.length > 0 && (
        <section className="section">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Noticias</h2>
            <Link href="/noticias" className="btn-ghost text-green-700">
              Ver todas <ChevronRight size={16} />
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {noticias.map((n: any) => (
              <Link key={n.id} href={`/noticias/${n.id}`}
                className="card overflow-hidden hover:shadow-md transition-all group">
                <div className="h-40 bg-gray-100 overflow-hidden">
                  {n.imagen_url ? (
                    <img src={n.imagen_url} alt={n.titulo}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Trophy size={28} className="text-gray-200" />
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-1">
                    {new Date(n.fecha_publicacion).toLocaleDateString('es-BO', {
                      day: 'numeric', month: 'long',
                    })}
                  </p>
                  <h3 className="font-semibold text-gray-900 leading-snug group-hover:text-green-700 transition-colors">
                    {n.titulo}
                  </h3>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  )
}
