import { Redirect } from 'expo-router';

import { Loading } from '@/components/ui';
import { useAuthStore } from '@/store/authStore';

/**
 * Rota "/" — não tem tela própria, só decide o destino conforme sessão e papel.
 * Declarativo de propósito: o redirect por efeito no _layout depende de timing e
 * deixava essa rota cair no "Unmatched Route" no primeiro render.
 */
export default function Index() {
  const { session, isLoading, profileLoaded, isProfessional } = useAuthStore();

  if (isLoading) return <Loading />;
  if (!session) return <Redirect href="/login" />;
  if (!profileLoaded) return <Loading />;
  return <Redirect href={isProfessional ? '/pro' : '/aluno'} />;
}
