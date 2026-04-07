'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) {
      toast.error('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    setLoading(true)

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, role: 'jinete' },
      },
    })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    toast.success('Cuenta creada. Revisá tu email para confirmar.')
    router.push('/login')
  }

  return (
    <div className="w-full max-w-sm">
      <div className="card p-8">
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900">Crear cuenta</h1>
          <p className="text-sm text-gray-500 mt-1">Registrate como jinete en ADESCRUZ</p>
        </div>

        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Nombre completo
            </label>
            <input
              type="text"
              className="input"
              placeholder="Nombre y apellido"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              className="input"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                placeholder="Mínimo 8 caracteres"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">Mínimo 8 caracteres</p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Creando cuenta…' : 'Registrarse'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="text-green-700 font-medium hover:underline">
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
