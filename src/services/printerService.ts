"use client";

import * as qz from "qz-tray";
import type { PrintData } from "qz-tray";
import type { OrderRecord } from "@/data/orders";

export type PaperWidth = 58 | 80;
export type PrintMode = "escpos" | "html";

export type PrinterPreferences = {
  printerName: string;
  automaticPrinting: boolean;
  paperWidth: PaperWidth;
  copies: 1 | 2;
  playSoundBeforePrint: boolean;
  printOnReceive: boolean;
  printOnAccept: boolean;
  mode: PrintMode;
};

export type PrinterConnectionState = "disconnected" | "connecting" | "connected" | "error";

const PRINTER_PREFERENCES_KEY = "dna-admin-printer-preferences-v1";

export const DEFAULT_PRINTER_PREFERENCES: PrinterPreferences = {
  printerName: "",
  automaticPrinting: false,
  paperWidth: 80,
  copies: 1,
  playSoundBeforePrint: true,
  printOnReceive: true,
  printOnAccept: false,
  mode: "escpos",
};

let securityConfigured = false;

function asPreferences(value: unknown): PrinterPreferences {
  if (!value || typeof value !== "object") return DEFAULT_PRINTER_PREFERENCES;
  const data = value as Partial<PrinterPreferences>;

  return {
    printerName: typeof data.printerName === "string" ? data.printerName : "",
    automaticPrinting: data.automaticPrinting === true,
    paperWidth: data.paperWidth === 58 ? 58 : 80,
    copies: data.copies === 2 ? 2 : 1,
    playSoundBeforePrint: data.playSoundBeforePrint !== false,
    printOnReceive: data.printOnReceive !== false,
    printOnAccept: data.printOnAccept === true,
    mode: data.mode === "html" ? "html" : "escpos",
  };
}

export function loadPrinterPreferences() {
  if (typeof window === "undefined") return DEFAULT_PRINTER_PREFERENCES;

  try {
    return asPreferences(JSON.parse(window.localStorage.getItem(PRINTER_PREFERENCES_KEY) ?? ""));
  } catch {
    return DEFAULT_PRINTER_PREFERENCES;
  }
}

export function savePrinterPreferences(preferences: PrinterPreferences) {
  window.localStorage.setItem(PRINTER_PREFERENCES_KEY, JSON.stringify(preferences));
}

async function configureQzSecurity() {
  if (securityConfigured) return;
  securityConfigured = true;

  try {
    const certificateResponse = await fetch("/api/qz/certificate", { cache: "no-store" });
    if (!certificateResponse.ok) return;

    const certificate = await certificateResponse.text();
    qz.security.setCertificatePromise((resolve) => resolve(certificate));
    qz.security.setSignatureAlgorithm("SHA512");
    qz.security.setSignaturePromise(async (dataToSign) => {
      const response = await fetch("/api/qz/sign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: dataToSign }),
      });
      const body = (await response.json()) as { signature?: string; error?: string };
      if (!response.ok || !body.signature) {
        throw new Error(body.error ?? "Falha ao assinar a solicitação do QZ Tray.");
      }
      return body.signature;
    });
  } catch {
    // QZ Tray continua utilizável no modo comunitário, com a confirmação local dele.
  }
}

export function isQzConnected() {
  return qz.websocket.isActive();
}

