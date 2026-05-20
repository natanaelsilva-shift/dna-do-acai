import { NextResponse } from "next/server";
import {
  WHATSAPP_BUSINESS_PHONE_NUMBER,
  type CreateOrderPayload,
  type DeliveryMethod,
  type OrderCustomizationLine,
  type OrderItem,
  type PaymentMethod,
} from "@/data/orders";
import {
  createLocalOrder,
  listLocalOrders,
} from "@/lib/orders/local-store";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";
import { buildWhatsAppBusinessOrderPayload } from "@/lib/whatsapp/business";

export const dynamic = "force-dynamic";

const paymentLabels: Record<PaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão na entrega",
  cash: "Dinheiro",
};

function asRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asCents(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : 0;
}

function asQuantity(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? Math.floor(value)
    : 0;
}

function asDeliveryMethod(value: unknown): DeliveryMethod {
  return value === "pickup" ? "pickup" : "delivery";
}

function asPaymentMethod(value: unknown): PaymentMethod {
  return value === "card" || value === "cash" ? value : "pix";
}

function normalizeCustomization(value: unknown): OrderCustomizationLine[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((line) => {
      const record = asRecord(line);

      return {
        groupTitle: asString(record.groupTitle),
        options: asString(record.options),
        optionsList: Array.isArray(record.optionsList)
          ? record.optionsList.map(asString).filter(Boolean)
          : undefined,
        price: asCents(record.price),
      };
    })
    .filter((line) => line.groupTitle && line.options);
}

function normalizeItems(value: unknown): OrderItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      const record = asRecord(item);
      const quantity = asQuantity(record.quantity);
      const unitPrice = asCents(record.unitPrice);

      return {
        id: asString(record.id),
        productId: asString(record.productId),
        name: asString(record.name),
        quantity,
        unitPrice,
        totalPrice: quantity * unitPrice,
        customization: normalizeCustomization(record.customization),
      };
    })
    .filter((item) => item.id && item.productId && item.name && item.quantity > 0);
}

function normalizeOrderPayload(value: unknown): CreateOrderPayload {
  const record = asRecord(value);
  const deliveryMethod = asDeliveryMethod(record.deliveryMethod);
  const paymentMethod = asPaymentMethod(record.paymentMethod);
  const items = normalizeItems(record.items);
  const subtotal = items.reduce((total, item) => total + item.totalPrice, 0);

  return {
    customerName: asString(record.customerName),
    customerPhone: asString(record.customerPhone),
    deliveryMethod,
    address: asString(record.address),
    neighborhood: asString(record.neighborhood),
    paymentMethod,
    paymentLabel: paymentLabels[paymentMethod],
    changeFor: asString(record.changeFor),
    notes: asString(record.notes),
    items,
    subtotal,
    deliveryFee: null,
    total: subtotal,
  };
}

function validateOrder(order: CreateOrderPayload) {
  if (!order.customerName) {
    return "Informe o nome do cliente.";
  }

  if (!order.customerPhone) {
    return "Informe o telefone do cliente.";
  }

  if (order.deliveryMethod === "delivery" && !order.address) {
    return "Informe o endereço de entrega.";
  }

  if (order.items.length === 0) {
    return "Adicione ao menos um item ao pedido.";
  }

  return null;
}

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ orders: await listLocalOrders() });
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ orders: data ?? [] });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível carregar os pedidos.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const order = normalizeOrderPayload(await request.json());
    const validationError = validateOrder(order);

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    if (!isSupabaseConfigured()) {
      const localOrder = await createLocalOrder(order);

      return NextResponse.json(
        {
          order: {
            id: localOrder.id,
            order_number: localOrder.order_number,
            created_at: localOrder.created_at,
            status: localOrder.status,
          },
          storage: "local",
        },
        { status: 201 },
      );
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("orders")
      .insert({
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
      })
      .select("id, order_number, created_at, status")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ order: data }, { status: 201 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Não foi possível salvar o pedido.";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
