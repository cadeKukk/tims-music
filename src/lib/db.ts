import 'server-only';
import { createClient } from '@supabase/supabase-js';

// All tables have RLS on with no public policies; only this server client (secret key) can read them.
export const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false, autoRefreshToken: false },
});
