import type { Session, User } from "@supabase/supabase-js";
import { create } from "zustand";

import { getProfile, isProfessional, type Profile } from "@/services/authService";
import { supabase } from "@/lib/supabase";

interface AuthStore {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isProfessional: boolean;
  isLoading: boolean;
  /** false enquanto profile/professional do usuário logado ainda não foram buscados. */
  profileLoaded: boolean;
  initialize: () => Promise<void>;
}

async function loadProfile(userId: string) {
  const [profile, professional] = await Promise.all([getProfile(userId), isProfessional(userId)]);
  return { profile, professional };
}

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  profile: null,
  isProfessional: false,
  isLoading: true,
  profileLoaded: false,

  initialize: async () => {
    set({ isLoading: true });
    const {
      data: { session },
    } = await supabase.auth.getSession();
    set({ session, user: session?.user ?? null });

    if (session?.user) {
      const { profile, professional } = await loadProfile(session.user.id);
      set({ profile, isProfessional: professional });
    }

    // O callback não pode ser async/await chamadas supabase direto (lock interno de
    // auth) — deferimos o fetch de profile pra fora com setTimeout, mesmo padrão do OLI.
    supabase.auth.onAuthStateChange((_event, session) => {
      const hadUser = !!session?.user;
      set({ session, user: session?.user ?? null, profileLoaded: !hadUser });

      if (session?.user) {
        const userId = session.user.id;
        setTimeout(() => {
          void (async () => {
            const { profile, professional } = await loadProfile(userId);
            set({ profile, isProfessional: professional, profileLoaded: true });
          })();
        }, 0);
      } else {
        set({ profile: null, isProfessional: false });
      }
    });

    set({ isLoading: false, profileLoaded: true });
  },
}));
