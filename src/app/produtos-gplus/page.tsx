import GPlusManager from "@/components/GPlusManager";
import GPlusLoginGate from "@/components/GPlusLoginGate";
import { getGPlusSession } from "@/lib/gplus-actions";

export const dynamic = 'force-dynamic';

export default async function GPlusPage() {
  const session = await getGPlusSession();

  if (!session) {
    return <GPlusLoginGate />;
  }

  return <GPlusManager session={session} />;
}
