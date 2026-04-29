import { createClient } from "@supabase/supabase-js";

const defaultSupabaseUrl = "https://zzrqzdvrndmqbuksdzgq.supabase.co";
const defaultSupabaseAnonKey = "sb_publishable_jmGkC7FZ8N2HbxMtVSC10Q_hv5nmHcD";

const envSupabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const envSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const supabaseUrl = envSupabaseUrl?.trim() || defaultSupabaseUrl;
const supabaseAnonKey = envSupabaseAnonKey?.trim() || defaultSupabaseAnonKey;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const supabaseConfigStatus = {
  hasUrl: Boolean(supabaseUrl),
  hasAnonKey: Boolean(supabaseAnonKey),
  usingBundledDefaults: !envSupabaseUrl || !envSupabaseAnonKey
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase 환경변수가 설정되지 않았습니다. localStorage fallback을 사용합니다.");
  }
  return supabase;
}