export function supportsAutomaticPrinting() {
  if (typeof navigator === "undefined") return false;
  return !/Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export async function connectQzTray() {
  await configureQzSecurity();
  if (!qz.websocket.isActive()) {
    await qz.websocket.connect({ retries: 2, delay: 1 });
  }
  return listPrinters();
}

export async function disconnectQzTray() {
  if (qz.websocket.isActive()) await qz.websocket.disconnect();
}

export async function listPrinters(): Promise<string[]> {
  if (!qz.websocket.isActive()) {
    throw new Error("QZ Tray desconectado. Abra o QZ Tray e clique em Conectar impressora.");
  }

  const result = await qz.printers.find();
  return Array.isArray(result) ? result : [result];
}

export async function ensurePrinterAvailable(printerName: string) {
  if (!printerName) throw new Error("Selecione uma impressora.");
  if (!qz.websocket.isActive()) throw new Error("QZ Tray desconectado.");

  const found = await qz.printers.find(printerName);
  const names = Array.isArray(found) ? found : [found];
  if (!names.some((name) => name === printerName)) {
    throw new Error("Impressora não encontrada ou offline.");
  }
}

const currency = (value: number | null | undefined) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format((value ?? 0) / 100);

function removeAccents(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function wrap(value: string, width: number) {
  const words = value.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    if (!line) {
      line = word.length > width ? word.slice(0, width) : word;
    } else if (`${line} ${word}`.length <= width) {
      line += ` ${word}`;
    } else {
      lines.push(line);
      line = word.length > width ? word.slice(0, width) : word;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function printLine(lines: string[], label: string, value: string, width: number) {
  wrap(`${label}: ${value}`, width).forEach((line) => lines.push(line));
}

function getUtensil(order: OrderRecord, term: string) {
  for (const item of order.items) {
    for (const line of item.customization ?? []) {
      if (line.groupTitle.toLocaleLowerCase("pt-BR").includes(term)) return line.options;
    }
  }
  return "Não informado";
}

export function buildReceiptText(order: OrderRecord, paperWidth: PaperWidth, reprint = false) {
  const width = paperWidth === 58 ? 32 : 48;
  const separator = "-".repeat(width);
  const created = new Date(order.created_at);
  const lines: string[] = [
    "DNA DO ACAI",
    "Acai de verdade, do seu jeito!",
    reprint ? "*** REIMPRESSAO ***" : "",
    `PEDIDO No ${order.order_number.toString().padStart(4, "0")}`,
    `DATA: ${created.toLocaleDateString("pt-BR")}`,
    `HORARIO: ${created.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
    separator,
    "CLIENTE",
  ].filter(Boolean);

  printLine(lines, "Nome", order.customer_name, width);
  printLine(lines, "Telefone", order.customer_phone, width);
  lines.push("", "ENTREGA");
  printLine(lines, "Tipo", order.delivery_method === "delivery" ? "Entrega" : "Retirada", width);
  if (order.delivery_method === "delivery") {
    printLine(lines, "Endereco", order.address || "A confirmar", width);
    printLine(lines, "Bairro", order.neighborhood || "A confirmar", width);
  }
  lines.push(separator, "ITENS");

  order.items.forEach((item, index) => {
    lines.push(`${item.quantity}x ${removeAccents(item.name).toUpperCase()}`);
    for (const custom of item.customization ?? []) {
      const prefix = custom.price > 0 ? "+ " : "  ";
      wrap(`${prefix}${removeAccents(custom.groupTitle)}: ${removeAccents(custom.options)}`, width).forEach((line) => lines.push(line));
      if (custom.price > 0) lines.push(`  Adicional: ${currency(custom.price)}`);
    }
    lines.push(`Unitario: ${currency(item.unitPrice)}`, `Subtotal: ${currency(item.totalPrice)}`);
    if (index < order.items.length - 1) lines.push(".".repeat(width));
  });

  lines.push(separator, "PAGAMENTO");
  printLine(lines, "Forma", removeAccents(order.payment_label), width);
  if (order.change_for) printLine(lines, "Troco para", order.change_for, width);
  lines.push(`Subtotal: ${currency(order.subtotal)}`);
  lines.push(`Taxa de entrega: ${order.delivery_fee == null ? "A combinar" : currency(order.delivery_fee)}`);
  lines.push(`Desconto: ${currency(0)}`);
  lines.push(`TOTAL: ${currency(order.total)}`);
  lines.push(separator, "OBSERVACOES DO PEDIDO");
  wrap(removeAccents(order.notes || "Sem observacoes"), width).forEach((line) => lines.push(line));
  printLine(lines, "Colher", removeAccents(getUtensil(order, "colher")), width);
  printLine(lines, "Guardanapo", removeAccents(getUtensil(order, "guardanapo")), width);
  lines.push(separator, "WhatsApp: (62) 99110-2715", "Instagram: @dnadoacai", "www.dnadoacai.com.br", "", "");
  return lines.join("\n");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[character]!);
}

function buildReceiptHtml(order: OrderRecord, paperWidth: PaperWidth, reprint: boolean) {
  const text = escapeHtml(buildReceiptText(order, paperWidth, reprint));
  return `<!doctype html><html><head><meta charset="utf-8"><style>@page{margin:2mm;size:${paperWidth}mm auto}*{box-sizing:border-box}body{width:${paperWidth - 6}mm;margin:0;font:600 11px/1.35 Arial,sans-serif;color:#000;white-space:pre-wrap;overflow-wrap:anywhere}pre{margin:0;font:inherit}.ticket{text-align:left}.title{text-align:center;font-size:15px;font-weight:900}</style></head><body><div class="ticket"><pre>${text}</pre></div></body></html>`;
}

async function sendPrint(printerName: string, preferences: PrinterPreferences, order: OrderRecord, reprint: boolean) {
  const config = qz.configs.create(printerName, {
    copies: preferences.copies,
    encoding: "UTF-8",
    jobName: `DNA Pedido ${order.order_number}${reprint ? " Reimpressao" : ""}`,
    units: "mm",
    size: { width: preferences.paperWidth },
    margins: 0,
  });

  if (preferences.mode === "html") {
    const data: PrintData[] = [{ type: "pixel", format: "html", flavor: "plain", data: buildReceiptHtml(order, preferences.paperWidth, reprint) }];
    await qz.print(config, data);
    return;
  }

  const receiptLines = removeAccents(buildReceiptText(order, preferences.paperWidth, reprint)).split("\n");
  const orderLineIndex = receiptLines.findIndex((line) => line.startsWith("PEDIDO No"));
  const heading = receiptLines.slice(0, orderLineIndex).join("\n");
  const orderLine = receiptLines[orderLineIndex];
  const body = receiptLines.slice(orderLineIndex + 1).join("\n");
  const raw = `\x1b\x40\x1b\x61\x01\x1b\x45\x01${heading}\x1b\x45\x00\n\x1d\x21\x11${orderLine}\x1d\x21\x00\n\x1b\x61\x00${body}\n\n\n\x1d\x56\x00`;
  const data: PrintData[] = [{ type: "raw", format: "command", flavor: "plain", data: raw }];
  await qz.print(config, data);
}

export async function printOrderReceipt(order: OrderRecord, preferences: PrinterPreferences, reprint = false) {
  await ensurePrinterAvailable(preferences.printerName);
  try {
    await sendPrint(preferences.printerName, preferences, order, reprint);
  } catch (error) {
    if (preferences.mode !== "escpos") throw error;
    const htmlPreferences: PrinterPreferences = { ...preferences, mode: "html" };
    await sendPrint(preferences.printerName, htmlPreferences, order, reprint);
  }
}

export async function printTestReceipt(preferences: PrinterPreferences) {
  const now = new Date().toISOString();
  const testOrder: OrderRecord = {
    id: "printer-test",
    order_number: 9999,
    created_at: now,
    updated_at: null,
    customer_name: "Teste de impressão",
    customer_phone: "(62) 99110-2715",
    delivery_method: "pickup",
    address: null,
    neighborhood: null,
    items: [{ id: "test", productId: "test", name: "Açaí teste 500 ml", quantity: 1, unitPrice: 1990, totalPrice: 1990, customization: [{ groupTitle: "Complementos", options: "Banana, Leite em pó", price: 0 }] }],
    subtotal: 1990,
    delivery_fee: 0,
    total: 1990,
    payment_method: "pix",
    payment_label: "Pix",
    change_for: null,
    notes: "Se esta comanda está legível, a impressora está configurada.",
    status: "Novo",
    whatsapp_business_phone: "5562991102715",
    whatsapp_payload: null,
  };
  await printOrderReceipt(testOrder, preferences);
}

export function friendlyPrinterError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLocaleLowerCase("pt-BR");
  if (normalized.includes("connection") || normalized.includes("websocket") || normalized.includes("qz tray")) {
    return "QZ Tray desconectado. Instale ou abra o QZ Tray neste computador.";
  }
  if (normalized.includes("printer") || normalized.includes("impressora")) {
    return "Impressora não encontrada ou offline.";
  }
  return `Falha ao imprimir: ${message}`;
}
