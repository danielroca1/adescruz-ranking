'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Menu, X, ChevronDown, User, LogOut, Settings } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface NavbarProps {
  user?: {
    id: string
    full_name: string
    role: string
    avatar_url?: string
  } | null
}

const NAV_LINKS = [
  { href: '/ranking',    label: 'Ranking'     },
  { href: '/cds',        label: 'CDS'         },
  { href: '/calendario', label: 'Calendario'  },
  { href: '/noticias',   label: 'Noticias'    },
  { href: '/nosotros',   label: 'Nosotros'    },
]

export default function Navbar({ user }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  function dashboardHref() {
    if (user?.role === 'admin')  return '/admin'
    if (user?.role === 'jurado') return '/jurado'
    return '/jinete'
  }

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded-lg bg-green-700 flex items-center justify-center
                            group-hover:bg-green-600 transition-colors">
              <span className="text-white text-xs font-bold tracking-tight">A</span>
            </div>
            <span className="font-semibold text-gray-900 tracking-tight">ADESCRUZ</span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'text-green-700 bg-green-50'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(!userMenuOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <span className="text-white text-xs font-semibold">
                        {user.full_name.charAt(0).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-gray-700 max-w-[120px] truncate">
                    {user.full_name.split(' ')[0]}
                  </span>
                  <ChevronDown size={14} className="text-gray-400" />
                </button>

                {userMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl shadow-lg border border-gray-100 py-1 z-50">
                    <div className="px-4 py-2 border-b border-gray-50">
                      <p className="text-xs text-gray-400">Sesión iniciada como</p>
                      <p className="text-sm font-medium text-gray-900 truncate">{user.full_name}</p>
                    </div>
                    <Link
                      href={dashboardHref()}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={() => setUserMenuOpen(false)}
                    >
                      <Settings size={15} />
                      Mi panel
                    </Link>
                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <LogOut size={15} />
                      Cerrar sesión
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link href="/login" className="btn-primary">
                Iniciar sesión
              </Link>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-50 transition-colors"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Menú"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-gray-100 bg-white">
          <div className="px-4 py-3 space-y-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.href}
                href={link.href}
                className={`block px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  pathname.startsWith(link.href)
                    ? 'text-green-700 bg-green-50'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="pt-2 border-t border-gray-100">
              {user ? (
                <>
                  <Link
                    href={dashboardHref()}
                    className="block px-3 py-2.5 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                    onClick={() => setMobileOpen(false)}
                  >
                    Mi panel
                  </Link>
                  <button
                    onClick={handleSignOut}
                    className="block w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Cerrar sesión
                  </button>
                </>
              ) : (
                <Link href="/login" className="btn-primary w-full justify-center mt-1"
                      onClick={() => setMobileOpen(false)}>
                  Iniciar sesión
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
