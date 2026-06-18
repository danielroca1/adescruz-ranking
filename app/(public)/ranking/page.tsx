'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { TrendingUp, Search } from 'lucide-react'
import type { RankingEntry, Categoria } from '@/types'

interface DiaSeason {
  id: string
  fecha: string       // YYYY-MM-DD
  dia_numero: number
  concurso_id: string
  concurso: { numero: number; nombre: string }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDia(dia: DiaSeason) {
  // Parse as local noon to avoid UTC-offset day-shift issues
  const date = new Date(dia.fecha + 'T12:00:00')
  const dow = date.getDay()           // 0 = sun, 6 = sat
  const dayLabel =
    dow === 6 ? 'SAB' :
    dow === 0 ? 'DOM' :
    ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE'][dow - 1]
  const d = date.getDate()
  const m = date.getMonth() + 1
  return { dayLabel, dateStr: `${d}/${m}`, cdsNum: dia.concurso.numero }
}

function ptsStyle(pts: number | undefined): { bg: string; text: string; label: string } {
  if (pts === undefined) return { bg: 'bg-transparent',  text: 'text-gray-300',               label: '—'        }
  if (pts === 0)         return { bg: 'bg-red-50',       text: 'text-red-300',                 label: '0'        }
  if (pts === 7)         return { bg: 'bg-amber-50',     text: 'text-amber-700 font-bold',     label: '7'        }
  if (pts === 5)         return { bg: 'bg-slate-100',    text: 'text-slate-600 font-bold',     label: '5'        }
  if (pts === 4)         return { bg: 'bg-orange-50',    text: 'text-orange-600 font-semibold',label: '4'        }
  if (pts === 3)         return { bg: 'bg-green-50',     text: 'text-green-700 font-medium',   label: '3'        }
  if (pts === 2)         return { bg: 'bg-green-50',     text: 'text-green-600',               label: '2'        }
  if (pts === 1)         return { bg: 'bg-green-50',     text: 'text-green-500',               label: '1'        }
  return                        { bg: 'bg-gray-50',      text: 'text-gray-500',                label: String(pts)}
}

function posBadge(pos: number) {
  if (pos === 1) return 'bg-amber-100 text-amber-700'
  if (pos === 2) return 'bg-gray-200  text-gray-600'
  if (pos === 3) return 'bg-orange-100 text-orange-600'
  return 'bg-gray-50 text-gray-400'
}

// ── Component ──────────────────────────────────────────────────────────────

export default function RankingPage() {
  const [categorias,   setCategorias]   = useState<Categoria[]>([])
  const [selectedCat,  setSelectedCat]  = useState<string>('')
  const [ranking,      setRanking]      = useState<RankingEntry[]>([])
  const [dias,         setDias]         = useState<DiaSeason[]>([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const year = new Date().getFullYear()
  const supabase = createClient()

  // ── Load categories + competition days (once per session) ──────────────
  useEffect(() => {
    supabase
      .from('categorias')
      .select('*')
      .order('orden')
      .then(({ data }) => {
        if (data) {
          const rankables = data.filter((c: Categoria) => c.entra_ranking)
          setCategorias(rankables)
          setSelectedCat(rankables[0]?.id ?? '')
        }
      })

    supabase
      .from('concurso_dias')
      .select('id, fecha, dia_numero, concurso_id, concurso:concursos!inner(numero, nombre, temporada)')
      .eq('concurso.temporada', year)
      .order('fecha', { ascending: true })
      .then(({ data }) => {
        if (data) setDias(data as DiaSeason[])
      })
  }, [])

  // ── Load ranking for selected category, with realtime ─────────────────
  useEffect(() => {
    if (!selectedCat) return
    setLoading(true)

    const fetchRanking = () =>
      supabase
        .from('ranking')
        .select(`
          *,
          jinete:jinetes(id, full_name, avatar_url, federation_number),
          caballo:caballos(id, nombre, raza),
          categoria:categorias(id, nombre, altura_cm, ranking_por_caballo)
        `)
        .eq('categoria_id', selectedCat)
        .eq('temporada', year)
        .order('posicion', { ascending: true, nullsFirst: false })
        .then(({ data }) => {
          setRanking((data as RankingEntry[]) ?? [])
          setLoading(false)
        })

    fetchRanking()

    const channel = supabase
      .channel('ranking-live')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'ranking',
        filter: `categoria_id=eq.${selectedCat}`,
      }, fetchRanking)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedCat])

  // ── Derived state ──────────────────────────────────────────────────────
  const filtered = ranking.filter(r => {
    const q = search.toLowerCase()
    return (
      (r.jinete  as any)?.full_name?.toLowerCase().includes(q) ||
      (r.caballo as any)?.nombre?.toLowerCase().includes(q)
    )
  })

  const selectedCatObj  = categorias.find(c => c.id === selectedCat)
  const esPorCaballo    = (selectedCatObj as any)?.ranking_por_caballo ?? false

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-white">

      {/* ── Page header ── */}
      <div className="page-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp size={22} className="text-green-600" />
            <h1 className="text-2xl font-bold text-gray-900">Ranking {year}</h1>
          </div>
          <p className="text-gray-500 text-sm">
            Actualizado en tiempo real · Campeonato Departamental de Salto
            {dias.length > 0 && ` · ${dias.length} días de competencia`}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

        {/* ── Category tabs ── */}
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

        {/* ── Meta bar + search ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {selectedCatObj && (
              <p className="text-sm text-gray-500">
                <span className="font-semibold text-gray-900">{selectedCatObj.nombre}</span>
                {' '}· {selectedCatObj.altura_cm}cm · {filtered.length} binomios
              </p>
            )}
            {esPorCaballo && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-100">
                Ranking por caballo
              </span>
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

        {/* ── Ranking table ── */}
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
              <table className="w-full text-sm border-collapse">

                {/* ── Column headers ── */}
                <thead>
                  {/* CDS group row (spans day columns) */}
                  {dias.length > 0 && (() => {
                    // Group consecutive days belonging to the same CDS
                    const groups: { cdsNum: number; count: number }[] = []
                    dias.forEach(d => {
                      const last = groups[groups.length - 1]
                      if (last && last.cdsNum === d.concurso.numero) last.count++
                      else groups.push({ cdsNum: d.concurso.numero, count: 1 })
                    })
                    return (
                      <tr className="bg-gray-50 border-b border-gray-100">
                        {/* Empty cells for fixed columns */}
                        <td colSpan={esPorCaballo ? 2 : 3} />
                        {groups.map(g => (
                          <td
                            key={g.cdsNum}
                            colSpan={g.count}
                            className="text-center text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 py-1.5 border-l border-gray-100"
                          >
                            {g.count > 1 ? `${g.cdsNum}° CDS` : `CDS ${g.cdsNum}`}
                          </td>
                        ))}
                        <td colSpan={2} />
                      </tr>
                    )
                  })()}

                  {/* Main header row */}
                  <tr className="bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="text-center px-3 py-3 w-10">#</th>
                    <th className="text-left px-4 py-3">
                      {esPorCaballo ? 'Caballo' : 'Jinete'}
                    </th>
                    {!esPorCaballo && (
                      <th className="text-left px-4 py-3 hidden sm:table-cell">Caballo</th>
                    )}

                    {/* One column per competition day */}
                    {dias.map(dia => {
                      const { dayLabel, dateStr } = formatDia(dia)
                      return (
                        <th
                          key={dia.id}
                          className="text-center w-14 px-1 py-2 border-l border-gray-100"
                        >
                          <div className="font-semibold">{dayLabel}</div>
                          <div className="text-[10px] font-normal text-gray-400 mt-0.5">{dateStr}</div>
                        </th>
                      )
                    })}

                    <th className="text-right px-4 py-3 min-w-[80px]">Puntos</th>
                    <th className="text-center px-3 py-3 hidden md:table-cell min-w-[70px]">Part.</th>
                  </tr>
                </thead>

                {/* ── Rows ── */}
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(entry => {
                    const pos       = entry.posicion ?? 99
                    const jinete    = entry.jinete  as any
                    const caballo   = entry.caballo as any
                    const ptsMap    = entry.puntos_por_cds ?? {}
                    const pct       = dias.length > 0
                      ? Math.round((entry.cds_count / dias.length) * 100)
                      : 0

                    return (
                      <tr key={entry.id} className="hover:bg-gray-50 transition-colors">

                        {/* Position badge */}
                        <td className="px-3 py-3 text-center">
                          <span className={`w-7 h-7 rounded-full inline-flex items-center justify-center text-xs font-bold ${posBadge(pos)}`}>
                            {pos}
                          </span>
                        </td>

                        {/* Jinete (or horse name if por_caballo) */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-green-50 flex-shrink-0 flex items-center justify-center overflow-hidden">
                              {jinete?.avatar_url ? (
                                <img src={jinete.avatar_url} className="w-7 h-7 object-cover" alt="" />
                              ) : (
                                <span className="text-green-700 text-xs font-semibold">
                                  {esPorCaballo
                                    ? (caballo?.nombre?.charAt(0) ?? '?')
                                    : (jinete?.full_name?.charAt(0) ?? '?')}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 leading-tight">
                                {esPorCaballo
                                  ? (caballo?.nombre ?? '—')
                                  : (jinete?.full_name ?? '—')}
                              </p>
                              {/* On mobile show horse below name */}
                              {!esPorCaballo && (
                                <p className="text-xs text-gray-400 sm:hidden italic">{caballo?.nombre}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Horse (desktop, only in binomio mode) */}
                        {!esPorCaballo && (
                          <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                            <span className="italic">{caballo?.nombre ?? '—'}</span>
                          </td>
                        )}

                        {/* Points per day */}
                        {dias.map(dia => {
                          const pts   = ptsMap[dia.id] as number | undefined
                          const style = ptsStyle(pts)
                          return (
                            <td key={dia.id} className="px-1 py-2 text-center border-l border-gray-50">
                              <span className={`inline-flex items-center justify-center w-9 h-6 rounded text-xs ${style.bg} ${style.text}`}>
                                {style.label}
                              </span>
                            </td>
                          )
                        })}

                        {/* Total points */}
                        <td className="px-4 py-3 text-right">
                          <span className="text-base font-bold text-green-700">{entry.puntos_total}</span>
                          <span className="text-xs text-gray-400 ml-0.5">pts</span>
                        </td>

                        {/* Participation (días/total + mini bar) */}
                        <td className="px-3 py-3 text-center hidden md:table-cell">
                          <span className="text-xs font-medium text-gray-500">
                            {entry.cds_count}
                            <span className="text-gray-300">/{dias.length}</span>
                          </span>
                          <div className="w-full bg-gray-100 rounded-full h-1 mt-1.5 mx-auto max-w-[48px]">
                            <div
                              className="bg-green-500 h-1 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

              </table>
            </div>
          </div>
        )}

        {/* ── Legend ── */}
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-400">
          <span className="font-medium text-gray-500">Puntos:</span>
          {([
            ['7',  'bg-amber-50 text-amber-700 font-bold',      '1°'],
            ['5',  'bg-slate-100 text-slate-600 font-bold',     '2°'],
            ['4',  'bg-orange-50 text-orange-600 font-semibold','3°'],
            ['3–1','bg-green-50 text-green-600',                '4°–6°+'],
            ['0',  'bg-red-50 text-red-300',                    'ELM / RET / NSP'],
            ['—',  'bg-transparent text-gray-300',              'No participó'],
          ] as const).map(([label, cls, desc]) => (
            <span key={label} className="flex items-center gap-1.5">
              <span className={`inline-flex items-center justify-center w-7 h-5 rounded text-xs ${cls}`}>
                {label}
              </span>
              <span>{desc}</span>
            </span>
          ))}
          <span className="text-gray-300">·</span>
          <span>&gt;12 faltas = 0 pts</span>
        </div>

      </div>
    </div>
  )
}
