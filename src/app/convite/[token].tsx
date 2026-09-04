import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Caption, Card, Field, Loading, Screen, SectionTitle } from '@/components/ui';
import { SECOES_ANAMNESE, type RespostasAnamnese } from '@/models/anamnese';
import { signUp } from '@/services/authService';
import {
  finalizarCadastroConvite,
  obterConvite,
  submeterAnamnese,
  type ConviteInfo,
} from '@/services/conviteService';
import { FontSize, Palette, Radius, Spacing } from '@/theme';

/**
 * Tela pública de convite — sem login. Espelha o fluxo do protótipo
 * (`prototype/index.html`, `iniciarFluxoConvite`/`enviarAnamnese`/`criarSenhaConvite`):
 * anamnese numa página só (sem wizard, sem campo obrigatório) → cria senha → vira conta.
 *
 * O token na URL é o único segredo desse fluxo (as RPCs de leitura/escrita são públicas
 * por design — ver `conviteService.ts` e §0/§16 do HANDOFF). Nada aqui grava as respostas
 * fora do Supabase: sem AsyncStorage, sem persistência local do conteúdo de saúde.
 */

type Etapa = 'carregando' | 'formulario' | 'senha' | 'concluindo' | 'invalido';

export default function ConviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();

  const [etapa, setEtapa] = useState<Etapa>('carregando');
  const [convite, setConvite] = useState<ConviteInfo | null>(null);
  const [respostas, setRespostas] = useState<RespostasAnamnese>({});
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
      setEtapa(info.status === 'preenchido' ? 'senha' : 'formulario');
    });
  }, [token]);

  const atualizarResposta = useCallback((id: string, valor: string) => {
    setRespostas((atual) => ({ ...atual, [id]: valor }));
  }, []);

  async function enviarRespostas() {
    if (!token) return;
    setErro(null);
    setEnviando(true);
    try {
      const ok = await submeterAnamnese(token, respostas);
      if (!ok) {
        setEtapa('invalido');
        return;
      }
      setEtapa('senha');
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui enviar suas respostas.');
    } finally {
      setEnviando(false);
    }
  }

  async function criarAcesso() {
    if (!token || !convite) return;
    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const nome = respostas.nome_completo || convite.nome;
      const { session } = await signUp(convite.email, senha, nome);
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

  if (etapa === 'senha') {
    return (
      <SafeAreaView style={styles.screen}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.container}>
          <View style={styles.brand}>
            <Body style={styles.titulo}>Quase lá</Body>
            <Caption>Crie uma senha pra acessar seu treino e sua dieta.</Caption>
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

  return (
    <Screen title="Anamnese" subtitle={convite ? `Convite de ${convite.nome}` : undefined}>
      <Card>
        <Caption>
          Suas respostas são usadas só pelo profissional que te convidou, pra montar seu plano.
          Nenhum campo é obrigatório — responda o que fizer sentido.
        </Caption>
      </Card>

      {SECOES_ANAMNESE.map((secao) => (
        <Card key={secao.titulo}>
          <SectionTitle>{secao.titulo}</SectionTitle>
          {secao.campos.map((campo) => (
            <Field
              key={campo.id}
              label={campo.label}
              value={respostas[campo.id] ?? ''}
              onChangeText={(v) => atualizarResposta(campo.id, v)}
              placeholder={campo.placeholder}
              keyboardType={campo.tipo === 'numero' ? 'decimal-pad' : 'default'}
              multiline={campo.tipo === 'area'}
            />
          ))}
        </Card>
      ))}

      {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}
      <Button label="Enviar respostas" onPress={enviarRespostas} loading={enviando} />
    </Screen>
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
