import { createContext, useContext, type ReactNode } from 'react';

import { RoleColors } from '@/theme';

const RoleColorContext = createContext<string>(RoleColors.aluno);

/** Define a cor de destaque padrão (Button/Pill sem `color` explícito) pra tudo dentro. */
export function RoleThemeProvider({ color, children }: { color: string; children: ReactNode }) {
  return <RoleColorContext.Provider value={color}>{children}</RoleColorContext.Provider>;
}

export function useRoleColor(): string {
  return useContext(RoleColorContext);
}
