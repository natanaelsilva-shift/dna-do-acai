import {
  WHATSAPP_BUSINESS_PHONE_NUMBER,
  type CreateOrderPayload,
} from "@/data/orders";

const WHATSAPP_CLOUD_API_VERSION = "v21.0";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);

function buildOrderMessagePreview(order: CreateOrderPayload) {
  const items = order.items
    .map((item, index) => {
      const customization = item.customization
        ?.map((line) => {
          const options =
            line.optionsList && line.optionsList.length > 0
              ? line.optionsList.map((option) => `      * ${option}`).join("\n")
              : `      ${line.options}`;
          const sectionTotal =
            line.price > 0 ? `      Total da seção: ${formatCurrency(line.price)}` : "";

          return [`   ${line.groupTitle}:`, options, sectionTotal]
            .filter(Boolean)
            .join("\n");
        })
        .join("\n");

      return [
        `${index + 1}. ${item.quantity}x ${item.name} - ${formatCurrency(
          item.totalPrice,
        )}`,
        customization,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");

  return [
    "Novo pedido DNA do Açaí",
    "",
    "Itens:",
    items,
    "",
    `Subtotal: ${formatCurrency(order.subtotal)}`,
    `Taxa de entrega: A combinar`,
    `Total: ${formatCurrency(order.total)}`,
  ].join("\n");
}

export function getWhatsAppBusinessConfig() {
  return {
    apiVersion: WHATSAPP_CLOUD_API_VERSION,
    businessPhoneNumber:
      process.env.WHATSAPP_BUSINESS_PHONE_NUMBER ?? WHATSAPP_BUSINESS_PHONE_NUMBER,
    phoneNumberId: process.env.WHATSAPP_BUSINESS_PHONE_NUMBER_ID ?? "",
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID ?? "",
    accessTokenConfigured: Boolean(process.env.WHATSAPP_BUSINESS_ACCESS_TOKEN),
    orderTemplateName: process.env.WHATSAPP_ORDER_TEMPLATE_NAME ?? "pedido_recebido",
  };
}

export function buildWhatsAppBusinessOrderPayload(order: CreateOrderPayload) {
  const config = getWhatsAppBusinessConfig();

  return {
    provider: "whatsapp_business_cloud_api",
    apiVersion: config.apiVersion,
    businessPhoneNumber: config.businessPhoneNumber,
    phoneNumberId: config.phoneNumberId,
    businessAccountId: config.businessAccountId,
    templateName: config.orderTemplateName,
    recipientPhone: order.customerPhone.replace(/\D/g, ""),
    messagePreview: buildOrderMessagePreview(order),
    readyToSend: Boolean(config.phoneNumberId && config.accessTokenConfigured),
  };
}
