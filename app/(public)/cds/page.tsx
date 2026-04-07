import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, MapPin, ChevronRight, Trophy } from 'lucide-react'
import type { Concurso } from '@/types'

export const revalidate = 300

export default async function CDSPage() {
  const supabase = createClient()
  const year = new Date().getFullYear()

  const { data: concursos } = await supabase
    .from('concursos')
    .select('*')
    .order('fecha_inicio', { ascending: true })

  const all = (concursos as Concurso[]) ?? []
  const porTemporada = all.reduce<Record<number, Concurso[]>>((acc, c) => {
    ;(acc[c.temporada] = acc[c.temporada] ?? []).push(c)
    return acc
  }, {})
  const temporadas = Object.keys(porTemporada).map(Number).sort((a, b) => b - a)

  function estadoClase(estado: string) {
    const map: Record<string, string> = {
      upcoming:  'badge-gray',
      active:    'badge-green',
      completed: 'bg-gray-50 text-gray-400 badge',
    }
    return map[estado] ?? 'badge-gray'
  }
  function estadoLabel(estado: string) {
    return { upcoming: 'Próximo', active: 'En curso', completed: 'Finalizado' }[estado] ?? estado
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="page-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <Trophy size={22} className="text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Campeonatos Departamentales de Salto</h1>
          </div>
          <p className="text-gray-500 text-sm">Historial completo de competencias</p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {temporadas.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay competencias registradas aún.</p>
        ) : (
          <div className="space-y-12">
            {temporadas.map(temp => (
              <div key={temp}>
                <div className="flex items-center gap-3 mb-5">
                  <h2 className="text-lg font-bold text-gray-900">Temporada {temp}</h2>
                  {temp === year && <span className="badge-green badge">Activa</span>}
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {porTemporada[temp].map(c => (
                    <Link key={c.id} href={`/cds/${c.id}`}
                      className="card p-5 hover:shadow-md hover:border-green-100 transition-all group">
                      <div className="flex items-start justify-between mb-4">
                        <span className={`${estadoClase(c.estado)} badge`}>{estadoLabel(c.estado)}</span>
                        <span className="text-xs font-semibold text-gray-400">CDS #{c.numero}</span>
                      </div>
                      <h3 className="font-semibold text-gray-900 group-hover:text-green-700 transition-colors mb-3 leading-snug">
                        {c.nombre}
                      </h3>
                      <div className="space-y-1.5 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                          <MapPin size={13} className="text-gray-300 flex-shrink-0" />
                          <span className="truncate">{c.lugar}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar size={13} className="text-gray-300 flex-shrink-0" />
                          <span>
                            {new Date(c.fecha_inicio).toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })}
                            {c.fecha_fin !== c.fecha_inicio && (
                              <> – {new Date(c.fecha_fin).toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })}</>
                            )}
                          </span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
                        <span>{c.ciudad}</span>
                        <div className="flex items-center gap-1 text-green-600 font-medium">
                          Ver resultados <ChevronRight size={13} />
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
