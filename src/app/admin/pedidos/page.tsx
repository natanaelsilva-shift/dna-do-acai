import type { Metadata } from "next";
import { AdminDashboard } from "@/components/AdminDashboard";
import type { OrderRecord } from "@/data/orders";
import { listLocalOrders } from "@/lib/orders/local-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Pedidos | Admin | DNA do Açaí",
  description: "Painel de pedidos em tempo real da loja DNA do Açaí.",
  manifest: "/admin-manifest.json",
};

export const dynamic = "force-dynamic";

async function getInitialOrders() {
  try {
    if (!isSupabaseConfigured()) {
      return await listLocalOrders();
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return [];
    }

    return (data ?? []) as OrderRecord[];
  } catch {
    return [];
  }
}

export default async function AdminOrdersPage() {
  const initialOrders = await getInitialOrders();

  return <AdminDashboard initialOrders={initialOrders} />;
}
