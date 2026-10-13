export type ReceiptCustomization = {
  groupTitle?: string | null;
  options?: string | null;
  optionsList?: string[] | null;
  price?: number | null;
};

export type ReceiptItem = {
  name?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  totalPrice?: number | null;
  customization?: ReceiptCustomization[] | null;
};

export type ReceiptOrder = {
  id: string;
  order_number: number;
  created_at: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  delivery_method?: "delivery" | "pickup" | string | null;
  address?: string | null;
  neighborhood?: string | null;
  items?: ReceiptItem[] | null;
  subtotal?: number | null;
  delivery_fee?: number | null;
  discount?: number | null;
  discounts?: number | null;
  total?: number | null;
  payment_label?: string | null;
  change_for?: string | null;
  notes?: string | null;
  status?: string | null;
};

export type ReceiptConfig = {
  storeName: string;
  paperWidth: 58 | 80;
  charactersPerLine: number;
};

const currency = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format((value ?? 0) / 100);

function clean(value: unknown) {
  if (typeof value !== "string") return "";
  const normalized = value.replace(/\s+/g, " ").trim();
  return /^(undefined|null)$/i.test(normalized) ? "" : normalized;
}

function safeAscii(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7E\n]/g, "");
}

export function wrapReceiptText(value: string, width: number) {
  const words = clean(value).split(" ").filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word;
      continue;
    }

    if (`${line} ${word}`.length <= width) {
      line += ` ${word}`;
      continue;
    }

    lines.push(line);
    line = word;
  }

  if (line) lines.push(line);
  return lines.length > 0 ? lines : [""];
}

function pushLabeledLine(
  lines: string[],
  label: string,
  value: unknown,
  width: number,
) {
  const normalizedValue =
    typeof value === "number" ? String(value) : clean(value);

  if (!normalizedValue) return;
  wrapReceiptText(`${label}: ${normalizedValue}`, width).forEach((line) =>
    lines.push(line),
  );
}

function findUtensil(order: ReceiptOrder, term: string) {
  for (const item of order.items ?? []) {
    for (const line of item.customization ?? []) {
      if (clean(line.groupTitle).toLocaleLowerCase("pt-BR").includes(term)) {
        return clean(line.options);
      }
    }
  }
  return "";
}

export function buildReceiptText(
  order: ReceiptOrder,
  config: ReceiptConfig,
  options: { reprint?: boolean; test?: boolean } = {},
) {
  const width = config.charactersPerLine;
  const separator = "-".repeat(width);
  const emphasizedSeparator = "=".repeat(width);
  const createdAt = new Date(order.created_at);
  const validDate = !Number.isNaN(createdAt.getTime());
  const lines: string[] = [
    config.storeName.toUpperCase(),
    options.test ? "*** TESTE DE IMPRESSAO ***" : "",
    options.reprint ? "*** REIMPRESSAO MANUAL ***" : "",
    emphasizedSeparator,
    `PEDIDO No ${String(order.order_number).padStart(4, "0")}`,
  ].filter(Boolean);

  if (validDate) {
    lines.push(
      `DATA: ${createdAt.toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
      })}`,
      `HORARIO: ${createdAt.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "America/Sao_Paulo",
      })}`,
    );
  }

  lines.push(emphasizedSeparator, "CLIENTE");
  pushLabeledLine(lines, "Nome", order.customer_name, width);
  pushLabeledLine(lines, "Telefone", order.customer_phone, width);

  lines.push(separator, "ENTREGA");
  const deliveryLabel =
    order.delivery_method === "delivery" ? "Entrega" : "Retirada";
  pushLabeledLine(lines, "Tipo", deliveryLabel, width);
  if (order.delivery_method === "delivery") {
    pushLabeledLine(lines, "Endereco", order.address, width);
    pushLabeledLine(lines, "Bairro", order.neighborhood, width);
  }

  lines.push(emphasizedSeparator, "PRODUTOS");
  (order.items ?? []).forEach((item, index) => {
    const quantity = Math.max(1, Math.floor(item.quantity ?? 1));
    const itemName = clean(item.name) || "Produto";
    wrapReceiptText(`${quantity}x ${itemName.toUpperCase()}`, width).forEach(
      (line) => lines.push(line),
    );

    for (const customization of item.customization ?? []) {
      const groupTitle = clean(customization.groupTitle);
      const optionText =
        (customization.optionsList ?? []).map(clean).filter(Boolean).join(", ") ||
        clean(customization.options);
      if (!groupTitle && !optionText) continue;

      const marker = (customization.price ?? 0) > 0 ? "+ " : "  ";
      wrapReceiptText(
        `${marker}${groupTitle}${groupTitle && optionText ? ": " : ""}${optionText}`,
        width,
      ).forEach((line) => lines.push(line));

      if ((customization.price ?? 0) > 0) {
        lines.push(`  Adicional: ${currency(customization.price)}`);
      }
    }

    if (item.unitPrice != null) {
      lines.push(`Unitario: ${currency(item.unitPrice)}`);
    }
    if (item.totalPrice != null) {
      lines.push(`Subtotal item: ${currency(item.totalPrice)}`);
    }
    if (index < (order.items?.length ?? 0) - 1) {
      lines.push(".".repeat(width));
    }
  });

  lines.push(emphasizedSeparator, "PAGAMENTO");
  pushLabeledLine(lines, "Forma", order.payment_label, width);
  pushLabeledLine(lines, "Troco para", order.change_for, width);
  lines.push(`Subtotal: ${currency(order.subtotal)}`);
  if (order.delivery_fee != null) {
    lines.push(`Taxa de entrega: ${currency(order.delivery_fee)}`);
  }
  const discount = order.discount ?? order.discounts;
  if (discount != null && discount > 0) {
    lines.push(`Descontos: -${currency(discount)}`);
  }
  lines.push(emphasizedSeparator, `TOTAL: ${currency(order.total)}`);

  const notes = clean(order.notes);
  if (notes) {
    lines.push(emphasizedSeparator, "OBSERVACOES");
    wrapReceiptText(notes, width).forEach((line) => lines.push(line));
  }

  const spoon = findUtensil(order, "colher");
  const napkin = findUtensil(order, "guardanapo");
  pushLabeledLine(lines, "Colher", spoon, width);
  pushLabeledLine(lines, "Guardanapo", napkin, width);
  pushLabeledLine(lines, "Status inicial", order.status, width);

  lines.push(separator, "", "", "");
  return safeAscii(lines.join("\n"));
}

