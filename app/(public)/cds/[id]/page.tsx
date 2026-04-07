import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Calendar, MapPin, ChevronLeft, Trophy, Clock } from 'lucide-react'
import type { Concurso, ConcursoDia, Prueba, Resultado } from '@/types'

export const revalidate = 60

interface PageProps {
  params: { id: string }
}

export default async function CDSDetailPage({ params }: PageProps) {
  const supabase = createClient()

  // Fetch concurso
  const { data: concurso } = await supabase
    .from('concursos')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!concurso) notFound()

  // Fetch dias with pruebas and resultados
  const { data: dias } = await supabase
    .from('concurso_dias')
    .select(`
      *,
      pruebas (
        *,
        categoria:categorias(nombre, altura_cm),
        resultados (
          *,
          jinete:jinetes(full_name, federation_number),
          caballo:caballos(nombre)
        )
      )
    `)
    .eq('concurso_id', params.id)
    .order('dia_numero')

  const c = concurso as Concurso
  const allDias = (dias ?? []) as any[]

  function estadoLabel(estado: string) {
    return { upcoming: 'Próximo', active: 'En curso', completed: 'Finalizado' }[estado] ?? estado
  }

  function estadoBadgeCls(estado: string) {
    return { upcoming: 'badge-gray', active: 'badge-green', completed: 'bg-gray-50 text-gray-400 badge' }[estado] ?? 'badge-gray'
  }

  function resultadoEstado(r: any) {
    if (r.estado_resultado !== 'completed') {
      return (
        <span className={`badge ${r.estado_resultado === 'ELM' ? 'bg-red-50 text-red-500' : 'badge-gray'}`}>
          {r.estado_resultado}
        </span>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="page-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link href="/cds" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4 transition-colors">
            <ChevronLeft size={15} /> Todos los CDS
          </Link>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <span className={`${estadoBadgeCls(c.estado)} badge`}>{estadoLabel(c.estado)}</span>
                <span className="text-xs text-gray-400 font-medium">CDS #{c.numero} · Temporada {c.temporada}</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{c.nombre}</h1>
              <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                <span className="flex items-center gap-1.5">
                  <MapPin size={14} className="text-gray-300" /> {c.lugar}, {c.ciudad}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-gray-300" />
                  {new Date(c.fecha_inicio).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  {c.fecha_fin !== c.fecha_inicio && (
                    <> – {new Date(c.fecha_fin).toLocaleDateString('es-BO', { day: 'numeric', month: 'long' })}</>
                  )}
                </span>
              </div>
            </div>
          </div>
          {c.descripcion && (
            <p className="mt-4 text-gray-600 text-sm max-w-2xl">{c.descripcion}</p>
          )}
        </div>
      </div>

      {/* Días */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {allDias.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Trophy size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Los resultados de este CDS aún no están disponibles.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {allDias.map((dia: any) => (
              <div key={dia.id}>
                <h2 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-700 text-white text-xs flex items-center justify-center font-bold">
                    {dia.dia_numero}
                  </span>
                  Día {dia.dia_numero}
                  <span className="text-sm text-gray-400 font-normal">
                    · {new Date(dia.fecha).toLocaleDateString('es-BO', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </span>
                </h2>

                {(!dia.pruebas || dia.pruebas.length === 0) ? (
                  <p className="text-sm text-gray-400 ml-8">Sin pruebas registradas.</p>
                ) : (
                  <div className="space-y-4 ml-0 sm:ml-8">
                    {dia.pruebas
                      .sort((a: any, b: any) => a.orden - b.orden)
                      .map((prueba: any) => (
                        <div key={prueba.id} className="card overflow-hidden">
                          {/* Prueba header */}
                          <div className="px-5 py-4 border-b border-gray-50 flex items-center justify-between">
                            <div>
                              <h3 className="font-medium text-gray-900 text-sm">{prueba.nombre}</h3>
                              <p className="text-xs text-gray-400 mt-0.5">
                                {prueba.categoria?.nombre} · {prueba.categoria?.altura_cm}cm
                                {prueba.articulo && <> · {prueba.articulo}</>}
                              </p>
                            </div>
                            <span className={`badge ${prueba.estado === 'completed' ? 'badge-green' : 'badge-gray'}`}>
                              {prueba.estado === 'completed' ? 'Completada' : 'Pendiente'}
                            </span>
                          </div>

                          {/* Resultados */}
                          {prueba.resultados && prueba.resultados.length > 0 ? (
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-50 bg-gray-50">
                                    <th className="text-left px-5 py-2.5 w-10">#</th>
                                    <th className="text-left px-4 py-2.5">Jinete</th>
                                    <th className="text-left px-4 py-2.5 hidden sm:table-cell">Caballo</th>
                                    <th className="text-right px-4 py-2.5 hidden md:table-cell">Faltas</th>
                                    <th className="text-right px-4 py-2.5 hidden md:table-cell">Tiempo</th>
                                    <th className="text-right px-5 py-2.5">Puntos</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {prueba.resultados
                                    .sort((a: any, b: any) => (a.posicion ?? 99) - (b.posicion ?? 99))
                                    .map((r: any) => (
                                      <tr key={r.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-5 py-3 text-sm font-medium text-gray-400">
                                          {r.posicion ?? '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                          <span className="font-medium text-gray-900">{r.jinete?.full_name ?? '—'}</span>
                                          {resultadoEstado(r) && (
                                            <span className="ml-2">{resultadoEstado(r)}</span>
                                          )}
                                          <span className="text-xs text-gray-400 sm:hidden block">{r.caballo?.nombre}</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                                          {r.caballo?.nombre ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                                          {r.faltas ?? '—'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-500 hidden md:table-cell">
                                          {r.tiempo_seg != null ? `${r.tiempo_seg}s` : '—'}
                                        </td>
                                        <td className="px-5 py-3 text-right">
                                          <span className="font-semibold text-green-700">{r.puntos_asignados}</span>
                                          <span className="text-xs text-gray-400 ml-1">pts</span>
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="px-5 py-4 text-sm text-gray-400 flex items-center gap-2">
                              <Clock size={14} />
                              Resultados pendientes
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
