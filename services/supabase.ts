import { createClient } from '@supabase/supabase-js';
// Use ../ to look outside the services folder for constants
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);