import type { Database } from "@/models/database.types";
import { supabase } from "@/lib/supabase";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(email: string, password: string, nome: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { nome } },
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data;
}

export async function isProfessional(userId: string): Promise<boolean> {
  const { data } = await supabase.from("professionals").select("id").eq("id", userId).maybeSingle();
  return data !== null;
}
