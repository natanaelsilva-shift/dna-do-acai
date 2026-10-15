import type { Metadata, Viewport } from "next";
import { AdminDashboard } from "@/components/AdminDashboard";
import type { OrderRecord } from "@/data/orders";
import { getStoreStatus } from "@/lib/store-status/server";
import { requireAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { reportServerError } from "@/lib/server/http";

export const metadata: Metadata = {
  title: "Pedidos | Admin | DNA do Açaí",
  description: "Painel de pedidos em tempo real da loja DNA do Açaí.",
  manifest: "/admin-manifest.json",
};

// Mantém a cor de barra do navegador que o painel já usava.
export const viewport: Viewport = {
  themeColor: "#071b12",
};

export const dynamic = "force-dynamic";

async function getInitialOrders(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"]) {
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data ?? []) as OrderRecord[];
  } catch (error) {
    reportServerError("admin-orders", error);
    return [];
  }
}

export default async function AdminOrdersPage() {
  const admin = await requireAdmin().catch(() => null);
  if (!admin) redirect("/admin/login");
  const [initialOrders, initialStoreStatus] = await Promise.all([
    getInitialOrders(admin.supabase),
    getStoreStatus().catch(() => undefined),
  ]);

  return (
    <AdminDashboard
      initialOrders={initialOrders}
      initialStoreStatus={initialStoreStatus}
    />
  );
}
