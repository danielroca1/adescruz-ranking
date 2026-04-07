'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Plus, Pencil, Trash2, Loader2, Calendar, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'

interface Concurso {
  id: string; nombre: string; numero: number; fecha_inicio: string;
  fecha_fin: string; lugar: string; ciudad: string; temporada: number; estado: string
}

const ESTADO_OPTS = ['upcoming', 'active', 'completed']

export default function AdminConcursosPage() {
  const supabase = createClient()
  const [concursos, setConcursos] = useState<Concurso[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nombre: '', numero: '', fecha_inicio: '', fecha_fin: '',
    lugar: '', ciudad: 'Santa Cruz de la Sierra', temporada: new Date().getFullYear().toString(),
    estado: 'upcoming', descripcion: '',
  })
  const [editId, setEditId] = useState<string | null>(null)

  function load() {
    supabase.from('concursos').select('*').order('temporada', { ascending: false }).order('numero')
      .then(({ data }) => { setConcursos(data ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ nombre: '', numero: '', fecha_inicio: '', fecha_fin: '', lugar: '', ciudad: 'Santa Cruz de la Sierra', temporada: new Date().getFullYear().toString(), estado: 'upcoming', descripcion: '' })
    setEditId(null)
    setShowForm(false)
  }

  async function handleSave() {
    if (!form.nombre || !form.numero || !form.fecha_inicio || !form.fecha_fin || !form.lugar) {
      toast.error('Completá todos los campos requeridos'); return
    }
    setSaving(true)
    const payload = {
      nombre: form.nombre, numero: Number(form.numero),
      fecha_inicio: form.fecha_inicio, fecha_fin: form.fecha_fin,
      lugar: form.lugar, ciudad: form.ciudad,
      temporada: Number(form.temporada), estado: form.estado,
      descripcion: form.descripcion || null,
    }
    const { error } = editId
      ? await supabase.from('concursos').update(payload).eq('id', editId)
      : await supabase.from('concursos').insert(payload)

    if (error) toast.error(error.message)
    else { toast.success(editId ? 'CDS actualizado' : 'CDS creado'); resetForm(); load() }
    setSaving(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este CDS y todos sus datos?')) return
    const { error } = await supabase.from('concursos').delete().eq('id', id)
    if (error) toast.error(error.message)
    else { toast.success('CDS eliminado'); load() }
  }

  function startEdit(c: Concurso) {
    setForm({
      nombre: c.nombre, numero: c.numero.toString(),
      fecha_inicio: c.fecha_inicio, fecha_fin: c.fecha_fin,
      lugar: c.lugar, ciudad: c.ciudad,
      temporada: c.temporada.toString(), estado: c.estado, descripcion: '',
    })
    setEditId(c.id)
    setShowForm(true)
  }

  function estadoBadge(e: string) {
    return e === 'active' ? 'badge-green' : e === 'upcoming' ? 'badge-gray' : 'bg-gray-50 text-gray-400 badge'
  }
  function estadoLabel(e: string) {
    return { active: 'En curso', upcoming: 'Próximo', completed: 'Finalizado' }[e] ?? e
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Concursos</h1>
          <p className="text-gray-400 text-sm mt-1">Gestión de CDS</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> Nuevo CDS
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6">
            <h2 className="font-semibold text-gray-900 mb-5">{editId ? 'Editar CDS' : 'Nuevo CDS'}</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="CDS #1 Santa Cruz 2025" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Número *</label>
                <input type="number" className="input" value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Temporada *</label>
                <input type="number" className="input" value={form.temporada} onChange={e => setForm(f => ({ ...f, temporada: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha inicio *</label>
                <input type="date" className="input" value={form.fecha_inicio} onChange={e => setForm(f => ({ ...f, fecha_inicio: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Fecha fin *</label>
                <input type="date" className="input" value={form.fecha_fin} onChange={e => setForm(f => ({ ...f, fecha_fin: e.target.value }))} />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-500 mb-1">Lugar *</label>
                <input className="input" value={form.lugar} onChange={e => setForm(f => ({ ...f, lugar: e.target.value }))} placeholder="Club Hípico Lomas del Palmar" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Ciudad</label>
                <input className="input" value={form.ciudad} onChange={e => setForm(f => ({ ...f, ciudad: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Estado</label>
                <select className="input" value={form.estado} onChange={e => setForm(f => ({ ...f, estado: e.target.value }))}>
                  {ESTADO_OPTS.map(o => <option key={o} value={o}>{estadoLabel(o)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={resetForm} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary">
                {saving && <Loader2 size={14} className="animate-spin" />}
                {saving ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3">#</th>
                <th className="text-left px-4 py-3">Nombre</th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">Lugar</th>
                <th className="text-left px-4 py-3 hidden md:table-cell">Fechas</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="px-4 py-3 w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {concursos.map(c => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 text-gray-400 text-xs font-semibold">
                    {c.temporada} / {c.numero}
                  </td>
                  <td className="px-4 py-3.5 font-medium text-gray-900">{c.nombre}</td>
                  <td className="px-4 py-3.5 text-gray-500 hidden sm:table-cell">
                    <span className="flex items-center gap-1 text-xs">
                      <MapPin size={11} /> {c.lugar}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-gray-500 text-xs hidden md:table-cell">
                    <span className="flex items-center gap-1">
                      <Calendar size={11} />
                      {new Date(c.fecha_inicio).toLocaleDateString('es-BO')}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`badge ${estadoBadge(c.estado)}`}>{estadoLabel(c.estado)}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2 justify-end">
                      <button onClick={() => startEdit(c)} className="text-gray-400 hover:text-green-600 transition-colors">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => handleDelete(c.id)} className="text-gray-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {concursos.length === 0 && (
            <div className="py-12 text-center text-sm text-gray-400">
              No hay concursos. <button onClick={() => setShowForm(true)} className="text-green-700 hover:underline">Crear el primero</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
