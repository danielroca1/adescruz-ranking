'use client'

import { useState, Suspense } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') ?? '/'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    const { error, data } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      toast.error('Credenciales incorrectas. Intenta de nuevo.')
      setLoading(false)
      return
    }

    // Redirect based on role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    toast.success('¡Bienvenido!')

    if (redirectTo !== '/') {
      router.push(redirectTo)
    } else if (profile?.role === 'admin') {
      router.push('/admin')
    } else if (profile?.role === 'jurado') {
      router.push('/jurado')
    } else {
      router.push('/jinete')
    }

    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <div className="card p-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-xl font-bold text-gray-900">Iniciar sesión</h1>
          <p className="text-sm text-gray-500 mt-1">Accede a tu cuenta de ADESCRUZ</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
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

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className="input pr-10"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-2"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Ingresando…' : 'Iniciar sesión'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          ¿No tenés cuenta?{' '}
          <Link href="/register" className="text-green-700 font-medium hover:underline">
            Registrarse
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
