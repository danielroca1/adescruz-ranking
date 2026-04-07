import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Calendar, MapPin, ChevronRight } from 'lucide-react'
import type { Concurso } from '@/types'

export const revalidate = 300

const MONTHS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]

export default async function CalendarioPage() {
  const supabase = createClient()
  const year = new Date().getFullYear()

  const { data } = await supabase
    .from('concursos')
    .select('*')
    .eq('temporada', year)
    .order('fecha_inicio')

  const concursos = (data as Concurso[]) ?? []

  // Group by month
  const porMes = concursos.reduce<Record<number, Concurso[]>>((acc, c) => {
    const mes = new Date(c.fecha_inicio).getMonth()
    ;(acc[mes] = acc[mes] ?? []).push(c)
    return acc
  }, {})

  function estadoBg(estado: string) {
    return {
      upcoming:  'border-l-4 border-gray-200',
      active:    'border-l-4 border-green-500 bg-green-50',
      completed: 'border-l-4 border-gray-100 opacity-70',
    }[estado] ?? ''
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="page-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <Calendar size={22} className="text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Calendario {year}</h1>
          </div>
          <p className="text-gray-500 text-sm">
            {concursos.length} competencia{concursos.length !== 1 ? 's' : ''} programada{concursos.length !== 1 ? 's' : ''} para la temporada
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {concursos.length === 0 ? (
          <p className="text-gray-400 text-sm">No hay competencias para esta temporada todavía.</p>
        ) : (
          <div className="space-y-10">
            {Object.entries(porMes)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([mes, cds]) => (
                <div key={mes}>
                  <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                    {MONTHS[Number(mes)]}
                  </h2>
                  <div className="space-y-3">
                    {cds.map(c => (
                      <Link key={c.id} href={`/cds/${c.id}`}
                        className={`flex items-center gap-5 p-5 rounded-2xl bg-white border border-gray-100
                                    hover:shadow-sm hover:border-green-100 transition-all group ${estadoBg(c.estado)}`}>
                        {/* Date box */}
                        <div className="flex-shrink-0 text-center w-12">
                          <p className="text-lg font-bold text-gray-900 leading-none">
                            {new Date(c.fecha_inicio).getDate()}
                          </p>
                          <p className="text-xs text-gray-400 uppercase">
                            {MONTHS[new Date(c.fecha_inicio).getMonth()].slice(0, 3)}
                          </p>
                        </div>

                        {/* Divider */}
                        <div className="w-px h-10 bg-gray-100 flex-shrink-0" />

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-semibold text-gray-900 truncate group-hover:text-green-700 transition-colors">
                              {c.nombre}
                            </p>
                            {c.estado === 'active' && <span className="badge-green badge">En curso</span>}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                            <span className="flex items-center gap-1">
                              <MapPin size={11} /> {c.lugar}
                            </span>
                            {c.fecha_fin !== c.fecha_inicio && (
                              <span>
                                hasta el {new Date(c.fecha_fin).getDate()} de {MONTHS[new Date(c.fecha_fin).getMonth()]}
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight size={16} className="text-gray-300 group-hover:text-green-500 flex-shrink-0 transition-colors" />
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
