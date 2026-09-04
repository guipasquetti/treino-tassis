import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Caption, Loading } from '@/components/ui';
import { signIn, signUp } from '@/services/authService';
import { finalizarCadastroConvite, obterConvite, type ConviteInfo } from '@/services/conviteService';
import { FontSize, Palette, Radius, Spacing } from '@/theme';

/**
 * Tela pública de convite — sem login, só resolve o acesso (§12, 04/set). A anamnese e a
 * escolha de plano acontecem DENTRO do app, autenticado (ver `OnboardingAnamnese` em
 * `aluno/_layout.tsx`) — aqui é só entrar ou criar conta.
 *
 * Lead pode já ter conta (outro profissional, ou de antes): `obter_convite` diz se o e-mail
 * DESTE convite já existe (`contaExistente`) — não é busca aberta, só responde sobre o único
 * e-mail que o token já carrega. Se já existe, mostra "Entrar"; senão, "Criar conta".
 * `finalizar_cadastro_convite` funciona igual nos dois casos: só confere que a sessão
 * autenticada bate com o e-mail do convite e cria a assinatura pra este profissional.
 *
 * O token na URL é o único segredo desse fluxo (a RPC de leitura é pública por design — ver
 * `conviteService.ts` e §0/§16 do HANDOFF).
 */

type Etapa = 'carregando' | 'acesso' | 'concluindo' | 'invalido';

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
      setEtapa('acesso');
    });
  }, [token]);

  async function concluir() {
    if (!token) return;
    setEtapa('concluindo');
    const ok = await finalizarCadastroConvite(token);
    if (!ok) {
      setErro('Não consegui vincular sua conta a este convite. Fale com seu profissional.');
      setEtapa('acesso');
      return;
    }
    router.replace('/aluno');
  }

  async function acessar() {
    if (!token || !convite) return;
    if (!convite.contaExistente && senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      if (convite.contaExistente) {
        await signIn(convite.email, senha);
      } else {
        const { session } = await signUp(convite.email, senha, convite.nome);
        if (!session) {
          setErro('Conta criada — confirme seu e-mail e depois entre normalmente pra concluir.');
          return;
        }
      }
      await concluir();
    } catch (e) {
      setErro(
        convite.contaExistente
          ? 'Senha incorreta.'
          : e instanceof Error
            ? e.message
            : 'Não consegui criar seu acesso.'
      );
      setEtapa('acesso');
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

  const contaExistente = convite?.contaExistente ?? false;

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.brand}>
          <Body style={styles.titulo}>
            {contaExistente ? 'Bem-vindo de volta' : 'Bem-vindo'}, {convite?.nome.split(' ')[0]}
          </Body>
          <Caption>
            {contaExistente
              ? 'Entra com sua senha de sempre pra vincular esse novo profissional.'
              : 'Crie uma senha pra acessar o app — a anamnese e o plano vêm em seguida.'}
          </Caption>
        </View>
        <View style={styles.form}>
          <Caption>{convite?.email}</Caption>
          <TextInput
            style={styles.senhaInput}
            value={senha}
            onChangeText={setSenha}
            placeholder={contaExistente ? 'Sua senha' : 'Senha (mín. 8 caracteres)'}
            placeholderTextColor={Palette.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoComplete={contaExistente ? 'current-password' : 'new-password'}
            onSubmitEditing={acessar}
          />
          {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}
          <Button label={contaExistente ? 'Entrar' : 'Criar acesso'} onPress={acessar} loading={enviando} />
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
