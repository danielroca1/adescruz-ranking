import { createClient } from '@/lib/supabase/server'
import { TrendingUp, RefreshCw } from 'lucide-react'
import RecalcButton from './RecalcButton'

export const revalidate = 60

export default async function AdminRankingPage() {
  const supabase = createClient()
  const year = new Date().getFullYear()

  const { data: categorias } = await supabase
    .from('categorias').select('*').order('orden')

  const { data: ranking } = await supabase
    .from('ranking')
    .select('*, jinete:jinetes(full_name), caballo:caballos(nombre), categoria:categorias(nombre)')
    .eq('temporada', year)
    .order('categoria_id')
    .order('posicion', { nullsFirst: false })

  const byCat = (ranking ?? []).reduce<Record<string, any[]>>((acc, r) => {
    const cat = (r.categoria as any)?.nombre ?? 'Sin categoría'
    ;(acc[cat] = acc[cat] ?? []).push(r)
    return acc
  }, {})

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ranking {year}</h1>
          <p className="text-gray-400 text-sm mt-1">Actualizado automáticamente al cargar resultados</p>
        </div>
        <RecalcButton />
      </div>

      {Object.keys(byCat).length === 0 ? (
        <div className="card py-16 text-center">
          <TrendingUp size={28} className="mx-auto mb-3 text-gray-200" />
          <p className="text-sm text-gray-400">No hay datos de ranking para {year}.</p>
          <p className="text-xs text-gray-300 mt-1">Los datos se generan al cargar resultados de CDS.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {(categorias ?? []).map((cat: any) => {
            const entries = byCat[cat.nombre]
            if (!entries || entries.length === 0) return null
            return (
              <div key={cat.id} className="card overflow-hidden">
                <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50 flex items-center gap-3">
                  <h2 className="font-semibold text-gray-900 text-sm">{cat.nombre}</h2>
                  <span className="text-xs text-gray-400">{cat.altura_cm}cm · {entries.length} binomios</span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 uppercase tracking-wider border-b border-gray-50">
                      <th className="text-left px-5 py-2.5 w-10">#</th>
                      <th className="text-left px-4 py-2.5">Jinete</th>
                      <th className="text-left px-4 py-2.5 hidden sm:table-cell">Caballo</th>
                      <th className="text-right px-4 py-2.5 hidden md:table-cell">CDS</th>
                      <th className="text-right px-5 py-2.5">Puntos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {entries.map((r: any) => (
                      <tr key={r.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3 text-xs font-semibold text-gray-400">{r.posicion ?? '—'}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.jinete?.full_name ?? '—'}</td>
                        <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{r.caballo?.nombre ?? '—'}</td>
                        <td className="px-4 py-3 text-right text-gray-400 hidden md:table-cell">{r.cds_count}</td>
                        <td className="px-5 py-3 text-right font-semibold text-green-700">{r.puntos_total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
