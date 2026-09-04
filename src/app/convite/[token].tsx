import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Caption, Loading } from '@/components/ui';
import { signUp } from '@/services/authService';
import { finalizarCadastroConvite, obterConvite, type ConviteInfo } from '@/services/conviteService';
import { FontSize, Palette, Radius, Spacing } from '@/theme';

/**
 * Tela pública de convite — sem login, só cria a conta (§12, 04/set). A anamnese e a escolha
 * de plano deixaram de acontecer aqui: acontecem DENTRO do app, autenticado, logo depois do
 * primeiro login (ver `OnboardingAnamnese` em `aluno/_layout.tsx`) — o lead baixa o app,
 * cria a conta, entra, e só então responde tudo, sem sair do app.
 *
 * O token na URL é o único segredo desse fluxo (a RPC de leitura é pública por design — ver
 * `conviteService.ts` e §0/§16 do HANDOFF).
 */

type Etapa = 'carregando' | 'senha' | 'concluindo' | 'invalido';

export default function ConviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const [etapa, setEtapa] = useState<Etapa>('carregando');
  const [convite, setConvite] = useState<ConviteInfo | null>(null);
  const [senha, setSenha] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    obterConvite(token).then((info) => {
      if (!info || info.status === 'concluido') {
        setEtapa('invalido');
        return;
      }
      setConvite(info);
      setEtapa('senha');
    });
  }, [token]);

  async function criarAcesso() {
    if (!token || !convite) return;
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const { session } = await signUp(convite.email, senha, convite.nome);
      if (!session) {
        setErro('Conta criada — confirme seu e-mail e depois entre normalmente pra concluir.');
        return;
      }
      setEtapa('concluindo');
      const ok = await finalizarCadastroConvite(token);
      if (!ok) {
        setErro('Não consegui vincular sua conta a este convite. Fale com seu profissional.');
        setEtapa('senha');
        return;
      }
      router.replace('/aluno');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui criar seu acesso.');
      setEtapa('senha');
    } finally {
      setEnviando(false);
    }
  }

  if (etapa === 'carregando' || etapa === 'concluindo') return <Loading />;

  if (etapa === 'invalido') {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.centro}>
          <Body style={styles.titulo}>Link indisponível</Body>
          <Caption>
            Este convite não existe, já foi usado, ou o link expirou. Fale com seu profissional
            pra pedir um novo.
          </Caption>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.brand}>
          <Body style={styles.titulo}>Bem-vindo, {convite?.nome.split(' ')[0]}</Body>
          <Caption>Crie uma senha pra acessar o app — a anamnese e o plano vêm em seguida.</Caption>
        </View>
        <View style={styles.form}>
          <Caption>{convite?.email}</Caption>
          <TextInput
            style={styles.senhaInput}
            value={senha}
            onChangeText={setSenha}
            placeholder="Senha (mín. 8 caracteres)"
            placeholderTextColor={Palette.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="new-password"
            onSubmitEditing={criarAcesso}
          />
          {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}
          <Button label="Criar acesso" onPress={criarAcesso} loading={enviando} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xxl,
  },
  centro: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  brand: {
    gap: Spacing.xs,
  },
  titulo: {
    fontSize: FontSize.display,
    fontWeight: '800',
    letterSpacing: -1,
  },
  form: {
    gap: Spacing.md,
  },
  senhaInput: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    color: Palette.text,
    fontSize: FontSize.body,
  },
});
