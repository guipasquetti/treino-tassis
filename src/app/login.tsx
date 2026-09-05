import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Caption, Pill } from '@/components/ui';
import { signIn } from '@/services/authService';
import { FontSize, Palette, Radius, RoleColors, Spacing, type Role } from '@/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [modo, setModo] = useState<Role>('aluno');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const cor = RoleColors[modo];

  async function entrar() {
    setErro(null);
    setEntrando(true);
    try {
      await signIn(email.trim(), senha);
    } catch (e) {
      setErro(
        e instanceof Error && e.message === 'Invalid login credentials'
          ? 'E-mail ou senha incorretos.'
          : e instanceof Error
            ? e.message
            : 'Não foi possível entrar.',
      );
    } finally {
      setEntrando(false);
    }
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.container}>
        <View style={styles.brand}>
          <Body style={styles.titulo}>Treino</Body>
          <Caption>Seu plano, sua execução, sua evolução.</Caption>
        </View>

        <View style={styles.switchTrack}>
          <Pill label="Aluno" active={modo === 'aluno'} color={RoleColors.aluno} onPress={() => setModo('aluno')} />
          <Pill
            label="Profissional"
            active={modo === 'profissional'}
            color={RoleColors.profissional}
            onPress={() => setModo('profissional')}
          />
        </View>

        <View style={styles.form}>
          <TextInput
            style={styles.input}
            placeholder="E-mail"
            placeholderTextColor={Palette.textTertiary}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Senha"
            placeholderTextColor={Palette.textTertiary}
            secureTextEntry
            autoCapitalize="none"
            autoComplete="current-password"
            value={senha}
            onChangeText={setSenha}
            onSubmitEditing={entrar}
          />

          {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}

          <Button label="Entrar" color={cor} onPress={entrar} loading={entrando} />

          <Pressable style={styles.criarConta} onPress={() => router.push('/cadastro-profissional')} hitSlop={8}>
            <Caption color={cor}>Não tem cadastro? Criar conta</Caption>
          </Pressable>
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
  brand: {
    gap: Spacing.xs,
  },
  titulo: {
    fontSize: FontSize.display,
    fontWeight: '800',
    letterSpacing: -1,
  },
  switchTrack: {
    flexDirection: 'row',
    alignSelf: 'center',
    backgroundColor: Palette.surface,
    borderRadius: Radius.pill,
    padding: 4,
    gap: 4,
  },
  form: {
    gap: Spacing.md,
  },
  input: {
    backgroundColor: Palette.surface,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
    color: Palette.text,
    fontSize: FontSize.body,
  },
  criarConta: {
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
});