export function buildEscPosReceipt(
  order: ReceiptOrder,
  config: ReceiptConfig,
  options: { reprint?: boolean; test?: boolean } = {},
) {
  const receipt = buildReceiptText(order, config, options);
  const encoder = new TextEncoder();
  const initialize = new Uint8Array([0x1b, 0x40]);
  const alignCenter = new Uint8Array([0x1b, 0x61, 0x01]);
  const boldOn = new Uint8Array([0x1b, 0x45, 0x01]);
  const boldOff = new Uint8Array([0x1b, 0x45, 0x00]);
  const alignLeft = new Uint8Array([0x1b, 0x61, 0x00]);
  const cut = new Uint8Array([0x0a, 0x0a, 0x0a, 0x1d, 0x56, 0x00]);
  const headingEnd = receipt.indexOf("\n");
  const heading = encoder.encode(receipt.slice(0, headingEnd));
  const body = encoder.encode(receipt.slice(headingEnd + 1));
  const size =
    initialize.length +
    alignCenter.length +
    boldOn.length +
    heading.length +
    boldOff.length +
    1 +
    alignLeft.length +
    body.length +
    cut.length;
  const bytes = new Uint8Array(size);
  let offset = 0;

  for (const part of [
    initialize,
    alignCenter,
    boldOn,
    heading,
    boldOff,
    new Uint8Array([0x0a]),
    alignLeft,
    body,
    cut,
  ]) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
}

export function buildTestOrder(): ReceiptOrder {
  return {
    id: "print-test",
    order_number: 9999,
    created_at: new Date().toISOString(),
    customer_name: "Teste de impressão automática",
    customer_phone: "(62) 99110-2715",
    delivery_method: "delivery",
    address:
      "Avenida de teste com nome propositalmente grande, número 123, complemento A",
    neighborhood: "Setor Demonstração",
    items: [
      {
        name: "DNA Supremo (500ml)",
        quantity: 1,
        unitPrice: 2199,
        totalPrice: 2549,
        customization: [
          {
            groupTitle: "Frutas e complementos",
            optionsList: [
              "Banana",
              "Morango",
              "Leite condensado",
              "Leite em pó",
            ],
            options: "Banana, Morango, Leite condensado, Leite em pó",
            price: 0,
          },
          {
            groupTitle: "Adicional",
            options: "M&M",
            price: 350,
          },
        ],
      },
      {
        name: "Combo Explosão DNA",
        quantity: 1,
        unitPrice: 2799,
        totalPrice: 2799,
        customization: [
          {
            groupTitle: "1º Copo 300ml - Complementos",
            options: "Paçoca, Granola e Banana",
            price: 0,
          },
        ],
      },
    ],
    subtotal: 5348,
    delivery_fee: 500,
    total: 5848,
    payment_label: "Dinheiro",
    change_for: "R$ 100,00",
    notes:
      "Observação longa com acentuação: entregar no portão lateral e chamar pelo telefone.",
    status: "Novo",
  };
}
