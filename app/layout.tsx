import type { Metadata } from 'next'
import { Toaster } from 'react-hot-toast'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'ADESCRUZ — Deportes Ecuestres Santa Cruz',
    template: '%s | ADESCRUZ',
  },
  description:
    'Asociación de Deportes Ecuestres de Santa Cruz, Bolivia. Ranking oficial de salto ecuestre, resultados y calendario de competencias.',
  keywords: ['ecuestre', 'salto', 'Santa Cruz', 'Bolivia', 'ADESCRUZ', 'ranking', 'CDS'],
  openGraph: {
    type: 'website',
    locale: 'es_BO',
    siteName: 'ADESCRUZ',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              borderRadius: '12px',
              fontFamily: 'Inter, sans-serif',
              fontSize: '14px',
            },
            success: {
              iconTheme: { primary: '#1a4731', secondary: '#fff' },
            },
          }}
        />
      </body>
    </html>
  )
}
