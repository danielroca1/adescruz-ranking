'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { RefreshCw, Loader2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function RecalcButton() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function recalcAll() {
    setLoading(true)
    const year = new Date().getFullYear()

    // Get all categorias
    const { data: cats } = await supabase.from('categorias').select('id')
    if (!cats) { setLoading(false); return }

    for (const cat of cats) {
      await supabase.rpc('recalcular_ranking', {
        p_categoria_id: cat.id,
        p_temporada: year,
      })
    }

    toast.success('Ranking recalculado para todas las categorías')
    router.refresh()
    setLoading(false)
  }

  return (
    <button onClick={recalcAll} disabled={loading} className="btn-secondary">
      {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
      {loading ? 'Recalculando…' : 'Recalcular ranking'}
    </button>
  )
}
