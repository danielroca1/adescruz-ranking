import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Simple header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-green-700 flex items-center justify-center">
              <span className="text-white text-xs font-bold">A</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">ADESCRUZ</span>
          </Link>
        </div>
      </header>

      {/* Content centered */}
      <main className="flex-1 flex items-center justify-center p-4">
        {children}
      </main>

      <footer className="py-4 text-center text-xs text-gray-400">
        © {new Date().getFullYear()} ADESCRUZ
      </footer>
    </div>
  )
}
