'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Upload, ChevronDown, Plus, Loader2, Check, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface Concurso { id: string; nombre: string; numero: number }
interface Dia { id: string; dia_numero: number; fecha: string }
interface Prueba { id: string; nombre: string; categoria: { nombre: string } }
interface Jinete { id: string; full_name: string }
interface Caballo { id: string; nombre: string; owner_id: string }

const ESTADO_OPTIONS = ['completed', 'ELM', 'RET', 'NSP'] as const

function calcPuntos(posicion: number | '', faltas: number | '', estado: string): number {
  if (estado !== 'completed') return 0
  if (faltas !== '' && Number(faltas) > 12) return 0
  const pos = Number(posicion)
  if (!pos) return 0
  return pos === 1 ? 7 : pos === 2 ? 5 : pos === 3 ? 4 : pos === 4 ? 3 : pos === 5 ? 2 : 1
}

export default function JuradoPage() {
  const supabase = createClient()

  const [concursos, setConcursos] = useState<Concurso[]>([])
  const [dias, setDias] = useState<Dia[]>([])
  const [pruebas, setPruebas] = useState<Prueba[]>([])
  const [jinetes, setJinetes] = useState<Jinete[]>([])
  const [caballos, setCaballos] = useState<Caballo[]>([])

  const [selConcurso, setSelConcurso] = useState('')
  const [selDia, setSelDia] = useState('')
  const [selPrueba, setSelPrueba] = useState('')

  const [rows, setRows] = useState([
    { jinete_id: '', caballo_id: '', posicion: '', faltas: '', tiempo_seg: '', estado: 'completed' }
  ])
  const [saving, setSaving] = useState(false)

  // Load concursos (active or upcoming)
  useEffect(() => {
    supabase.from('concursos').select('id, nombre, numero')
      .in('estado', ['active', 'upcoming'])
      .order('fecha_inicio')
      .then(({ data }) => setConcursos(data ?? []))
  }, [])

  useEffect(() => {
    if (!selConcurso) return
    supabase.from('concurso_dias').select('*')
      .eq('concurso_id', selConcurso).order('dia_numero')
      .then(({ data }) => { setDias(data ?? []); setSelDia(''); setSelPrueba('') })
  }, [selConcurso])

  useEffect(() => {
    if (!selDia) return
    supabase.from('pruebas').select('id, nombre, categoria:categorias(nombre)')
      .eq('concurso_dia_id', selDia).order('orden')
      .then(({ data }) => { setPruebas((data ?? []) as any); setSelPrueba('') })
  }, [selDia])

  useEffect(() => {
    supabase.from('jinetes').select('id, full_name').eq('active', true).order('full_name')
      .then(({ data }) => setJinetes(data ?? []))
    supabase.from('caballos').select('id, nombre, owner_id').eq('active', true).order('nombre')
      .then(({ data }) => setCaballos(data ?? []))
  }, [])

  function updateRow(i: number, field: string, value: string) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }

  function addRow() {
    setRows(prev => [...prev, { jinete_id: '', caballo_id: '', posicion: '', faltas: '', tiempo_seg: '', estado: 'completed' }])
  }

  function removeRow(i: number) {
    if (rows.length === 1) return
    setRows(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleSave() {
    if (!selPrueba) { toast.error('Seleccioná una prueba'); return }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setSaving(true)
    const toInsert = rows
      .filter(r => r.jinete_id && r.caballo_id)
      .map(r => ({
        prueba_id: selPrueba,
        jinete_id: r.jinete_id,
        caballo_id: r.caballo_id,
        posicion: r.posicion ? Number(r.posicion) : null,
        faltas: r.faltas !== '' ? Number(r.faltas) : null,
        tiempo_seg: r.tiempo_seg !== '' ? Number(r.tiempo_seg) : null,
        estado_resultado: r.estado,
        puntos_asignados: calcPuntos(r.posicion as any, r.faltas as any, r.estado),
        uploaded_by: user.id,
      }))

    if (toInsert.length === 0) { toast.error('Completá al menos un resultado'); setSaving(false); return }

    const { error } = await supabase.from('resultados').upsert(toInsert, {
      onConflict: 'prueba_id,jinete_id,caballo_id',
      ignoreDuplicates: false,
    })

    if (error) {
      toast.error('Error al guardar: ' + error.message)
    } else {
      // Mark prueba as completed
      await supabase.from('pruebas').update({ estado: 'completed' }).eq('id', selPrueba)
      toast.success(`${toInsert.length} resultado${toInsert.length !== 1 ? 's' : ''} guardado${toInsert.length !== 1 ? 's' : ''}`)
      setRows([{ jinete_id: '', caballo_id: '', posicion: '', faltas: '', tiempo_seg: '', estado: 'completed' }])
    }
    setSaving(false)
  }

  const jineteneCaballos = (jinete_id: string) =>
    caballos.filter(c => c.owner_id === jinete_id)

  return (
    <div className="space-y-6">
      {/* Selectors */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 text-sm">Seleccionar prueba</h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">CDS</label>
            <select className="input" value={selConcurso} onChange={e => setSelConcurso(e.target.value)}>
              <option value="">Seleccionar CDS…</option>
              {concursos.map(c => (
                <option key={c.id} value={c.id}>CDS #{c.numero} – {c.nombre}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Día</label>
            <select className="input" value={selDia} onChange={e => setSelDia(e.target.value)} disabled={!selConcurso}>
              <option value="">Seleccionar día…</option>
              {dias.map(d => (
                <option key={d.id} value={d.id}>
                  Día {d.dia_numero} – {new Date(d.fecha).toLocaleDateString('es-BO')}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1.5">Prueba</label>
            <select className="input" value={selPrueba} onChange={e => setSelPrueba(e.target.value)} disabled={!selDia}>
              <option value="">Seleccionar prueba…</option>
              {pruebas.map(p => (
                <option key={p.id} value={p.id}>
                  {p.nombre} – {(p.categoria as any)?.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results table */}
      {selPrueba && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900 text-sm">Cargar resultados</h2>
            <span className="badge-gray badge">
              {pruebas.find(p => p.id === selPrueba)?.nombre}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3">Jinete</th>
                  <th className="text-left px-4 py-3">Caballo</th>
                  <th className="text-center px-3 py-3 w-16">Pos.</th>
                  <th className="text-center px-3 py-3 w-20">Faltas</th>
                  <th className="text-center px-3 py-3 w-24">Tiempo (s)</th>
                  <th className="text-center px-3 py-3 w-24">Estado</th>
                  <th className="px-3 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {rows.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <select className="input text-xs py-2"
                        value={row.jinete_id}
                        onChange={e => { updateRow(i, 'jinete_id', e.target.value); updateRow(i, 'caballo_id', '') }}>
                        <option value="">Jinete…</option>
                        {jinetes.map(j => <option key={j.id} value={j.id}>{j.full_name}</option>)}
                      </select>
                    </td>
                    <td className="px-4 py-2">
                      <select className="input text-xs py-2"
                        value={row.caballo_id}
                        onChange={e => updateRow(i, 'caballo_id', e.target.value)}
                        disabled={!row.jinete_id}>
                        <option value="">Caballo…</option>
                        {jineteneCaballos(row.jinete_id).map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" className="input text-center text-xs py-2 px-2" min="1"
                        value={row.posicion} onChange={e => updateRow(i, 'posicion', e.target.value)}
                        disabled={row.estado !== 'completed'} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" className="input text-center text-xs py-2 px-2" min="0" step="0.25"
                        value={row.faltas} onChange={e => updateRow(i, 'faltas', e.target.value)}
                        disabled={row.estado !== 'completed'} />
                    </td>
                    <td className="px-3 py-2">
                      <input type="number" className="input text-center text-xs py-2 px-2" min="0" step="0.01"
                        value={row.tiempo_seg} onChange={e => updateRow(i, 'tiempo_seg', e.target.value)}
                        disabled={row.estado !== 'completed'} />
                    </td>
                    <td className="px-3 py-2">
                      <select className="input text-xs py-2 text-center"
                        value={row.estado} onChange={e => updateRow(i, 'estado', e.target.value)}>
                        {ESTADO_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </td>
                    <td className="px-3 py-2">
                      <button onClick={() => removeRow(i)}
                        className="text-gray-300 hover:text-red-400 transition-colors text-lg leading-none">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between">
            <button onClick={addRow} className="btn-ghost text-sm">
              <Plus size={15} /> Agregar fila
            </button>
            <button onClick={handleSave} disabled={saving} className="btn-primary">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {saving ? 'Guardando…' : 'Guardar resultados'}
            </button>
          </div>
        </div>
      )}

      {/* Points reference */}
      <div className="p-4 bg-blue-50 rounded-2xl text-xs text-blue-600">
        <p className="font-medium mb-1 flex items-center gap-1.5">
          <AlertCircle size={13} /> Puntos calculados automáticamente
        </p>
        <p className="text-blue-400">
          1°=7pts · 2°=5pts · 3°=4pts · 4°=3pts · 5°=2pts · 6°+=1pt ·
          ELM/RET/NSP/&gt;12 faltas=0pts
        </p>
      </div>
    </div>
  )
}
