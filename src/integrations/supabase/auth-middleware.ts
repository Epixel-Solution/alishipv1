import { supabase } from './client'

export async function requireAuth() {
  const { data: { session }, error } = await supabase.auth.getSession()
  if (error || !session?.user) throw new Error('Unauthorized')
  return {
    supabase,
    userId: session.user.id,
    user: session.user,
  }
}