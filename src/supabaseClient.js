import { createClient } from '@supabase/supabase-js'

// Substitua pelos valores que você copiou do painel
const supabaseUrl = 'https://fidlyctrcijnuzuyhdrb.supabase.co'
const supabaseKey = 'sb_publishable_PJBBgu-6_aFU295C_Wr4Fg_EvledVnk'

export const supabase = createClient(supabaseUrl, supabaseKey)