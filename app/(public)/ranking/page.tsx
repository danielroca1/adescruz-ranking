'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Search, ChevronUp, ChevronDown, Minus } from 'lucide-react'
import type { RankingEntry, Categoria } from '@/types'

export default function RankingPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [selectedCat, setSelectedCat] = useState<string>('')
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const year = new Date().getFullYear()
  const supabase = createClient()

  // Load categorias
  useEffect(() => {
    supabase
      .from('categorias')
      .select('*')
      .order('orden')
      .then(({ data }) => {
        if (data) {
          setCategorias(data)
          setSelectedCat(data[0]?.id ?? '')
        }
      })
  }, [])

  // Load ranking when category changes — with realtime
  useEffect(() => {
    if (!selectedCat) return
    setLoading(true)

    supabase
      .from('ranking')
      .select(`
        *,
        jinete:jinetes(id, full_name, avatar_url, federation_number),
        caballo:caballos(id, nombre, raza),
        categoria:categorias(id, nombre, altura_cm)
      `)
      .eq('categoria_id', selectedCat)
      .eq('temporada', year)
      .order('posicion', { ascending: true, nullsFirst: false })
      .then(({ data }) => {
        setRanking((data as RankingEntry[]) ?? [])
        setLoading(false)
      })

    // Realtime subscription
    const channel = supabase
      .channel('ranking-live')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'ranking',
        filter: `categoria_id=eq.${selectedCat}`,
      }, () => {
        // Refetch on change
        supabase
          .from('ranking')
          .select(`*, jinete:jinetes(id, full_name, avatar_url, federation_number), caballo:caballos(id, nombre, raza), categoria:categorias(id, nombre, altura_cm)`)
          .eq('categoria_id', selectedCat)
          .eq('temporada', year)
          .order('posicion', { ascending: true, nullsFirst: false })
          .then(({ data }) => setRanking((data as RankingEntry[]) ?? []))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedCat])

  const filtered = ranking.filter(r => {
    const q = search.toLowerCase()
    return (
      (r.jinete as any)?.full_name?.toLowerCase().includes(q) ||
      (r.caballo as any)?.nombre?.toLowerCase().includes(q)
    )
  })

  function medalColor(pos: number) {
    if (pos === 1) return 'text-yellow-500 bg-yellow-50'
    if (pos === 2) return 'text-gray-400 bg-gray-50'
    if (pos === 3) return 'text-orange-400 bg-orange-50'
    return 'text-gray-300 bg-gray-50'
  }

  const selectedCatObj = categorias.find(c => c.id === selectedCat)

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="page-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={22} className="text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Ranking {year}</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Actualizado en tiempo real · Campeonato Departamental de Salto
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Category tabs */}
        <div className="overflow-x-auto -mx-4 px-4 mb-6">
          <div className="flex gap-2 min-w-max pb-2">
            {categorias.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCat(cat.id)}
                className={`px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors ${
                  selectedCat === cat.id
                    ? 'bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat.nombre}
                <span className={`ml-1.5 text-xs ${selectedCat === cat.id ? 'text-green-200' : 'text-gray-400'}`}>
                  {cat.altura_cm}cm
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Search + meta */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            {selectedCatObj && (
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-900">{selectedCatObj.nombre}</span>
                {' '}· {selectedCatObj.altura_cm}cm · {filtered.length} binomios
              </p>
            )}
          </div>
          <div className="relative w-full sm:w-64">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              className="input pl-9"
              placeholder="Buscar jinete o caballo…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <TrendingUp size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay datos de ranking para esta categoría.</p>
          </div>
        ) : (
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-400 uppercase tracking-wider">
                    <th className="text-left px-4 py-3 w-12">#</th>
                    <th className="text-left px-4 py-3">Jinete</th>
                    <th className="text-left px-4 py-3 hidden sm:table-cell">Caballo</th>
                    <th className="text-right px-4 py-3 hidden md:table-cell">CDS</th>
                    <th className="text-right px-4 py-3">Puntos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((entry) => {
                    const pos = entry.posicion ?? 99
                    const jinete = entry.jinete as any
                    const caballo = entry.caballo as any
                    return (
                      <tr key={entry.id}
                        className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3.5">
                          <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold ${medalColor(pos)}`}>
                            {pos}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                              {jinete?.avatar_url ? (
                                <img src={jinete.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                              ) : (
                                <span className="text-green-700 text-xs font-semibold">
                                  {jinete?.full_name?.charAt(0) ?? '?'}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{jinete?.full_name ?? '—'}</p>
                              <p className="text-xs text-gray-400 sm:hidden">{caballo?.nombre}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-600 hidden sm:table-cell">
                          {caballo?.nombre ?? '—'}
                        </td>
                        <td className="px-4 py-3.5 text-right text-gray-400 hidden md:table-cell">
                          {entry.cds_count}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="font-semibold text-green-700">{entry.puntos_total}</span>
                          <span className="text-xs text-gray-400 ml-1">pts</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Points legend */}
        <div className="mt-6 p-4 bg-gray-50 rounded-2xl">
          <p className="text-xs font-medium text-gray-500 mb-2">Sistema de puntuación</p>
          <div className="flex flex-wrap gap-3 text-xs text-gray-500">
            {[['1°', '7pts'], ['2°', '5pts'], ['3°', '4pts'], ['4°', '3pts'], ['5°', '2pts'], ['6°+', '1pt']].map(([pos, pts]) => (
              <span key={pos} className="flex items-center gap-1">
                <span className="font-medium text-gray-700">{pos}</span> {pts}
              </span>
            ))}
            <span>· ELM / RET / NSP / &gt;12 faltas = 0pts</span>
          </div>
        </div>
      </div>
    </div>
  )
}
