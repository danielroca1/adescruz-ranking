import { createClient } from '@/lib/supabase/server'
import { Users } from 'lucide-react'

export const revalidate = 60

export default async function AdminUsuariosPage() {
  const supabase = createClient()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role, created_at, avatar_url')
    .order('created_at', { ascending: false })

  const roleLabel = (r: string) => ({ admin: 'Admin', jurado: 'Jurado', jinete: 'Jinete' }[r] ?? r)
  const roleBadge = (r: string) => r === 'admin' ? 'bg-purple-50 text-purple-600 badge' : r === 'jurado' ? 'badge-green' : 'badge-gray'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
        <p className="text-gray-400 text-sm mt-1">{profiles?.length ?? 0} usuarios registrados</p>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
              <th className="text-left px-5 py-3">Usuario</th>
              <th className="text-left px-4 py-3">Rol</th>
              <th className="text-left px-4 py-3 hidden sm:table-cell">Registrado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {profiles?.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-green-50 flex items-center justify-center flex-shrink-0">
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <span className="text-green-700 text-xs font-semibold">
                          {p.full_name?.charAt(0) ?? '?'}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{p.full_name}</p>
                      <p className="text-xs text-gray-400 font-mono">{p.id.slice(0, 8)}…</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3.5">
                  <span className={`badge ${roleBadge(p.role)}`}>{roleLabel(p.role)}</span>
                </td>
                <td className="px-4 py-3.5 text-gray-400 text-xs hidden sm:table-cell">
                  {new Date(p.created_at).toLocaleDateString('es-BO', { day: 'numeric', month: 'short', year: 'numeric' })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(!profiles || profiles.length === 0) && (
          <div className="py-12 text-center text-sm text-gray-400 flex items-center justify-center gap-2">
            <Users size={16} /> No hay usuarios registrados
          </div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">
        Para cambiar el rol de un usuario, accedé al panel de Supabase → Auth → Users y actualizá los metadatos.
      </p>
    </div>
  )
}
