import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

import type { Database } from "@/models/database.types";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// No SSR do Expo web (output:"static") o módulo é avaliado em Node, sem `window`.
// AsyncStorage.web chama localStorage direto e derruba o processo. Guard só pra web.
const webSafeStorage = {
  getItem: async (k: string) => (typeof window === "undefined" ? null : window.localStorage.getItem(k)),
  setItem: async (k: string, v: string) => {
    if (typeof window !== "undefined") window.localStorage.setItem(k, v);
  },
  removeItem: async (k: string) => {
    if (typeof window !== "undefined") window.localStorage.removeItem(k);
  },
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: Platform.OS === "web" ? webSafeStorage : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Requisito oficial do Supabase para React Native: sem isso, o timer de
// autoRefreshToken fica sujeito à suspensão de JS em background pelo SO —
// o refresh às vezes falha ao voltar do background, dispara SIGNED_OUT e
// derruba pro login mesmo com sessão/refresh token válidos.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
