import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Trophy, Star, TrendingUp } from 'lucide-react'

export default async function JinetePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [profileRes, jineteRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('jinetes').select('*').eq('user_id', user.id).single(),
  ])

  const profile = profileRes.data
  const jinete = jineteRes.data

  // Stats
  const year = new Date().getFullYear()
  const { data: resultados } = await supabase
    .from('resultados')
    .select('puntos_asignados, posicion, estado_resultado')
    .eq('jinete_id', jinete?.id ?? '')

  const totalPuntos = resultados?.reduce((sum, r) => sum + r.puntos_asignados, 0) ?? 0
  const victorias = resultados?.filter(r => r.posicion === 1).length ?? 0
  const participaciones = resultados?.length ?? 0

  return (
    <div className="space-y-6">
      {/* Profile card */}
      <div className="card p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center flex-shrink-0">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="w-16 h-16 rounded-2xl object-cover" />
            ) : (
              <span className="text-green-700 text-2xl font-bold">
                {profile?.full_name?.charAt(0) ?? '?'}
              </span>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">{profile?.full_name}</h2>
            {jinete?.federation_number && (
              <p className="text-sm text-gray-400">Nro. federación: {jinete.federation_number}</p>
            )}
            {jinete?.bio && (
              <p className="text-sm text-gray-600 mt-2 leading-relaxed">{jinete.bio}</p>
            )}
            {!jinete && (
              <p className="text-sm text-amber-600 mt-1">
                Tu perfil de jinete aún no está completo. Contactá al administrador.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { icon: <TrendingUp size={18} className="text-green-600" />, label: 'Puntos totales', value: totalPuntos },
          { icon: <Trophy size={18} className="text-yellow-500" />,    label: 'Victorias',      value: victorias },
          { icon: <Star size={18} className="text-gray-500" />,       label: 'Participaciones', value: participaciones },
        ].map((s, i) => (
          <div key={i} className="card p-5 text-center">
            <div className="flex justify-center mb-2">{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Recent results */}
      {resultados && resultados.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-gray-900 mb-4 text-sm">Últimos resultados</h3>
          <div className="space-y-2">
            {resultados.slice(0, 5).map((r: any, i: number) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 rounded-full bg-gray-50 flex items-center justify-center text-xs font-medium text-gray-500">
                    {r.posicion ?? '—'}
                  </span>
                  <span className="text-sm text-gray-600">{r.estado_resultado}</span>
                </div>
                <span className="text-sm font-semibold text-green-700">{r.puntos_asignados}pts</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
