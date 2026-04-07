import Link from 'next/link'

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-gray-100 bg-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">

          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 rounded-lg bg-green-700 flex items-center justify-center">
                <span className="text-white text-xs font-bold">A</span>
              </div>
              <span className="font-semibold text-gray-900">ADESCRUZ</span>
            </div>
            <p className="text-sm text-gray-500 leading-relaxed max-w-xs">
              Asociación de Deportes Ecuestres de Santa Cruz, Bolivia.<br />
              Promoviendo el deporte ecuestre en el departamento.
            </p>
          </div>

          {/* Competencias */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Competencias
            </h4>
            <ul className="space-y-2">
              {[
                { href: '/ranking',    label: 'Ranking'    },
                { href: '/cds',        label: 'CDS'        },
                { href: '/calendario', label: 'Calendario' },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href}
                    className="text-sm text-gray-600 hover:text-green-700 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Institución */}
          <div>
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              Institución
            </h4>
            <ul className="space-y-2">
              {[
                { href: '/nosotros',  label: 'Nosotros'  },
                { href: '/noticias',  label: 'Noticias'  },
                { href: '/login',     label: 'Portal'    },
              ].map(l => (
                <li key={l.href}>
                  <Link href={l.href}
                    className="text-sm text-gray-600 hover:text-green-700 transition-colors">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-xs text-gray-400">
            © {year} ADESCRUZ. Todos los derechos reservados.
          </p>
          <p className="text-xs text-gray-300">
            Santa Cruz de la Sierra, Bolivia
          </p>
        </div>
      </div>
    </footer>
  )
}
