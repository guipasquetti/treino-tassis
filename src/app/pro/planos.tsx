import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Body, Button, Caption, Card, EmptyState, Loading, Screen, SectionTitle } from '@/components/ui';
import {
  alternarPlanoAtivo,
  atualizarPlano,
  criarPlano,
  listarPlanos,
  type PlanoProfissional,
} from '@/services/professionalService';
import { useAuthStore } from '@/store/authStore';
import { FontSize, Palette, Radius, RoleColors, Spacing } from '@/theme';

function formatarPreco(centavos: number | null): string {
  if (centavos === null) return 'Sem preço definido';
  return `R$ ${(centavos / 100).toFixed(2).replace('.', ',')}`;
}

export default function PlanosScreen() {
  const user = useAuthStore((s) => s.user);
  const [planos, setPlanos] = useState<PlanoProfissional[]>([]);
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);

  const carregar = useCallback(async () => {
    if (!user) return;
    setPlanos(await listarPlanos(user.id));
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPlanos([]);
      setLoading(true);
      return;
    }
    carregar();
  }, [user, carregar]);

  if (loading || !user) return <Loading />;

  return (
    <Screen title="Planos" subtitle="O que você vende aos alunos">
      {planos.length ? (
        planos.map((plano) => <PlanoCard key={plano.id} plano={plano} onMudou={carregar} />)
      ) : (
        <EmptyState text="Nenhum plano criado. Crie o primeiro para poder vincular alunos a ele." />
      )}

      {criando ? (
        <NovoPlanoForm
          professionalId={user!.id}
          onCancelar={() => setCriando(false)}
          onCriado={async () => {
            setCriando(false);
            await carregar();
          }}
        />
      ) : (
        <Button label="Novo plano" onPress={() => setCriando(true)} />
      )}
    </Screen>
  );
}

type PlanoFormValues = {
  nome: string;
  preco: string;
  periodicidade: string;
  incluiTreino: boolean;
  incluiDieta: boolean;
};

function valoresIniciais(plano?: PlanoProfissional): PlanoFormValues {
  return {
    nome: plano?.nome ?? '',
    preco: plano ? (plano.preco_centavos !== null ? String(plano.preco_centavos / 100) : '') : '',
    periodicidade: plano?.periodicidade ?? 'mensal',
    incluiTreino: plano?.inclui_treino ?? true,
    incluiDieta: plano?.inclui_dieta ?? false,
  };
}

function PlanoCard({ plano, onMudou }: { plano: PlanoProfissional; onMudou: () => Promise<void> }) {
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);

  async function alternar(ativo: boolean) {
    setSalvando(true);
    try {
      await alternarPlanoAtivo(plano.id, ativo);
      await onMudou();
    } finally {
      setSalvando(false);
    }
  }

  if (editando) {
    return (
      <PlanoForm
        titulo="Editar plano"
        valores={valoresIniciais(plano)}
        onCancelar={() => setEditando(false)}
        onSalvar={async (dados) => {
          await atualizarPlano(plano.id, dados);
          setEditando(false);
          await onMudou();
        }}
      />
    );
  }

  const modulos = [
    plano.inclui_treino ? 'Treino' : null,
    plano.inclui_dieta ? 'Dieta' : null,
  ].filter(Boolean);

  return (
    <Card style={!plano.ativo ? styles.inativo : undefined}>
      <View style={styles.header}>
        <Body style={styles.nome}>{plano.nome}</Body>
        <Switch
          value={plano.ativo}
          disabled={salvando}
          onValueChange={alternar}
          trackColor={{ true: Palette.green, false: Palette.surfaceElevated }}
        />
      </View>
      <Caption color={Palette.text}>
        {formatarPreco(plano.preco_centavos)} · {plano.periodicidade}
      </Caption>
      <View style={styles.header}>
        <Caption>{modulos.length ? modulos.join(' + ') : 'Nenhum módulo incluído'}</Caption>
        <Pressable onPress={() => setEditando(true)} hitSlop={8}>
          <Caption color={RoleColors.profissional}>Editar</Caption>
        </Pressable>
      </View>
    </Card>
  );
}

function NovoPlanoForm({
  professionalId,
  onCriado,
  onCancelar,
}: {
  professionalId: string;
  onCriado: () => Promise<void>;
  onCancelar: () => void;
}) {
  return (
    <PlanoForm
      titulo="Novo plano"
      valores={valoresIniciais()}
      onCancelar={onCancelar}
      onSalvar={async (dados) => {
        await criarPlano({ ...dados, professional_id: professionalId });
        await onCriado();
      }}
    />
  );
}

function PlanoForm({
  titulo,
  valores,
  onSalvar,
  onCancelar,
}: {
  titulo: string;
  valores: PlanoFormValues;
  onSalvar: (dados: {
    nome: string;
    preco_centavos: number | null;
    periodicidade: string;
    inclui_treino: boolean;
    inclui_dieta: boolean;
  }) => Promise<void>;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState(valores.nome);
  const [preco, setPreco] = useState(valores.preco);
  const [periodicidade, setPeriodicidade] = useState(valores.periodicidade);
  const [incluiTreino, setIncluiTreino] = useState(valores.incluiTreino);
  const [incluiDieta, setIncluiDieta] = useState(valores.incluiDieta);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function salvar() {
    if (!nome.trim()) {
      setErro('Dê um nome ao plano.');
      return;
    }
    setErro(null);
    setSalvando(true);
    try {
      const precoNumero = Number(preco.replace(',', '.'));
      await onSalvar({
        nome: nome.trim(),
        inclui_treino: incluiTreino,
        inclui_dieta: incluiDieta,
        preco_centavos: preco && !Number.isNaN(precoNumero) ? Math.round(precoNumero * 100) : null,
        periodicidade,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não consegui salvar o plano.');
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Card>
      <SectionTitle>{titulo}</SectionTitle>

      <TextInput
        style={styles.input}
        placeholder="Nome (ex.: Dieta + Treino)"
        placeholderTextColor={Palette.textTertiary}
        value={nome}
        onChangeText={setNome}
      />
      <TextInput
        style={styles.input}
        placeholder="Preço (ex.: 350)"
        placeholderTextColor={Palette.textTertiary}
        keyboardType="decimal-pad"
        value={preco}
        onChangeText={setPreco}
      />
      <TextInput
        style={styles.input}
        placeholder="Periodicidade"
        placeholderTextColor={Palette.textTertiary}
        value={periodicidade}
        onChangeText={setPeriodicidade}
      />

      <View style={styles.switchRow}>
        <Caption color={Palette.text}>Inclui treino</Caption>
        <Switch
          value={incluiTreino}
          onValueChange={setIncluiTreino}
          trackColor={{ true: Palette.green, false: Palette.surfaceElevated }}
        />
      </View>
      <View style={styles.switchRow}>
        <Caption color={Palette.text}>Inclui dieta</Caption>
        <Switch
          value={incluiDieta}
          onValueChange={setIncluiDieta}
          trackColor={{ true: Palette.green, false: Palette.surfaceElevated }}
        />
      </View>

      {erro ? <Caption color={Palette.danger}>{erro}</Caption> : null}

      <Button label="Salvar plano" onPress={salvar} loading={salvando} />
      <Button label="Cancelar" variant="ghost" onPress={onCancelar} />
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nome: {
    flex: 1,
  },
  inativo: {
    opacity: 0.5,
  },
  input: {
    backgroundColor: Palette.surfaceElevated,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    color: Palette.text,
    fontSize: FontSize.body,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
