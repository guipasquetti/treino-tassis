import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Card, Screen, SectionTitle } from '@/components/ui';
import { listarAlunos, listarMeusProfissionais } from '@/services/professionalService';
import { signOut } from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { Palette, Spacing } from '@/theme';

type Vinculo = { titulo: string; detalhe: string };

export function PerfilScreen() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const isProfessional = useAuthStore((s) => s.isProfessional);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);

  useEffect(() => {
    if (!user) return;
    if (isProfessional) {
      listarAlunos(user.id).then((alunos) =>
        setVinculos(
          alunos.map((a) => ({
            titulo: a.nome,
            detalhe: `${a.planoNome ?? 'Sem plano'} · ${a.status}`,
          })),
        ),
      );
    } else {
      listarMeusProfissionais(user.id).then((profissionais) =>
        setVinculos(
          profissionais.map((p) => ({
            titulo: p.nome,
            detalhe: p.planoNome ?? 'Sem plano definido',
          })),
        ),
      );
    }
  }, [user?.id, isProfessional]);

  const dados = [
    { label: 'E-mail', valor: profile?.email ?? '—' },
    { label: 'Telefone', valor: profile?.telefone || '—' },
    { label: 'Peso', valor: profile?.peso_kg ? `${profile.peso_kg} kg` : '—' },
    { label: 'Altura', valor: profile?.altura_cm ? `${profile.altura_cm} cm` : '—' },
  ];

  return (
    <Screen title="Perfil" subtitle={isProfessional ? 'Profissional' : 'Aluno'}>
      <Card>
        <Body>{profile?.nome || 'Sem nome'}</Body>
        {dados.map((d) => (
          <View key={d.label} style={styles.row}>
            <Caption>{d.label}</Caption>
            <Caption color={Palette.text}>{d.valor}</Caption>
          </View>
        ))}
      </Card>

      <SectionTitle>{isProfessional ? 'Alunos' : 'Meus profissionais'}</SectionTitle>
      {vinculos.length ? (
        vinculos.map((v, i) => (
          <Card key={i}>
            <Body>{v.titulo}</Body>
            <Caption>{v.detalhe}</Caption>
          </Card>
        ))
      ) : (
        <Card>
          <Caption>{isProfessional ? 'Nenhum aluno vinculado.' : 'Nenhum profissional vinculado.'}</Caption>
        </Card>
      )}

      <Button label="Sair" variant="ghost" color={Palette.danger} onPress={() => signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
});
