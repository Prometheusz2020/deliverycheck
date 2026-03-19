import { getSessionAdmin } from "@/lib/auth-actions";
import RestaurantPortal from "@/components/RestaurantPortal";
import AdminLoginGate from "@/components/AdminLoginGate";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const dynamic = 'force-dynamic';

export default async function RestaurantPage() {
  const isAdmin = await getSessionAdmin();

  return (
    <Suspense fallback={
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: '1.5rem' }}>
        <Loader2 className="spin" size={48} style={{ color: 'var(--primary)' }} />
        <p style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '0.4em' }}>VERIFYING CREDENTIALS...</p>
      </div>
    }>
      {isAdmin ? <RestaurantPortal /> : <AdminLoginGate />}
    </Suspense>
  );
}
