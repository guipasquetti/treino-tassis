import { supabase } from "@/lib/supabase";
import type { Tables } from "@/models/database.types";

export type ClientHomeData = {
  subscriptions: (Tables<"subscriptions"> & {
    professionalName: string;
    planName: string | null;
  })[];
  activePlan: Tables<"plans"> | null;
  workoutLogCount: number;
};

export async function getClientHome(userId: string): Promise<ClientHomeData> {
  const [{ data: subs }, { data: plan }, { count }] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("patient_id", userId).eq("status", "ativa"),
    supabase
      .from("plans")
      .select("*")
      .eq("client_id", userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("workout_logs").select("*", { count: "exact", head: true }).eq("client_id", userId),
  ]);

  const subscriptions = subs ?? [];
  const professionalIds = subscriptions.map((s) => s.professional_id);
  const planIds = subscriptions.map((s) => s.plan_id).filter((id): id is string => !!id);

  const [{ data: professionalProfiles }, { data: plans }] = await Promise.all([
    professionalIds.length
      ? supabase.from("profiles").select("id, nome").in("id", professionalIds)
      : Promise.resolve({ data: [] as Pick<Tables<"profiles">, "id" | "nome">[] }),
    planIds.length
      ? supabase.from("professional_plans").select("id, nome").in("id", planIds)
      : Promise.resolve({ data: [] as Pick<Tables<"professional_plans">, "id" | "nome">[] }),
  ]);

  return {
    subscriptions: subscriptions.map((s) => ({
      ...s,
      professionalName: professionalProfiles?.find((p) => p.id === s.professional_id)?.nome || "Profissional",
      planName: plans?.find((p) => p.id === s.plan_id)?.nome ?? null,
    })),
    activePlan: plan ?? null,
    workoutLogCount: count ?? 0,
  };
}

export type ProfessionalHomeClient = {
  subscriptionId: string;
  clientId: string;
  clientName: string;
  planName: string | null;
  status: string;
};

export type ProfessionalHomeData = {
  clients: ProfessionalHomeClient[];
};

export async function getProfessionalHome(userId: string): Promise<ProfessionalHomeData> {
  const { data: subs } = await supabase.from("subscriptions").select("*").eq("professional_id", userId);

  const subscriptions = subs ?? [];
  const clientIds = subscriptions.map((s) => s.patient_id);
  const planIds = subscriptions.map((s) => s.plan_id).filter((id): id is string => !!id);

  const [{ data: clientProfiles }, { data: plans }] = await Promise.all([
    clientIds.length
      ? supabase.from("profiles").select("id, nome").in("id", clientIds)
      : Promise.resolve({ data: [] as Pick<Tables<"profiles">, "id" | "nome">[] }),
    planIds.length
      ? supabase.from("professional_plans").select("id, nome").in("id", planIds)
      : Promise.resolve({ data: [] as Pick<Tables<"professional_plans">, "id" | "nome">[] }),
  ]);

  return {
    clients: subscriptions.map((s) => ({
      subscriptionId: s.id,
      clientId: s.patient_id,
      clientName: clientProfiles?.find((p) => p.id === s.patient_id)?.nome || "Aluno",
      planName: plans?.find((p) => p.id === s.plan_id)?.nome ?? null,
      status: s.status,
    })),
  };
}
