import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = "https://brnttskrqotyymuptxdv.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ksVvFQMPC8ihwlqOeIbiLA_wA91OPO7";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);