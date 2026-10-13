import {
  buildEscPosReceipt,
  buildReceiptText,
  buildTestOrder,
  wrapReceiptText,
  type ReceiptConfig,
  type ReceiptOrder,
} from "./receipt.ts";

const config: ReceiptConfig = {
  storeName: "DNA DO AÇAÍ",
  paperWidth: 80,
  charactersPerLine: 48,
};

function simpleOrder(
  overrides: Partial<ReceiptOrder> = {},
): ReceiptOrder {
  return {
    id: "test-order",
    order_number: 42,
    created_at: "2026-07-26T15:30:00.000Z",
    customer_name: "Cliente Teste",
    customer_phone: "(62) 99999-9999",
    delivery_method: "pickup",
    items: [{
      name: "Açaí puro 300 ml",
      quantity: 1,
      unitPrice: 1299,
      totalPrice: 1299,
    }],
    subtotal: 1299,
    delivery_fee: 0,
    total: 1299,
    payment_label: "Pix",
    status: "Novo",
    ...overrides,
  };
}

Deno.test("formata pedido simples para retirada e Pix", () => {
  const receipt = buildReceiptText(simpleOrder(), config);

  if (!receipt.includes("PEDIDO No 0042")) throw new Error("Pedido ausente");
  if (!receipt.includes("Tipo: Retirada")) throw new Error("Retirada ausente");
  if (!receipt.includes("Forma: Pix")) throw new Error("Pix ausente");
  if (receipt.includes("undefined") || receipt.includes("null")) {
    throw new Error("Valor vazio foi impresso");
  }
});

Deno.test("formata entrega, dinheiro, troco, personalização e observação", () => {
  const receipt = buildReceiptText(buildTestOrder(), config, { test: true });

  for (
    const expected of [
      "TESTE DE IMPRESSAO",
      "Tipo: Entrega",
      "Adicional:",
      "Forma: Dinheiro",
      "Troco para: R$ 100,00",
      "OBSERVACOES",
    ]
  ) {
    if (!receipt.includes(expected)) {
      throw new Error(`Trecho ausente: ${expected}`);
    }
  }
});

Deno.test("quebra texto grande sem ultrapassar a largura", () => {
  const lines = wrapReceiptText(
    "Complemento com um nome bastante grande que precisa continuar legível na comanda térmica",
    32,
  );

  if (lines.some((line) => line.length > 32)) {
    throw new Error("Linha maior que a largura configurada");
  }
});

Deno.test("gera bytes ESC/POS com inicialização e corte", () => {
  const bytes = buildEscPosReceipt(simpleOrder(), config);

  if (bytes.length < 20) throw new Error("Comanda ESC/POS vazia");
  if (bytes[0] !== 0x1b || bytes[1] !== 0x40) {
    throw new Error("Inicialização ESC/POS ausente");
  }
  const end = Array.from(bytes.slice(-3));
  if (end[0] !== 0x1d || end[1] !== 0x56 || end[2] !== 0x00) {
    throw new Error("Corte ESC/POS ausente");
  }
});
