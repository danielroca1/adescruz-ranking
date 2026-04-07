'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Plus, Pencil, Trash2, Loader2, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

interface Noticia {
  id: string; titulo: string; contenido: string; publicado: boolean
  fecha_publicacion: string; imagen_url?: string
}

export default function AdminNoticiasPage() {
  const supabase = createClient()
  const [noticias, setNoticias] = useState<Noticia[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ titulo: '', contenido: '', publicado: false, imagen_url: '' })

  function load() {
    supabase.from('noticias').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setNoticias(data ?? []); setLoading(false) })
  }

  useEffect(() => { load() }, [])

  function resetForm() {
    setForm({ titulo: '', contenido: '', publicado: false, imagen_url: '' })
    setEditId(null); setShowForm(false)
  }

  async function handleSave() {
    if (!form.titulo || !form.contenido) { toast.error('Completá título y contenido'); return }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    const payload = {
      titulo: form.titulo, contenido: form.contenido,
      publicado: form.publicado,
      imagen_url: form.imagen_url || null,
      fecha_publicacion: form.publicado ? new Date().toISOString() : null,
      autor_id: user!.id,
    }
    const { error } = editId
      ? await supabase.from('noticias').update(payload).eq('id', editId)
      : await supabase.from('noticias').insert(payload)
    if (error) toast.error(error.message)
    else { toast.success(editId ? 'Noticia actualizada' : 'Noticia creada'); resetForm(); load() }
    setSaving(false)
  }

  async function togglePublish(n: Noticia) {
    const { error } = await supabase.from('noticias').update({
      publicado: !n.publicado,
      fecha_publicacion: !n.publicado ? new Date().toISOString() : null,
    }).eq('id', n.id)
    if (error) toast.error(error.message)
    else { toast.success(!n.publicado ? 'Publicada' : 'Despublicada'); load() }
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta noticia?')) return
    await supabase.from('noticias').delete().eq('id', id)
    toast.success('Noticia eliminada'); load()
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Noticias</h1>
          <p className="text-gray-400 text-sm mt-1">{noticias.length} artículos</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-primary">
          <Plus size={16} /> Nueva noticia
        </button>
      </div>

      {/* Form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-gray-900 mb-5">{editId ? 'Editar noticia' : 'Nueva noticia'}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Título *</label>
                <input className="input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">URL imagen (opcional)</label>
                <input className="input" value={form.imagen_url} onChange={e => setForm(f => ({ ...f, imagen_url: e.target.value }))} placeholder="https://..." />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Contenido *</label>
                <textarea rows={8} className="input resize-none" value={form.contenido}
                  onChange={e => setForm(f => ({ ...f, contenido: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="rounded" checked={form.publicado}
                  onChange={e => setForm(f => ({ ...f, publicado: e.target.checked }))} />
                <span className="text-sm text-gray-700">Publicar inmediatamente</span>
              </label>
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

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-20"><div className="w-6 h-6 border-2 border-green-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="space-y-3">
          {noticias.length === 0 ? (
            <div className="card py-12 text-center text-sm text-gray-400">
              No hay noticias. <button onClick={() => setShowForm(true)} className="text-green-700 hover:underline">Crear la primera</button>
            </div>
          ) : noticias.map(n => (
            <div key={n.id} className="card p-5 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-medium text-gray-900 truncate">{n.titulo}</h3>
                  <span className={`badge ${n.publicado ? 'badge-green' : 'badge-gray'}`}>
                    {n.publicado ? 'Publicada' : 'Borrador'}
                  </span>
                </div>
                <p className="text-xs text-gray-400">
                  {n.fecha_publicacion
                    ? new Date(n.fecha_publicacion).toLocaleDateString('es-BO', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Sin publicar'}
                </p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => togglePublish(n)}
                  className={`p-2 rounded-lg transition-colors ${n.publicado ? 'text-green-600 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'}`}
                  title={n.publicado ? 'Despublicar' : 'Publicar'}>
                  {n.publicado ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button onClick={() => { setForm({ titulo: n.titulo, contenido: n.contenido, publicado: n.publicado, imagen_url: n.imagen_url ?? '' }); setEditId(n.id); setShowForm(true) }}
                  className="p-2 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50 transition-colors">
                  <Pencil size={15} />
                </button>
                <button onClick={() => handleDelete(n.id)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
