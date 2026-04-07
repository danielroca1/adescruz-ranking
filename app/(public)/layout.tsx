import { createClient } from '@/lib/supabase/server'
import Navbar from '@/components/Navbar'
import Footer from '@/components/Footer'

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let profile = null
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role, avatar_url')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar user={profile} />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
