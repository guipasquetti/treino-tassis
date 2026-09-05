import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { Body, Button, Caption, Card, Field, Screen, SectionTitle } from '@/components/ui';
import { formatarDataHora } from '@/models/domain';
import { listarAlunos, listarMeusProfissionais } from '@/services/professionalService';
import { atualizarPerfil, signOut } from '@/services/authService';
import { proximaTeleconsulta, type Teleconsulta } from '@/services/teleconsultaService';
import { useAuthStore } from '@/store/authStore';
import { Palette, Spacing } from '@/theme';

type Vinculo = { titulo: string; detalhe: string };

export function PerfilScreen() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const setProfile = useAuthStore((s) => s.setProfile);
  const isProfessional = useAuthStore((s) => s.isProfessional);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [proximaConsulta, setProximaConsulta] = useState<Teleconsulta | null>(null);

  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState('');
  const [telefone, setTelefone] = useState('');
  const [dataNascimento, setDataNascimento] = useState('');
  const [peso, setPeso] = useState('');
  const [altura, setAltura] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

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
      proximaTeleconsulta(user.id).then(setProximaConsulta);
    }
  }, [user?.id, isProfessional]);

  function iniciarEdicao() {
    setNome(profile?.nome ?? '');
    setTelefone(profile?.telefone ?? '');
    setDataNascimento(profile?.data_nascimento ?? '');
    setPeso(profile?.peso_kg != null ? String(profile.peso_kg) : '');
    setAltura(profile?.altura_cm != null ? String(profile.altura_cm) : '');
    setErro(null);
    setEditando(true);
  }

  async function salvar() {
    if (!user) return;
    if (!nome.trim()) {
      setErro('Nome não pode ficar em branco.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const pesoNumero = peso.replace(',', '.');
      const alturaNumero = altura.replace(',', '.');
      const atualizado = await atualizarPerfil(user.id, {
        nome: nome.trim(),
        telefone: telefone.trim() || null,
        data_nascimento: dataNascimento.trim() || null,
        peso_kg: pesoNumero && !Number.isNaN(Number(pesoNumero)) ? Number(pesoNumero) : null,
        altura_cm: alturaNumero && !Number.isNaN(Number(alturaNumero)) ? Number(alturaNumero) : null,
      });
      setProfile(atualizado);
      setEditando(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar o perfil.');
    } finally {
      setSalvando(false);
    }
  }

  const dados = [
    { label: 'E-mail', valor: profile?.email ?? '—' },
    { label: 'Telefone', valor: profile?.telefone || '—' },
    { label: 'Data de nascimento', valor: profile?.data_nascimento || '—' },
    { label: 'Peso', valor: profile?.peso_kg ? `${profile.peso_kg} kg` : '—' },
    { label: 'Altura', valor: profile?.altura_cm ? `${profile.altura_cm} cm` : '—' },
  ];

  return (
    <Screen title="Perfil" subtitle={isProfessional ? 'Profissional' : 'Aluno'}>
      <Card>
        {editando ? (
          <>
            <Field label="Nome" value={nome} onChangeText={setNome} placeholder="Seu nome" />
            <Field
              label="Telefone"
              value={telefone}
              onChangeText={setTelefone}
              placeholder="(11) 99999-9999"
              keyboardType="default"
            />
            <Field
              label="Data de nascimento"
              value={dataNascimento}
              onChangeText={setDataNascimento}
              placeholder="AAAA-MM-DD"
            />
            <View style={styles.rowFields}>
              <Field label="Peso (kg)" value={peso} onChangeText={setPeso} keyboardType="decimal-pad" />
              <Field label="Altura (cm)" value={altura} onChangeText={setAltura} keyboardType="decimal-pad" />
            </View>
            {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}
            <View style={styles.acoes}>
              <Button label="Cancelar" variant="ghost" onPress={() => setEditando(false)} disabled={salvando} />
              <Button label="Salvar" onPress={salvar} loading={salvando} />
            </View>
          </>
        ) : (
          <>
            <View style={styles.cabecalho}>
              <Body>{profile?.nome || 'Sem nome'}</Body>
              <Button label="Editar" variant="ghost" onPress={iniciarEdicao} />
            </View>
            {dados.map((d) => (
              <View key={d.label} style={styles.row}>
                <Caption>{d.label}</Caption>
                <Caption color={Palette.text}>{d.valor}</Caption>
              </View>
            ))}
          </>
        )}
      </Card>

      {!isProfessional && proximaConsulta ? (
        <Card>
          <SectionTitle>Próxima consulta</SectionTitle>
          <Body>{formatarDataHora(proximaConsulta.data_hora)}</Body>
          <Button
            label="Entrar na chamada"
            onPress={() => Linking.openURL(proximaConsulta.link_meet)}
          />
        </Card>
      ) : null}

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
  cabecalho: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  rowFields: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  acoes: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
});
