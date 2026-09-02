import { ClientHome } from "@/components/client-home";
import { ProfessionalHome } from "@/components/professional-home";
import { useAuthStore } from "@/store/authStore";

export default function HomeScreen() {
  const isProfessional = useAuthStore((s) => s.isProfessional);
  return isProfessional ? <ProfessionalHome /> : <ClientHome />;
}
