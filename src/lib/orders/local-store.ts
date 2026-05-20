import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  WHATSAPP_BUSINESS_PHONE_NUMBER,
  type CreateOrderPayload,
  type OrderRecord,
  type OrderStatus,
} from "@/data/orders";
import { buildWhatsAppBusinessOrderPayload } from "@/lib/whatsapp/business";

type LocalOrdersData = {
  nextOrderNumber: number;
  orders: OrderRecord[];
};

type LocalOrderPatch = {
  status?: OrderStatus;
  delivery_fee?: number;
};

const localOrdersPath = path.join(process.cwd(), "local-data", "orders.json");

async function readLocalOrdersData(): Promise<LocalOrdersData> {
  try {
    const file = await readFile(localOrdersPath, "utf8");
    const data = JSON.parse(file) as LocalOrdersData;

    return {
      nextOrderNumber: data.nextOrderNumber || data.orders.length + 1,
      orders: Array.isArray(data.orders) ? data.orders : [],
    };
  } catch {
    return {
      nextOrderNumber: 1,
      orders: [],
    };
  }
}

async function writeLocalOrdersData(data: LocalOrdersData) {
  await mkdir(path.dirname(localOrdersPath), { recursive: true });
  await writeFile(localOrdersPath, JSON.stringify(data, null, 2), "utf8");
}

export async function listLocalOrders() {
  const data = await readLocalOrdersData();

  return [...data.orders].sort(
    (firstOrder, secondOrder) =>
      new Date(secondOrder.created_at).getTime() -
      new Date(firstOrder.created_at).getTime(),
  );
}

export async function createLocalOrder(order: CreateOrderPayload) {
  const data = await readLocalOrdersData();
  const now = new Date().toISOString();
  const orderRecord: OrderRecord = {
    id: crypto.randomUUID(),
    order_number: data.nextOrderNumber,
    created_at: now,
    updated_at: null,
    customer_name: order.customerName,
    customer_phone: order.customerPhone,
    delivery_method: order.deliveryMethod,
    address: order.deliveryMethod === "delivery" ? order.address : null,
    neighborhood:
      order.deliveryMethod === "delivery" ? order.neighborhood || null : null,
    items: order.items,
    subtotal: order.subtotal,
    delivery_fee: null,
    total: order.total,
    payment_method: order.paymentMethod,
    payment_label: order.paymentLabel,
    change_for:
      order.paymentMethod === "cash" && order.changeFor ? order.changeFor : null,
    notes: order.notes || null,
    status: "Novo",
    whatsapp_business_phone: WHATSAPP_BUSINESS_PHONE_NUMBER,
    whatsapp_payload: buildWhatsAppBusinessOrderPayload(order),
  };

  data.orders.unshift(orderRecord);
  data.nextOrderNumber += 1;
  await writeLocalOrdersData(data);

  return orderRecord;
}

export async function updateLocalOrder(orderId: string, patch: LocalOrderPatch) {
  const data = await readLocalOrdersData();
  const orderIndex = data.orders.findIndex((order) => order.id === orderId);

  if (orderIndex === -1) {
    throw new Error("Pedido não encontrado.");
  }

  const currentOrder = data.orders[orderIndex];
  const deliveryFee =
    patch.delivery_fee !== undefined ? patch.delivery_fee : currentOrder.delivery_fee;
  const updatedOrder: OrderRecord = {
    ...currentOrder,
    status: patch.status ?? currentOrder.status,
    delivery_fee: deliveryFee,
    total:
      patch.delivery_fee !== undefined
        ? currentOrder.subtotal + patch.delivery_fee
        : currentOrder.total,
    updated_at: new Date().toISOString(),
  };

  data.orders[orderIndex] = updatedOrder;
  await writeLocalOrdersData(data);

  return updatedOrder;
}
