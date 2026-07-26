"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CATALOG_STORAGE_KEY,
  defaultProductImage,
  getCatalogStorageSnapshot,
  initialCatalog,
  LEGACY_CATALOG_STORAGE_KEY,
  migrateLegacyCatalogStorage,
  parseCatalogStorageSnapshot,
  type CatalogData,
  type Category,
  type ComplementGroup,
  type ComplementOption,
  type Product,
} from "@/data/menu";
import {
  createClient,
  isSupabaseConfigured,
} from "@/lib/supabase/client";
import {
  ORDER_STATUSES,
  WHATSAPP_BUSINESS_PHONE_NUMBER,
  type OrderRecord,
  type OrderStatus,
} from "@/data/orders";
import {
  getStoreStatusLabel,
  type StoreStatus,
  type StoreStatusPayload,
} from "@/data/store-status";
import {
  useStoreStatus,
} from "@/lib/store-status/client";
import {
  DEFAULT_PRINTER_PREFERENCES,
  connectQzTray,
  friendlyPrinterError,
  isQzConnected,
  loadPrinterPreferences,
  printOrderReceipt,
  printTestReceipt,
  savePrinterPreferences,
  supportsAutomaticPrinting,
  type PrinterConnectionState,
  type PrinterPreferences,
} from "@/services/printerService";

type AdminTab =
  | "home"
  | "orders"
  | "products"
  | "settings"
  | "images"
  | "categories"
  | "complements";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const tabs: { id: AdminTab; label: string; shortLabel: string }[] = [
  { id: "home", label: "Início", shortLabel: "Início" },
  { id: "orders", label: "Pedidos", shortLabel: "Pedidos" },
  { id: "products", label: "Produtos", shortLabel: "Produtos" },
  { id: "settings", label: "Configurações", shortLabel: "Config." },
];

const ORDER_SOUND_SRC = "/sounds/novo-pedido.mp3";
const BRAND_LOGO_SRC = "/images/logo-dna-acai.png";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value / 100);

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));

const formatOrderNumber = (orderNumber: number) =>
  `#${orderNumber.toString().padStart(4, "0")}`;

const formatWaitTime = (createdAt: string) => {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}min`;
};

const getCustomerWhatsAppUrl = (phone: string) => {
  const digits = phone.replace(/\D/g, "");
  const internationalPhone = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${internationalPhone}`;
};

const getOrderStatusClassName = (status: OrderStatus) => {
  switch (status) {
    case "Novo":
      return "border-[#d97706] bg-[#fff7ed] text-[#9a3412]";
    case "Em preparo":
      return "border-[#7c3aed] bg-[#f5f3ff] text-[#5b21b6]";
    case "Saiu para entrega":
      return "border-[#0284c7] bg-[#f0f9ff] text-[#075985]";
    case "Finalizado":
      return "border-[#16a34a] bg-[#f0fdf4] text-[#166534]";
    case "Cancelado":
      return "border-[#dc2626] bg-[#fef2f2] text-[#991b1b]";
    default:
      return "border-[#d7a948] bg-[#fffaf0] text-[#103d2c]";
  }
};

const isStandaloneAdminApp = () => {
  const nav = window.navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(nav.standalone)
  );
};

const centsToInput = (value?: number) => ((value ?? 0) / 100).toFixed(2);

const inputToCents = (value: string) => {
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
};

const slugify = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function createId(prefix: string, label: string, existingIds: string[]) {
  const base = slugify(label) || prefix;
  let id = base;
  let index = 2;

  while (existingIds.includes(id)) {
    id = `${base}-${index}`;
    index += 1;
  }

  return id;
}

function subscribeCatalogStore(onStoreChange: () => void) {
  if (migrateLegacyCatalogStorage()) {
    queueMicrotask(onStoreChange);
  }

  window.addEventListener("storage", onStoreChange);
  window.addEventListener("dna-catalog-updated", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("dna-catalog-updated", onStoreChange);
  };
}

function getCatalogServerSnapshot() {
  return "";
}

export function AdminDashboard({
  initialOrders = [],
  initialStoreStatus,
}: {
  initialOrders?: OrderRecord[];
  initialStoreStatus?: StoreStatusPayload;
}) {
  const storeState = useStoreStatus({
    initialStatus: initialStoreStatus,
    poll: true,
  });
  const catalogSnapshot = useSyncExternalStore(
    subscribeCatalogStore,
    getCatalogStorageSnapshot,
    getCatalogServerSnapshot,
  );
  const catalog = useMemo(
    () => parseCatalogStorageSnapshot(catalogSnapshot),
    [catalogSnapshot],
  );
  const [activeTab, setActiveTab] = useState<AdminTab>("home");
  const [selectedProductId, setSelectedProductId] = useState(
    catalog.products[0]?.id ?? "",
  );
  const [selectedCategoryId, setSelectedCategoryId] = useState(
    catalog.categories[0]?.id ?? "",
  );
  const [selectedGroupId, setSelectedGroupId] = useState(
    catalog.complementGroups[0]?.id ?? "",
  );
  const [orders, setOrders] = useState<OrderRecord[]>(initialOrders);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState("");
  const [status, setStatus] = useState("Catálogo carregado para edição.");
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [soundError, setSoundError] = useState("");
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isAdminAppInstalled, setIsAdminAppInstalled] = useState(false);
  const [notification, setNotification] = useState<{
    order: OrderRecord;
    visible: boolean;
  } | null>(null);
  const [highlightedOrderId, setHighlightedOrderId] = useState<string | null>(null);
  const [printerPreferences, setPrinterPreferences] = useState<PrinterPreferences>(
    DEFAULT_PRINTER_PREFERENCES,
  );
  const [printerPreferencesLoaded, setPrinterPreferencesLoaded] = useState(false);
  const [printerConnection, setPrinterConnection] =
    useState<PrinterConnectionState>("disconnected");
  const [availablePrinters, setAvailablePrinters] = useState<string[]>([]);
  const [printerMessage, setPrinterMessage] = useState("QZ Tray desconectado.");
  const [printingOrderIds, setPrintingOrderIds] = useState<Set<string>>(new Set());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const latestOrdersRef = useRef<OrderRecord[]>(initialOrders);
  const knownOrderIds = useRef<Set<string>>(
    new Set(initialOrders.map((order) => order.id)),
  );
  const notifiedOrderIds = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(false);
  const isFetchingOrdersRef = useRef(false);
  const printerPreferencesRef = useRef(printerPreferences);
  const printQueueRef = useRef<Promise<void>>(Promise.resolve());
  const isStoreOpen = storeState.status === "open";
  const isStoreStatusKnown = storeState.status !== null;

  const selectedProduct =
    catalog.products.find((product) => product.id === selectedProductId) ??
    catalog.products[0];
  const selectedCategory =
    catalog.categories.find((category) => category.id === selectedCategoryId) ??
    catalog.categories[0];
  const selectedGroup =
    catalog.complementGroups.find((group) => group.id === selectedGroupId) ??
    catalog.complementGroups[0];

  const newOrdersCount = useMemo(
    () => orders.filter((order) => order.status === "Novo").length,
    [orders],
  );

  useEffect(() => {
    latestOrdersRef.current = orders;
  }, [orders]);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    const preferences = loadPrinterPreferences();
    printerPreferencesRef.current = preferences;
    setPrinterPreferences(preferences);
    setPrinterPreferencesLoaded(true);
  }, []);

  useEffect(() => {
    printerPreferencesRef.current = printerPreferences;
    if (printerPreferencesLoaded) savePrinterPreferences(printerPreferences);
  }, [printerPreferences, printerPreferencesLoaded]);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registerServiceWorker = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/admin/" })
        .catch((error) => {
          console.log("Erro ao registrar service worker", error);
        });
    };

    if (document.readyState === "complete") {
      registerServiceWorker();
      return;
    }

    window.addEventListener("load", registerServiceWorker);

    return () => {
      window.removeEventListener("load", registerServiceWorker);
    };
  }, []);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    const updateInstalledState = () => {
      setIsAdminAppInstalled(isStandaloneAdminApp());
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsAdminAppInstalled(true);
      setStatus("Painel admin instalado no celular.");
    };

    updateInstalledState();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    standaloneQuery.addEventListener("change", updateInstalledState);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
      standaloneQuery.removeEventListener("change", updateInstalledState);
    };
  }, []);

  useEffect(() => {
    const saved = window.localStorage.getItem("dna-admin-order-sound-enabled");
    setSoundEnabled(saved === "true");
  }, []);

  useEffect(() => {
    window.localStorage.setItem(
      "dna-admin-order-sound-enabled",
      soundEnabled ? "true" : "false",
    );
  }, [soundEnabled]);

  const getOrderAudio = useCallback(() => {
    if (typeof window === "undefined") {
      return null;
    }

    if (!audioRef.current) {
      audioRef.current = new Audio(ORDER_SOUND_SRC);
      audioRef.current.preload = "auto";
    }

    return audioRef.current;
  }, []);

  const playOrderSound = useCallback(async () => {
    const audio = getOrderAudio();

    if (!audio) {
      return false;
    }

    try {
      audio.currentTime = 0;
      await audio.play();
      console.log("Som tocado com sucesso");
      setSoundError("");
      return true;
    } catch (error) {
      console.log("Erro ao tocar som", error);
      setSoundError(
        "Toque no botão 'Ativar som' para liberar notificações sonoras.",
      );
      return false;
    }
  }, [getOrderAudio]);

  const enableOrderSound = useCallback(async () => {
    getOrderAudio();
    setSoundEnabled(true);
    setSoundError("");
    console.log("Som ativado");
    await playOrderSound();
  }, [getOrderAudio, playOrderSound]);

  const testOrderSound = useCallback(async () => {
    console.log("Testando som");
    setSoundEnabled(true);
    await playOrderSound();
  }, [playOrderSound]);

  const connectPrinter = useCallback(async () => {
    setPrinterConnection("connecting");
    setPrinterMessage("Conectando ao QZ Tray...");
    try {
      const printers = await connectQzTray();
      setAvailablePrinters(printers);
      setPrinterConnection("connected");
      setPrinterMessage(
        printers.length > 0
          ? `${printers.length} impressora${printers.length === 1 ? "" : "s"} encontrada${printers.length === 1 ? "" : "s"}.`
          : "QZ Tray conectado, mas nenhuma impressora foi encontrada.",
      );
      if (!printerPreferencesRef.current.printerName && printers.length === 1) {
        setPrinterPreferences((current) => ({ ...current, printerName: printers[0] }));
      }
      return printers;
    } catch (error) {
      const message = friendlyPrinterError(error);
      setPrinterConnection("error");
      setPrinterMessage(message);
      throw error;
    }
  }, []);

  const testPrinter = useCallback(async () => {
    const preferences = printerPreferencesRef.current;
    try {
      if (!isQzConnected()) await connectPrinter();
      setPrinterMessage("Enviando impressão de teste...");
      await printTestReceipt(preferences);
      setPrinterMessage("Impressão de teste concluída.");
    } catch (error) {
      setPrinterMessage(friendlyPrinterError(error));
    }
  }, [connectPrinter]);

  useEffect(() => {
    if (
      printerPreferencesLoaded &&
      printerPreferences.automaticPrinting &&
      printerPreferences.printerName
    ) {
      void connectPrinter().catch(() => undefined);
    }
  }, [connectPrinter, printerPreferences.automaticPrinting, printerPreferences.printerName, printerPreferencesLoaded]);

  const recordPrintAction = useCallback(
    async (orderId: string, action: "claim" | "complete" | "fail" | "reprint", error?: string) => {
      const response = await fetch(`/api/orders/${orderId}/print`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, error }),
      });
      const body = (await response.json()) as { claimed?: boolean; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Não foi possível registrar a impressão.");
      return body;
    },
    [],
  );

  const performOrderPrint = useCallback(
    async (
      order: OrderRecord,
      options: { reprint?: boolean; trigger: "receive" | "accept" | "manual" },
    ) => {
      const preferences = printerPreferencesRef.current;
      const automatic = options.trigger !== "manual";

      if (
        automatic &&
        (!supportsAutomaticPrinting() ||
          !preferences.automaticPrinting ||
          (options.trigger === "receive" && !preferences.printOnReceive) ||
          (options.trigger === "accept" && !preferences.printOnAccept))
      ) {
        return;
      }

      if (automatic && order.printed_at) {
        return;
      }

      const reprint = !automatic && (options.reprint === true || Boolean(order.printed_at));
      let claimed = reprint;

      try {
        if (reprint) {
          await recordPrintAction(order.id, "reprint");
        } else {
          const claim = await recordPrintAction(order.id, "claim");
          claimed = claim.claimed === true;
          if (!claimed) {
            if (!automatic) setPrinterMessage("Esta comanda já foi impressa ou está sendo impressa em outro computador.");
            return;
          }
        }

        setPrintingOrderIds((current) => new Set(current).add(order.id));
        setPrinterMessage(`Imprimindo pedido ${formatOrderNumber(order.order_number)}...`);

        if (!isQzConnected()) await connectPrinter();
        if (preferences.playSoundBeforePrint) await playOrderSound();
        await printOrderReceipt(order, preferences, reprint);

        if (!reprint) await recordPrintAction(order.id, "complete");
        const printedAt = new Date().toISOString();
        setOrders((current) =>
          current.map((currentOrder) =>
            currentOrder.id === order.id
              ? {
                  ...currentOrder,
                  printed_at: reprint ? currentOrder.printed_at : printedAt,
                  print_status: "printed",
                  print_error: null,
                  print_attempts: reprint
                    ? (currentOrder.print_attempts ?? 0) + 1
                    : Math.max(currentOrder.print_attempts ?? 0, (order.print_attempts ?? 0) + 1),
                  print_updated_at: printedAt,
                }
              : currentOrder,
          ),
        );
        setPrinterMessage(
          `${reprint ? "Reimpressão" : "Impressão"} do pedido ${formatOrderNumber(order.order_number)} concluída.`,
        );
      } catch (error) {
        const message = friendlyPrinterError(error);
        if (claimed && !reprint) {
          void recordPrintAction(order.id, "fail", message).catch(() => undefined);
          setOrders((current) =>
            current.map((currentOrder) =>
              currentOrder.id === order.id
                ? { ...currentOrder, print_status: "failed", print_error: message }
                : currentOrder,
            ),
          );
        }
        setPrinterConnection(isQzConnected() ? "connected" : "error");
        setPrinterMessage(message);
      } finally {
        setPrintingOrderIds((current) => {
          const next = new Set(current);
          next.delete(order.id);
          return next;
        });
      }
    },
    [connectPrinter, playOrderSound, recordPrintAction],
  );

  const queueOrderPrint = useCallback(
    (order: OrderRecord, options: { reprint?: boolean; trigger: "receive" | "accept" | "manual" }) => {
      const job = printQueueRef.current
        .catch(() => undefined)
        .then(() => performOrderPrint(order, options));
      printQueueRef.current = job;
      return job;
    },
    [performOrderPrint],
  );

  const installAdminPwa = useCallback(async () => {
    if (isAdminAppInstalled) {
      setStatus("Painel admin ja esta instalado no celular.");
      return;
    }

    if (!installPrompt) {
      setStatus(
        "Instalacao ainda nao disponivel. No celular, use Adicionar a tela inicial se o navegador mostrar essa opcao.",
      );
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      setInstallPrompt(null);
      setStatus(
        choice.outcome === "accepted"
          ? "Instalacao do painel admin iniciada."
          : "Instalacao do painel admin cancelada.",
      );
    } catch (error) {
      console.log("Erro ao abrir instalacao do PWA", error);
      setStatus("Nao foi possivel abrir a instalacao agora.");
    }
  }, [installPrompt, isAdminAppInstalled]);

  const playNewOrderSound = useCallback(async () => {
    if (!soundEnabledRef.current) {
      return;
    }

    await playOrderSound();
  }, [playOrderSound]);

  const notifyNewOrder = useCallback(
    (order: OrderRecord) => {
      if (order.status !== "Novo") {
        return;
      }

      setHighlightedOrderId(order.id);
      setNotification({ order, visible: true });
      setStatus(`Novo pedido recebido! ${formatOrderNumber(order.order_number)}.`);
      if (typeof navigator.vibrate === "function") {
        navigator.vibrate(500);
      }
      console.log("Novo pedido detectado");
      void playNewOrderSound();
      void queueOrderPrint(order, { trigger: "receive" });
    },
    [playNewOrderSound, queueOrderPrint],
  );

  const dashboardMetrics = useMemo(() => {
    const todayKey = new Date().toLocaleDateString("pt-BR");
    const todayOrders = orders.filter(
      (order) => new Date(order.created_at).toLocaleDateString("pt-BR") === todayKey,
    );
    const finishedToday = todayOrders.filter((order) => order.status === "Finalizado");
    const revenue = finishedToday.reduce((total, order) => total + order.total, 0);

    return {
      preparing: orders.filter((order) => order.status === "Em preparo").length,
      finished: finishedToday.length,
      revenue,
      averageTicket: finishedToday.length ? Math.round(revenue / finishedToday.length) : 0,
    };
  }, [orders]);

  const fetchOrders = useCallback(async () => {
    const response = await fetch("/api/orders", { cache: "no-store" });
    const body = (await response.json()) as {
      orders?: OrderRecord[];
      error?: string;
    };

    if (!response.ok) {
      throw new Error(body.error ?? "Não foi possível carregar os pedidos.");
    }

    return body.orders ?? [];
  }, []);

  const checkForNewOrders = useCallback(
    (nextOrders: OrderRecord[]) => {
      const newOrders = nextOrders.filter(
        (order) => !knownOrderIds.current.has(order.id),
      );

      nextOrders.forEach((order) => knownOrderIds.current.add(order.id));

      const newOrdersToNotify = newOrders.filter(
        (order) =>
          order.status === "Novo" && !notifiedOrderIds.current.has(order.id),
      );

      newOrders.forEach((order) => {
        if (order.status === "Novo") {
          notifiedOrderIds.current.add(order.id);
        }
      });

      newOrdersToNotify.forEach(notifyNewOrder);
      return newOrdersToNotify.length > 0;
    },
    [notifyNewOrder],
  );

  const loadOrders = useCallback(
    async ({ silent = false, detectNew = true } = {}) => {
      if (isFetchingOrdersRef.current) {
        return;
      }

      isFetchingOrdersRef.current = true;

      if (!silent) {
        setOrdersLoading(true);
      }
      setOrdersError("");

      try {
        const nextOrders = await fetchOrders();
        const hasNewOrder = detectNew ? checkForNewOrders(nextOrders) : false;
        if (!detectNew) {
          nextOrders.forEach((order) => {
            knownOrderIds.current.add(order.id);
            if (order.status === "Novo") notifiedOrderIds.current.add(order.id);
          });
        }

        setOrders(nextOrders);
        latestOrdersRef.current = nextOrders;
        setOrdersError("");
        if (!hasNewOrder) {
          setStatus(
            nextOrders.length > 0
              ? `${nextOrders.length} pedido${nextOrders.length === 1 ? "" : "s"} carregado${nextOrders.length === 1 ? "" : "s"}.`
              : "Nenhum pedido recebido ainda.",
          );
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível carregar os pedidos.";

        setOrdersError(message);
        setStatus(message);
      } finally {
        isFetchingOrdersRef.current = false;
        if (!silent) {
          setOrdersLoading(false);
        }
      }
    },
    [checkForNewOrders, fetchOrders],
  );

  useEffect(() => {
    const pollingInterval = window.setInterval(() => {
      void loadOrders({ silent: true });
    }, 5000);
    let supabaseChannel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;
    let isMounted = true;

    async function setupRealtime() {
      if (!isSupabaseConfigured()) {
        return;
      }

      try {
        const supabase = createClient();
        const channel = supabase
          .channel("orders-listener")
          .on(
            "postgres_changes",
            { event: "INSERT", schema: "public", table: "orders" },
            (payload) => {
              const newOrder = payload.new as OrderRecord | null;

              if (!newOrder ||
                knownOrderIds.current.has(newOrder.id)) {
                return;
              }

              if (isMounted) {
                knownOrderIds.current.add(newOrder.id);
                latestOrdersRef.current = [newOrder, ...latestOrdersRef.current];
                setOrders((currentOrders) => {
                  const hasOrder = currentOrders.some(
                    (order) => order.id === newOrder.id,
                  );
                  return hasOrder ? currentOrders : [newOrder, ...currentOrders];
                });

                if (
                  newOrder.status === "Novo" &&
                  !notifiedOrderIds.current.has(newOrder.id)
                ) {
                  notifiedOrderIds.current.add(newOrder.id);
                  notifyNewOrder(newOrder);
                }
              }
            },
          )
          .on(
            "postgres_changes",
            { event: "UPDATE", schema: "public", table: "orders" },
            (payload) => {
              const updatedOrder = payload.new as OrderRecord | null;
              if (!updatedOrder) {
                return;
              }

              setOrders((currentOrders) =>
                currentOrders.map((order) =>
                  order.id === updatedOrder.id ? updatedOrder : order,
                ),
              );
              latestOrdersRef.current = latestOrdersRef.current.map((order) =>
                order.id === updatedOrder.id ? updatedOrder : order,
              );
              knownOrderIds.current.add(updatedOrder.id);

              if (updatedOrder.status !== "Novo") {
                setHighlightedOrderId((currentId) =>
                  currentId === updatedOrder.id ? null : currentId,
                );
                setNotification((currentNotification) =>
                  currentNotification?.order.id === updatedOrder.id
                    ? null
                    : currentNotification,
                );
              }
            },
          );

        channel.subscribe((subscriptionStatus, error) => {
          if (subscriptionStatus === "SUBSCRIBED") {
            console.log("Supabase Realtime conectado");
          }

          if (subscriptionStatus === "CHANNEL_ERROR" || error) {
            console.log("Erro no Supabase Realtime", error);
          }
        });
        supabaseChannel = channel;
      } catch (error) {
        console.log("Erro no Supabase Realtime", error);
      }
    }

    void setupRealtime();

    return () => {
      isMounted = false;
      window.clearInterval(pollingInterval);
      if (supabaseChannel) {
        void supabaseChannel.unsubscribe();
      }
    };
  }, [loadOrders, notifyNewOrder]);

  const updateOrderDeliveryFee = useCallback(
    async (orderId: string, deliveryFee: number) => {
      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ delivery_fee: deliveryFee }),
        });
        const body = (await response.json()) as {
          order?: OrderRecord;
          error?: string;
        };

        if (!response.ok || !body.order) {
          throw new Error(body.error ?? "Não foi possível atualizar a taxa de entrega.");
        }

        setOrders((currentOrders) =>
          currentOrders.map((order) => (order.id === orderId ? body.order! : order)),
        );
        setStatus(`Taxa de entrega do pedido #${body.order.order_number} atualizada.`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Erro desconhecido.";
        setStatus(message);
      }
    },
    [],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, nextStatus: OrderStatus) => {
      const previousOrder = latestOrdersRef.current.find((order) => order.id === orderId);
      try {
        const response = await fetch(`/api/orders/${orderId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status: nextStatus }),
        });
        const body = (await response.json()) as {
          order?: OrderRecord;
          error?: string;
        };

        if (!response.ok || !body.order) {
          throw new Error(body.error ?? "Não foi possível atualizar o pedido.");
        }

        setOrders((currentOrders) =>
          currentOrders.map((order) => (order.id === orderId ? body.order! : order)),
        );
        latestOrdersRef.current = latestOrdersRef.current.map((order) =>
          order.id === orderId ? body.order! : order,
        );
        if (nextStatus !== "Novo") {
          setHighlightedOrderId((currentId) =>
            currentId === orderId ? null : currentId,
          );
          setNotification((currentNotification) =>
            currentNotification?.order.id === orderId ? null : currentNotification,
          );
        }
        setStatus(`Pedido #${body.order.order_number} atualizado para ${nextStatus}.`);
        if (previousOrder?.status === "Novo" && nextStatus === "Em preparo") {
          void queueOrderPrint(body.order, { trigger: "accept" });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível atualizar o pedido.";

        setOrdersError(message);
        setStatus(message);
      }
    },
    [queueOrderPrint],
  );

  function updateCatalog(updater: (currentCatalog: CatalogData) => CatalogData) {
    const nextCatalog = updater(catalog);

    window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(nextCatalog));
    window.dispatchEvent(new Event("dna-catalog-updated"));
  }

  function publishCatalog() {
    window.localStorage.setItem(CATALOG_STORAGE_KEY, JSON.stringify(catalog));
    window.dispatchEvent(new Event("dna-catalog-updated"));
    setStatus(`Catálogo publicado às ${new Date().toLocaleTimeString("pt-BR")}.`);
  }

  function resetCatalog() {
    const shouldReset = window.confirm("Restaurar o catálogo padrão?");

    if (!shouldReset) {
      return;
    }

    window.localStorage.removeItem(CATALOG_STORAGE_KEY);
    window.localStorage.removeItem(LEGACY_CATALOG_STORAGE_KEY);
    window.dispatchEvent(new Event("dna-catalog-updated"));
    setSelectedProductId(initialCatalog.products[0]?.id ?? "");
    setSelectedCategoryId(initialCatalog.categories[0]?.id ?? "");
    setSelectedGroupId(initialCatalog.complementGroups[0]?.id ?? "");
    setStatus("Catálogo padrão restaurado.");
  }

  function exportCatalog() {
    const blob = new Blob([JSON.stringify(catalog, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "dna-do-acai-catalogo.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Arquivo de catálogo exportado.");
  }

  function addCategory() {
    const category: Category = {
      id: createId("categoria", "Nova categoria", catalog.categories.map(({ id }) => id)),
      name: "Nova categoria",
      description: "Descrição da categoria.",
    };

    updateCatalog((currentCatalog) => ({
      ...currentCatalog,
      categories: [...currentCatalog.categories, category],
    }));
    setSelectedCategoryId(category.id);
    setActiveTab("categories");
    setStatus("Categoria criada.");
  }

  function updateCategory(categoryId: string, patch: Partial<Category>) {
    updateCatalog((currentCatalog) => ({
      ...currentCatalog,
      categories: currentCatalog.categories.map((category) =>
        category.id === categoryId ? { ...category, ...patch } : category,
      ),
    }));
    setStatus("Categoria atualizada.");
  }

  function deleteCategory(categoryId: string) {
    const productCount = catalog.products.filter(
      (product) => product.categoryId === categoryId,
    ).length;

    if (productCount > 0) {
      setStatus("Mova ou exclua os produtos antes de remover a categoria.");
      return;
    }

    updateCatalog((currentCatalog) => ({
      ...currentCatalog,
      categories: currentCatalog.categories.filter(
        (category) => category.id !== categoryId,
      ),
    }));
    setSelectedCategoryId(catalog.categories.find(({ id }) => id !== categoryId)?.id ?? "");
    setStatus("Categoria removida.");
  }

  function addProduct() {
    const product: Product = {
      id: createId("produto", "Novo produto", catalog.products.map(({ id }) => id)),
      active: true,
      categoryId: catalog.categories[0]?.id ?? "",
      name: "Novo produto",
      description: "Descrição do produto.",
      price: 1990,
      serves: "300 ml",
      preparationTime: "10-20 min",
      image: defaultProductImage,
      imagePosition: "50% 46%",
      customizable: false,
    };

    updateCatalog((currentCatalog) => ({
      ...currentCatalog,
      products: [...currentCatalog.products, product],
    }));
    setSelectedProductId(product.id);
    setActiveTab("products");
    setStatus("Produto criado.");
  }

  function updateProduct(productId: string, patch: Partial<Product>) {
    updateCatalog((currentCatalog) => ({
      ...currentCatalog,
      products: currentCatalog.products.map((product) =>
        product.id === productId ? { ...product, ...patch } : product,
      ),
    }));
    setStatus("Produto atualizado.");
  }

  function deleteProduct(productId: string) {
    const shouldDelete = window.confirm("Excluir este produto?");

    if (!shouldDelete) {
      return;
    }

    updateCatalog((currentCatalog) => ({
      ...currentCatalog,
      products: currentCatalog.products.filter((product) => product.id !== productId),
    }));
    setSelectedProductId(catalog.products.find(({ id }) => id !== productId)?.id ?? "");
    setStatus("Produto removido.");
  }

  function addComplementGroup() {
    const group: ComplementGroup = {
      id: createId(
        "grupo",
        "Novo grupo",
        catalog.complementGroups.map(({ id }) => id),
      ),
      title: "Novo grupo",
      description: "Descrição do grupo.",
      required: false,
      type: "multiple",
      maxSelections: 2,
      options: [],
    };

    updateCatalog((currentCatalog) => ({
      ...currentCatalog,
      complementGroups: [...currentCatalog.complementGroups, group],
    }));
    setSelectedGroupId(group.id);
    setActiveTab("complements");
    setStatus("Grupo de complementos criado.");
  }

  function updateComplementGroup(groupId: string, patch: Partial<ComplementGroup>) {
    updateCatalog((currentCatalog) => ({
      ...currentCatalog,
      complementGroups: currentCatalog.complementGroups.map((group) =>
        group.id === groupId ? { ...group, ...patch } : group,
      ),
    }));
    setStatus("Grupo de complementos atualizado.");
  }

  function deleteComplementGroup(groupId: string) {
    const shouldDelete = window.confirm("Excluir este grupo de complementos?");

    if (!shouldDelete) {
      return;
    }

    updateCatalog((currentCatalog) => ({
      ...currentCatalog,
      complementGroups: currentCatalog.complementGroups.filter(
        (group) => group.id !== groupId,
      ),
    }));
    setSelectedGroupId(
      catalog.complementGroups.find(({ id }) => id !== groupId)?.id ?? "",
    );
    setStatus("Grupo de complementos removido.");
  }

  function addComplementOption(groupId: string) {
    const group = catalog.complementGroups.find(({ id }) => id === groupId);

    if (!group) {
      return;
    }

    const option: ComplementOption = {
      id: createId("opcao", "Nova opção", group.options.map(({ id }) => id)),
      name: "Nova opção",
      description: "",
      price: 0,
    };

    updateComplementGroup(groupId, {
      options: [...group.options, option],
    });
    setStatus("Opção adicionada.");
  }

  function updateComplementOption(
    groupId: string,
    optionId: string,
    patch: Partial<ComplementOption>,
  ) {
    const group = catalog.complementGroups.find(({ id }) => id === groupId);

    if (!group) {
      return;
    }

    updateComplementGroup(groupId, {
      options: group.options.map((option) =>
        option.id === optionId ? { ...option, ...patch } : option,
      ),
    });
  }

  function deleteComplementOption(groupId: string, optionId: string) {
    const group = catalog.complementGroups.find(({ id }) => id === groupId);

    if (!group) {
      return;
    }

    updateComplementGroup(groupId, {
      options: group.options.filter((option) => option.id !== optionId),
    });
    setStatus("Opção removida.");
  }

  async function toggleStoreStatus() {
    if (storeState.isUpdating || !isStoreStatusKnown) {
      return;
    }

    const nextStatus: StoreStatus = isStoreOpen ? "closed" : "open";

    try {
      const updatedStatus = await storeState.setStatus(nextStatus);
      setStatus(`${getStoreStatusLabel(updatedStatus.status)} publicada.`);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Nao foi possivel atualizar o status da loja.";

      setStatus(message);
    }
  }

  async function logoutAdmin() {
    try {
      if (isSupabaseConfigured()) {
        await createClient().auth.signOut();
      }
    } finally {
      window.location.assign("/");
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#f5f6f3] pb-24 text-[#16221a] lg:pb-8">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0b3425]/95 text-white shadow-lg backdrop-blur">
        <div className="mx-auto flex min-h-[72px] max-w-[1500px] items-center justify-between gap-2 px-3 py-2 sm:gap-3 sm:px-4 lg:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Image src={BRAND_LOGO_SRC} alt="DNA do Açaí" width={52} height={52} priority className="size-10 shrink-0 object-contain sm:size-12" />
            <div className="hidden min-w-0 md:block">
              <p className="truncate text-base font-bold">DNA do Açaí</p>
              <p className="text-xs text-white/65">Central de operações</p>
            </div>
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-5 items-center justify-items-end gap-1 sm:flex sm:justify-end sm:gap-2">
            <button type="button" disabled={storeState.isUpdating || !isStoreStatusKnown} onClick={() => void toggleStoreStatus()} className={`inline-flex min-h-11 w-full items-center justify-center gap-1 rounded-xl px-1 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:gap-2 sm:px-3 sm:text-sm ${!isStoreStatusKnown ? "bg-[#647069]" : isStoreOpen ? "bg-[#178a4b]" : "bg-[#c93636]"}`}>
              <span className="hidden size-2.5 rounded-full bg-white sm:block" />
              <span className="hidden sm:inline">Loja </span>{!isStoreStatusKnown ? "indisponível" : isStoreOpen ? "aberta" : "fechada"}
            </button>
            <button type="button" onClick={() => setActiveTab("orders")} title="Ver novos pedidos" aria-label={`${newOrdersCount} pedidos novos`} className="relative grid size-11 place-items-center rounded-xl bg-white/10 text-lg transition hover:bg-white/20">☷{newOrdersCount > 0 ? <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-[#d7a948] px-1 text-[10px] font-black leading-5 text-[#103d2c]">{newOrdersCount}</span> : null}</button>
            <button type="button" onClick={() => void enableOrderSound()} title="Ativar som de pedidos" aria-label="Ativar som de pedidos" className={`grid size-11 place-items-center rounded-xl text-lg transition ${soundEnabled ? "bg-[#d7a948] text-[#103d2c]" : "bg-white/10 hover:bg-white/20"}`}>♫</button>
            <button type="button" onClick={() => void testOrderSound()} title="Testar som" aria-label="Testar som" className="hidden size-11 place-items-center rounded-xl bg-white/10 text-sm transition hover:bg-white/20 sm:grid">▶</button>
            <button type="button" onClick={() => void loadOrders()} title="Atualizar pedidos" aria-label="Atualizar pedidos" className="grid size-11 place-items-center rounded-xl bg-white/10 text-xl transition hover:bg-white/20">↻</button>
            <button type="button" onClick={() => void logoutAdmin()} title="Sair do painel" className="grid size-11 place-items-center rounded-xl border border-white/20 text-lg transition hover:bg-white/10" aria-label="Sair do painel">↗</button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden min-h-[calc(100vh-72px)] border-r border-[#103d2c]/10 bg-white p-4 lg:block">
          <nav className="sticky top-[88px] space-y-2">
            {tabs.map((tab) => {
              const badgeCount = tab.id === "orders" ? newOrdersCount : 0;
              return (
                <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)} className={`flex min-h-12 w-full items-center justify-between rounded-xl px-4 text-left text-sm font-bold transition ${activeTab === tab.id || (tab.id === "settings" && ["images", "categories", "complements"].includes(activeTab)) ? "bg-[#103d2c] text-white shadow-md" : "text-[#425448] hover:bg-[#edf3ef]"}`}>
                  <span>{tab.label}</span>
                  {badgeCount > 0 ? <span className="rounded-full bg-[#d7a948] px-2 py-0.5 text-xs text-[#103d2c]">{badgeCount}</span> : null}
                </button>
              );
            })}
            <div className="mt-6 rounded-2xl bg-[#f1ead8] p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-[#4b164c]">Status do painel</p>
              <p className="mt-2 text-sm leading-5 text-[#526354]">{status}</p>
            </div>
          </nav>
        </aside>

        <section className="min-w-0 p-4 md:p-6 lg:p-8">
          {activeTab === "home" ? (
            <DashboardOverview
              averageTicket={dashboardMetrics.averageTicket}
              finished={dashboardMetrics.finished}
              storeStatus={storeState.status}
              newOrders={newOrdersCount}
              preparing={dashboardMetrics.preparing}
              revenue={dashboardMetrics.revenue}
              onAddProduct={addProduct}
              onEnableSound={() => void enableOrderSound()}
              onGoOrders={() => setActiveTab("orders")}
              onGoProducts={() => setActiveTab("products")}
              onTestSound={() => void testOrderSound()}
              onToggleStore={() => void toggleStoreStatus()}
            />
          ) : null}

          {activeTab === "orders" ? (
            <OrdersPanel
              error={ordersError}
              highlightedOrderId={highlightedOrderId}
              loading={ordersLoading}
              orders={orders}
              onRefresh={() => loadOrders({ detectNew: false })}
              onPrint={(order, reprint) =>
                queueOrderPrint(order, { trigger: "manual", reprint })
              }
              printingOrderIds={printingOrderIds}
              printerMessage={printerMessage}
              onUpdateStatus={updateOrderStatus}
              onUpdateDeliveryFee={updateOrderDeliveryFee}
              onEnableSound={() => void enableOrderSound()}
              onTestSound={() => void testOrderSound()}
              soundError={soundError}
              soundEnabled={soundEnabled}
            />
          ) : null}

          {activeTab === "products" ? (
            <ProductsPanel
              categories={catalog.categories}
              product={selectedProduct}
              products={catalog.products}
              selectedProductId={selectedProductId}
              onAdd={addProduct}
              onDelete={deleteProduct}
              onSelect={setSelectedProductId}
              onUpdate={updateProduct}
            />
          ) : null}

          {activeTab === "settings" ? (
            <SettingsPanel
              isAdminAppInstalled={isAdminAppInstalled}
              storeStatus={storeState.status}
              soundEnabled={soundEnabled}
              onEnableSound={() => void enableOrderSound()}
              onExport={exportCatalog}
              onInstall={() => void installAdminPwa()}
              onNavigate={setActiveTab}
              onPublish={publishCatalog}
              onReset={resetCatalog}
              onTestSound={() => void testOrderSound()}
              onToggleStore={() => void toggleStoreStatus()}
              printerSettings={
                <PrinterSettingsPanel
                  availablePrinters={availablePrinters}
                  connection={printerConnection}
                  message={printerMessage}
                  preferences={printerPreferences}
                  onChange={(patch) =>
                    setPrinterPreferences((current) => ({ ...current, ...patch }))
                  }
                  onConnect={() => void connectPrinter().catch(() => undefined)}
                  onTest={() => void testPrinter()}
                />
              }
            />
          ) : null}

          {activeTab === "images" ? (
            <ImagesPanel products={catalog.products} onUpdate={updateProduct} />
          ) : null}

          {activeTab === "categories" ? (
            <CategoriesPanel
              category={selectedCategory}
              categories={catalog.categories}
              products={catalog.products}
              selectedCategoryId={selectedCategoryId}
              onAdd={addCategory}
              onDelete={deleteCategory}
              onSelect={setSelectedCategoryId}
              onUpdate={updateCategory}
            />
          ) : null}

          {activeTab === "complements" ? (
            <ComplementsPanel
              group={selectedGroup}
              groups={catalog.complementGroups}
              selectedGroupId={selectedGroupId}
              onAddGroup={addComplementGroup}
              onAddOption={addComplementOption}
              onDeleteGroup={deleteComplementGroup}
              onDeleteOption={deleteComplementOption}
              onSelectGroup={setSelectedGroupId}
              onUpdateGroup={updateComplementGroup}
              onUpdateOption={updateComplementOption}
            />
          ) : null}
        </section>
        {notification?.visible ? <NotificationToast /> : null}
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#103d2c]/10 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.45rem)] pt-2 shadow-[0_-8px_30px_rgba(7,27,18,0.12)] backdrop-blur lg:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-[repeat(4,minmax(0,1fr))] gap-1">
          {tabs.map((tab) => {
            const badgeCount = tab.id === "orders" ? newOrdersCount : 0;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex min-h-14 min-w-0 w-full flex-col items-center justify-center rounded-xl px-1 text-center text-[11px] font-bold transition ${
                  activeTab === tab.id || (tab.id === "settings" && ["images", "categories", "complements"].includes(activeTab))
                    ? "bg-[#103d2c] text-white"
                    : "text-[#103d2c] hover:bg-[#f3ead2]"
                }`}
              >
                <span>{tab.shortLabel}</span>
                {badgeCount > 0 ? (
                  <span className="absolute right-1 top-1 min-w-5 rounded-full bg-[#d7a948] px-1 text-[10px] leading-5 text-[#103d2c]">
                    {badgeCount}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </nav>
    </main>
  );

  function NotificationToast() {
    if (!notification?.visible) {
      return null;
    }

    const newestOrder = notification.order;

    return (
      <div
        aria-live="assertive"
        className="fixed left-4 right-4 top-24 z-50 rounded-[8px] border border-[#d7a948]/40 bg-white p-4 shadow-[0_20px_60px_rgba(16,61,44,0.16)] sm:left-auto sm:w-[min(26rem,calc(100vw-2rem))]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d97706]">
              Novo pedido recebido!
            </p>
            <p className="mt-2 text-sm font-semibold text-[#103d2c]">
              {formatOrderNumber(newestOrder.order_number)} • {newestOrder.customer_name}
            </p>
            <p className="mt-1 text-sm leading-6 text-[#526354]">
              {formatDateTime(newestOrder.created_at)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNotification(null)}
            className="text-sm font-semibold text-[#4b164c] transition hover:text-[#103d2c]"
          >
            Fechar
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab("orders");
              setHighlightedOrderId(newestOrder.id);
              setNotification(null);
              window.setTimeout(() => {
                const element = document.getElementById(`order-${newestOrder.id}`);
                if (element) {
                  element.scrollIntoView({ behavior: "smooth", block: "center" });
                }
              }, 0);
              window.setTimeout(() => {
                setHighlightedOrderId((currentId) =>
                  currentId === newestOrder.id ? null : currentId,
                );
              }, 1500);
            }}
            className="min-h-10 rounded-[8px] border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition hover:bg-[#d7a948] hover:text-[#103d2c]"
          >
            Ver pedido
          </button>
          <button
            type="button"
            onClick={() => {
              updateOrderStatus(newestOrder.id, "Em preparo");
              setNotification(null);
            }}
            className="min-h-10 rounded-[8px] border border-[#d7a948] bg-[#d7a948] px-4 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f1cf77]"
          >
            Marcar como em preparo
          </button>
        </div>
      </div>
    );
  }
}

function DashboardOverview({
  averageTicket,
  finished,
  storeStatus,
  newOrders,
  preparing,
  revenue,
  onAddProduct,
  onEnableSound,
  onGoOrders,
  onGoProducts,
  onTestSound,
  onToggleStore,
}: {
  averageTicket: number;
  finished: number;
  storeStatus: StoreStatus | null;
  newOrders: number;
  preparing: number;
  revenue: number;
  onAddProduct: () => void;
  onEnableSound: () => void;
  onGoOrders: () => void;
  onGoProducts: () => void;
  onTestSound: () => void;
  onToggleStore: () => void;
}) {
  const isStoreOpen = storeStatus === "open";
  const isStoreStatusKnown = storeStatus !== null;
  const metrics = [
    { label: "Pedidos novos", value: String(newOrders), tone: "text-[#b45309] bg-[#fff7e6]" },
    { label: "Em preparo", value: String(preparing), tone: "text-[#5b21b6] bg-[#f4f0ff]" },
    { label: "Finalizados hoje", value: String(finished), tone: "text-[#14743f] bg-[#eaf8ef]" },
    { label: "Faturamento do dia", value: formatCurrency(revenue), tone: "text-[#103d2c] bg-[#e9f1ec]" },
    { label: "Ticket médio", value: formatCurrency(averageTicket), tone: "text-[#4b164c] bg-[#f6edf6]" },
    { label: "Status da loja", value: !isStoreStatusKnown ? "Indisponível" : isStoreOpen ? "Aberta" : "Fechada", tone: !isStoreStatusKnown ? "text-[#526354] bg-[#edf0ee]" : isStoreOpen ? "text-[#14743f] bg-[#eaf8ef]" : "text-[#b42323] bg-[#fff0f0]" },
  ];
  const actions = [
    { label: "Ver pedidos novos", detail: `${newOrders} aguardando ação`, action: onGoOrders },
    { label: !isStoreStatusKnown ? "Status indisponível" : isStoreOpen ? "Fechar loja" : "Abrir loja", detail: isStoreStatusKnown ? "Atualiza imediatamente" : "Verifique a conexão com o banco", action: onToggleStore },
    { label: "Cadastrar produto", detail: "Adicionar ao cardápio", action: onAddProduct },
    { label: "Alterar preços", detail: "Gerenciar produtos", action: onGoProducts },
    { label: "Ativar som", detail: "Liberar alertas", action: onEnableSound },
    { label: "Testar som", detail: "Ouvir notificação", action: onTestSound },
  ];

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.14em] text-[#8a6a26]">Visão geral</p>
        <h1 className="mt-1 text-2xl font-bold text-[#103d2c] md:text-3xl">Olá! Acompanhe sua operação.</h1>
        <p className="mt-2 text-sm text-[#66736a]">Dados de hoje atualizados automaticamente.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        {metrics.map((metric) => (
          <article key={metric.label} className="rounded-2xl border border-[#103d2c]/8 bg-white p-4 shadow-sm md:p-5">
            <div className={`inline-flex rounded-xl px-3 py-1.5 text-xs font-bold ${metric.tone}`}>{metric.label}</div>
            <p className="mt-4 break-words text-2xl font-black text-[#17251c] md:text-3xl">{metric.value}</p>
          </article>
        ))}
      </div>
      <section className="rounded-2xl border border-[#103d2c]/8 bg-white p-4 shadow-sm md:p-6">
        <h2 className="text-lg font-bold text-[#103d2c]">Ações rápidas</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {actions.map((item) => (
            <button key={item.label} type="button" onClick={item.action} className="min-h-[76px] rounded-xl border border-[#103d2c]/10 bg-[#fafbf9] px-4 text-left transition hover:border-[#d7a948] hover:bg-[#fffaf0] active:scale-[.99]">
              <span className="block font-bold text-[#103d2c]">{item.label}</span>
              <span className="mt-1 block text-xs text-[#68756c]">{item.detail}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function PrinterSettingsPanel({
  availablePrinters,
  connection,
  message,
  preferences,
  onChange,
  onConnect,
  onTest,
}: {
  availablePrinters: string[];
  connection: PrinterConnectionState;
  message: string;
  preferences: PrinterPreferences;
  onChange: (patch: Partial<PrinterPreferences>) => void;
  onConnect: () => void;
  onTest: () => void;
}) {
  const connected = connection === "connected";
  const fieldClass = "min-h-12 rounded-xl border border-[#103d2c]/15 bg-white px-3 text-sm font-semibold text-[#103d2c] outline-none focus:border-[#d7a948]";

  return (
    <section className="rounded-2xl border border-[#4b164c]/15 bg-white p-4 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-[#4b164c]">Impressora de pedidos</p>
          <h2 className="mt-1 text-xl font-bold text-[#103d2c]">Comandas térmicas com QZ Tray</h2>
          <p className="mt-2 text-sm text-[#68756c]">Configure no computador da loja. Celulares mantêm apenas a impressão manual.</p>
        </div>
        <div className={`inline-flex min-h-10 items-center gap-2 self-start rounded-full px-3 text-xs font-bold ${connected ? "bg-[#eaf8ef] text-[#14743f]" : connection === "error" ? "bg-[#fff0f0] text-[#b42323]" : "bg-[#edf0ee] text-[#526354]"}`}>
          <span className={`size-2 rounded-full ${connected ? "bg-[#178a4b]" : connection === "connecting" ? "bg-[#d7a948]" : "bg-[#c93636]"}`} />
          {connection === "connecting" ? "Conectando" : connected ? "QZ Tray conectado" : "QZ Tray desconectado"}
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4b164c]">
          Impressora
          <select value={preferences.printerName} onChange={(event) => onChange({ printerName: event.target.value })} className={fieldClass}>
            <option value="">Selecione uma impressora</option>
            {availablePrinters.map((printer) => <option key={printer} value={printer}>{printer}</option>)}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2 self-end">
          <button type="button" onClick={onConnect} className="min-h-12 rounded-xl bg-[#103d2c] px-3 text-sm font-bold text-white">Conectar impressora</button>
          <button type="button" onClick={onTest} disabled={!preferences.printerName} className="min-h-12 rounded-xl border border-[#4b164c]/20 bg-[#f6edf6] px-3 text-sm font-bold text-[#4b164c] disabled:opacity-50">Testar impressão</button>
        </div>
        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4b164c]">Largura do papel<select value={preferences.paperWidth} onChange={(event) => onChange({ paperWidth: Number(event.target.value) as 58 | 80 })} className={fieldClass}><option value={58}>58 mm</option><option value={80}>80 mm</option></select></label>
        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4b164c]">Quantidade de vias<select value={preferences.copies} onChange={(event) => onChange({ copies: Number(event.target.value) as 1 | 2 })} className={fieldClass}><option value={1}>1 via</option><option value={2}>2 vias</option></select></label>
        <label className="grid gap-1.5 text-xs font-bold uppercase tracking-wider text-[#4b164c]">Formato<select value={preferences.mode} onChange={(event) => onChange({ mode: event.target.value as PrinterPreferences["mode"] })} className={fieldClass}><option value="escpos">ESC/POS (recomendado)</option><option value="html">HTML compatível</option></select></label>
      </div>

      <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <PrinterToggle label="Impressão automática" checked={preferences.automaticPrinting} onChange={(checked) => onChange({ automaticPrinting: checked })} />
        <PrinterToggle label="Tocar som antes" checked={preferences.playSoundBeforePrint} onChange={(checked) => onChange({ playSoundBeforePrint: checked })} />
        <PrinterToggle label="Imprimir ao receber" checked={preferences.printOnReceive} onChange={(checked) => onChange({ printOnReceive: checked })} />
        <PrinterToggle label="Imprimir ao aceitar" checked={preferences.printOnAccept} onChange={(checked) => onChange({ printOnAccept: checked })} />
      </div>

      <p aria-live="polite" className={`mt-4 rounded-xl p-3 text-sm font-semibold ${connection === "error" || message.toLocaleLowerCase("pt-BR").includes("falha") ? "bg-[#fff0f0] text-[#b42323]" : "bg-[#edf3ef] text-[#425448]"}`}>{message}</p>
    </section>
  );
}

function PrinterToggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-[#103d2c]/10 bg-[#fafbf9] px-3 text-sm font-bold text-[#103d2c]">
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="size-5 accent-[#103d2c]" />
    </label>
  );
}

function SettingsPanel({
  isAdminAppInstalled,
  storeStatus,
  soundEnabled,
  onEnableSound,
  onExport,
  onInstall,
  onNavigate,
  onPublish,
  onReset,
  onTestSound,
  onToggleStore,
  printerSettings,
}: {
  isAdminAppInstalled: boolean;
  storeStatus: StoreStatus | null;
  soundEnabled: boolean;
  onEnableSound: () => void;
  onExport: () => void;
  onInstall: () => void;
  onNavigate: (tab: AdminTab) => void;
  onPublish: () => void;
  onReset: () => void;
  onTestSound: () => void;
  onToggleStore: () => void;
  printerSettings: ReactNode;
}) {
  const isStoreOpen = storeStatus === "open";
  const isStoreStatusKnown = storeStatus !== null;
  return (
    <div className="space-y-5">
      <div><p className="text-sm font-bold uppercase tracking-[0.14em] text-[#8a6a26]">Administração</p><h1 className="mt-1 text-2xl font-bold text-[#103d2c] md:text-3xl">Configurações</h1></div>
      {printerSettings}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <SettingsCard title="Dados da loja" description="Identidade e informações públicas." />
        <SettingsCard title="WhatsApp" description={`Atendimento: ${WHATSAPP_BUSINESS_PHONE_NUMBER}`} />
        <SettingsCard title="Instagram" description="Dados de contato e rede social." />
        <SettingsCard title="Horário de funcionamento" description="Consulte e organize os horários da loja." />
        <SettingsCard title="Status da loja" description={!isStoreStatusKnown ? "Não foi possível consultar o banco de dados." : isStoreOpen ? "A loja está recebendo pedidos." : "Novos pedidos estão bloqueados."} actionLabel={!isStoreStatusKnown ? undefined : isStoreOpen ? "Fechar loja" : "Abrir loja"} onAction={onToggleStore} />
        <SettingsCard title="Som de pedidos" description={soundEnabled ? "Alertas sonoros ativados." : "Toque para liberar o áudio neste aparelho."} actionLabel={soundEnabled ? "Testar som" : "Ativar som"} onAction={soundEnabled ? onTestSound : onEnableSound} />
        <SettingsCard title="Adicionais pagos" description="Preços dos adicionais e opções extras." actionLabel="Gerenciar" onAction={() => onNavigate("complements")} />
        <SettingsCard title="Complementos" description="Grupos, limites e opções existentes." actionLabel="Gerenciar" onAction={() => onNavigate("complements")} />
        <SettingsCard title="Imagens" description="Imagens e enquadramento dos produtos." actionLabel="Gerenciar" onAction={() => onNavigate("images")} />
        <SettingsCard title="Categorias" description="Organização do cardápio." actionLabel="Gerenciar" onAction={() => onNavigate("categories")} />
        <SettingsCard title="PWA" description={isAdminAppInstalled ? "Aplicativo instalado neste aparelho." : "Instale o painel na tela inicial."} actionLabel={isAdminAppInstalled ? undefined : "Instalar painel"} onAction={onInstall} />
        <SettingsCard title="Segurança" description="Sessão administrativa e acesso protegido." />
      </div>
      <section className="rounded-2xl border border-[#103d2c]/8 bg-white p-5 shadow-sm">
        <h2 className="font-bold text-[#103d2c]">Manutenção do cardápio</h2>
        <div className="mt-4 flex flex-wrap gap-2">
          <button onClick={onPublish} className="min-h-11 rounded-xl bg-[#103d2c] px-4 text-sm font-bold text-white">Publicar catálogo</button>
          <button onClick={onExport} className="min-h-11 rounded-xl border border-[#103d2c]/20 px-4 text-sm font-bold text-[#103d2c]">Exportar JSON</button>
          <button onClick={onReset} className="min-h-11 rounded-xl border border-[#b42323]/20 px-4 text-sm font-bold text-[#b42323]">Restaurar padrão</button>
        </div>
      </section>
    </div>
  );
}

function SettingsCard({ title, description, actionLabel, onAction }: { title: string; description: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <article className="rounded-2xl border border-[#103d2c]/8 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-[#103d2c]">{title}</h2>
      <p className="mt-2 min-h-10 text-sm leading-5 text-[#68756c]">{description}</p>
      {actionLabel && onAction ? <button type="button" onClick={onAction} className="mt-4 min-h-11 w-full rounded-xl bg-[#edf3ef] px-4 text-sm font-bold text-[#103d2c] transition hover:bg-[#d7a948]">{actionLabel}</button> : null}
    </article>
  );
}

function OrdersPanel({
  error,
  highlightedOrderId,
  loading,
  orders,
  onPrint,
  onRefresh,
  onUpdateStatus,
  onUpdateDeliveryFee,
  onEnableSound,
  onTestSound,
  soundError,
  soundEnabled,
  printingOrderIds,
  printerMessage,
}: {
  error: string;
  highlightedOrderId: string | null;
  loading: boolean;
  orders: OrderRecord[];
  onPrint: (order: OrderRecord, reprint: boolean) => void | Promise<void>;
  onRefresh: () => void | Promise<void>;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void | Promise<void>;
  onUpdateDeliveryFee: (orderId: string, deliveryFee: number) => void | Promise<void>;
  onEnableSound: () => void;
  onTestSound: () => void;
  soundError: string;
  soundEnabled: boolean;
  printingOrderIds: Set<string>;
  printerMessage: string;
}) {
  const [activeStatus, setActiveStatus] = useState<OrderStatus>("Novo");
  const filteredOrders = orders.filter((order) => order.status === activeStatus);

  return (
    <PanelShell
      title="Pedidos"
      action={
        <div className="grid w-full grid-cols-2 gap-2 sm:w-auto lg:flex lg:items-center">
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="min-h-12 border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:bg-[#d7a948] hover:text-[#103d2c] lg:min-h-10"
          >
            Atualizar
          </button>
          <button
            type="button"
            onClick={onEnableSound}
            className="min-h-12 border border-[#d7a948] bg-[#d7a948] px-4 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f1cf77] lg:min-h-10"
          >
            {soundEnabled ? "Som ativado" : "Ativar som"}
          </button>
          <button
            type="button"
            onClick={onTestSound}
            className="min-h-12 border border-[#103d2c] bg-white px-4 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f3ead2] lg:min-h-10"
          >
            Testar som
          </button>
        </div>
      }
    >
      <div className="grid gap-4">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {ORDER_STATUSES.map((orderStatus) => {
            const count = orders.filter((order) => order.status === orderStatus).length;
            return (
              <button key={orderStatus} type="button" onClick={() => setActiveStatus(orderStatus)} className={`min-h-11 shrink-0 rounded-xl px-4 text-sm font-bold transition ${activeStatus === orderStatus ? "bg-[#103d2c] text-white" : "bg-[#edf3ef] text-[#425448]"}`}>
                {orderStatus === "Novo" ? "Novos" : orderStatus} <span className="ml-1 opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        {soundError ? (
          <div className="rounded-[8px] border border-[#f8b4b4] bg-[#fff1f2] p-4 text-sm text-[#9f1239]">
            {soundError}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-[8px] border border-[#8a1f2d]/30 bg-[#fff0f2] p-4 text-sm text-[#8a1f2d]">
            {error}
          </div>
        ) : null}

        {loading ? <EmptyState label="Carregando pedidos..." /> : null}

        {!loading && filteredOrders.length === 0 ? (
          <EmptyState label={`Nenhum pedido em “${activeStatus}”.`} />
        ) : null}
        {printerMessage ? (
          <div className="rounded-xl border border-[#103d2c]/10 bg-[#edf3ef] p-3 text-sm font-semibold text-[#425448]">
            Impressora: {printerMessage}
          </div>
        ) : null}

        {!loading
          ? filteredOrders.map((order) => (
              <article
                id={`order-${order.id}`}
                key={order.id}
                className={`scroll-mt-32 rounded-2xl border bg-white p-4 shadow-sm transition md:p-6 ${
                  highlightedOrderId === order.id || order.status === "Novo"
                    ? "admin-new-order border-[#d7a948] shadow-[0_0_0_3px_rgba(215,169,72,0.18),0_18px_50px_rgba(16,61,44,0.10)]"
                    : "border-[#d7a948]/30"
                }`}
              >
                <div className="flex flex-col gap-4 border-b border-[#d7a948]/25 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4b164c]">Pedido {formatOrderNumber(order.order_number)}</p>
                      {order.status === "Novo" ? <span className="rounded-full bg-[#d7a948] px-2 py-1 text-[10px] font-black text-[#103d2c]">NOVO</span> : null}
                      {order.printed_at ? <span className="rounded-full bg-[#eaf8ef] px-2 py-1 text-[10px] font-bold text-[#14743f]">IMPRESSO</span> : null}
                      {order.print_status === "failed" ? <span className="rounded-full bg-[#fff0f0] px-2 py-1 text-[10px] font-bold text-[#b42323]">FALHA NA IMPRESSÃO</span> : null}
                      <span className="rounded-full bg-[#edf3ef] px-2 py-1 text-[10px] font-bold text-[#526354]">Esperando {formatWaitTime(order.created_at)}</span>
                    </div>
                    <h3 className="mt-2 text-2xl font-semibold text-[#103d2c] md:text-xl">
                      {order.customer_name}
                    </h3>
                    <p className="mt-1 text-sm text-[#526354]">
                      {formatDateTime(order.created_at)} / {order.customer_phone}
                    </p>
                  </div>

                  <label
                    className={`grid gap-2 rounded-[8px] border px-3 py-2 ${getOrderStatusClassName(
                      order.status,
                    )}`}
                  >
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-current opacity-75">
                      Status do pedido
                    </span>
                    <select
                      value={order.status}
                      onChange={(event) =>
                        void onUpdateStatus(
                          order.id,
                          event.target.value as OrderStatus,
                        )
                      }
                      className="min-h-12 min-w-0 border border-current/25 bg-white/70 px-3 text-base font-bold text-current outline-none transition focus:border-current lg:min-h-11 lg:text-sm"
                    >
                      {ORDER_STATUSES.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2 border-b border-[#d7a948]/25 py-4 sm:flex sm:flex-wrap">
                  {order.status === "Novo" ? <OrderAction label="Aceitar" onClick={() => void onUpdateStatus(order.id, "Em preparo")} primary /> : null}
                  {order.status === "Em preparo" ? <OrderAction label="Saiu para entrega" onClick={() => void onUpdateStatus(order.id, "Saiu para entrega")} primary /> : null}
                  {order.status === "Saiu para entrega" ? <OrderAction label="Finalizar" onClick={() => void onUpdateStatus(order.id, "Finalizado")} primary /> : null}
                  {order.status !== "Finalizado" && order.status !== "Cancelado" ? <OrderAction label="Cancelar" onClick={() => void onUpdateStatus(order.id, "Cancelado")} danger /> : null}
                  <button type="button" disabled={printingOrderIds.has(order.id)} onClick={() => void onPrint(order, Boolean(order.printed_at))} className="min-h-12 rounded-xl border border-[#4b164c]/25 bg-[#f6edf6] px-4 text-sm font-bold text-[#4b164c] disabled:cursor-wait disabled:opacity-60">
                    {printingOrderIds.has(order.id) ? "Imprimindo..." : order.printed_at ? "Reimprimir comanda" : "Imprimir comanda"}
                  </button>
                  <a href={getCustomerWhatsAppUrl(order.customer_phone)} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#25d366] px-4 text-sm font-bold text-white">Abrir WhatsApp</a>
                </div>
                {order.print_error ? <p className="-mt-1 border-b border-[#d7a948]/25 pb-4 text-xs font-semibold text-[#b42323]">Último erro: {order.print_error}</p> : null}

                <div className="grid gap-4 py-5 lg:grid-cols-3">
                  <OrderInfoBlock
                    label="Endereço"
                    value={
                      order.delivery_method === "delivery"
                        ? [order.address, order.neighborhood]
                            .filter(Boolean)
                            .join(" / ") || "A confirmar"
                        : "Retirada no balcão"
                    }
                  />
                  <OrderInfoBlock
                    label="Pagamento"
                    value={`${order.payment_label}${
                      order.change_for ? ` / Troco: ${order.change_for}` : ""
                    }`}
                  />
                  <OrderInfoBlock
                    label="Observações"
                    value={order.notes || "Sem observações"}
                  />
                </div>

                <div className="border-y border-[#d7a948]/25 py-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4b164c]">
                    Itens e complementos
                  </p>
                  <div className="mt-3 grid gap-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[8px] border border-[#d7a948]/25 bg-[#fffaf0] p-4"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[#103d2c]">
                              {item.quantity}x {item.name}
                            </p>
                            <p className="mt-1 text-xs text-[#526354]">
                              Unitário: {formatCurrency(item.unitPrice)}
                            </p>
                          </div>
                          <p className="text-sm font-semibold text-[#4b164c]">
                            {formatCurrency(item.totalPrice)}
                          </p>
                        </div>

                        {item.customization && item.customization.length > 0 ? (
                          <div className="mt-3 grid gap-3">
                            {item.customization.map((line) => (
                              <div key={`${item.id}-${line.groupTitle}`}>
                                <p className="text-xs font-semibold leading-5 text-[#103d2c]">
                                  {line.groupTitle}:
                                </p>
                                {line.optionsList && line.optionsList.length > 0 ? (
                                  <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-[#526354]">
                                    {line.optionsList.map((option) => (
                                      <li key={`${line.groupTitle}-${option}`}>
                                        {option}
                                      </li>
                                    ))}
                                  </ul>
                                ) : (
                                  <p className="mt-1 text-xs leading-5 text-[#526354]">
                                    {line.options}
                                  </p>
                                )}
                                {line.price > 0 ? (
                                  <p className="mt-1 text-xs font-semibold text-[#4b164c]">
                                    Extras: {formatCurrency(line.price)}
                                  </p>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 pt-5 text-sm sm:ml-auto sm:max-w-sm">
                  <div className="flex items-center justify-between text-[#526354]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#526354]">
                    <span>Taxa de entrega</span>
                    <span>
                      {order.delivery_fee && order.delivery_fee > 0
                        ? formatCurrency(order.delivery_fee)
                        : "A combinar"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[#526354]">
                    <label htmlFor={`delivery-fee-${order.id}`}>Editar taxa de entrega</label>
                    <input
                      id={`delivery-fee-${order.id}`}
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={
                        order.delivery_fee !== null
                          ? (order.delivery_fee / 100).toFixed(2)
                          : ""
                      }
                      onBlur={(e) => {
                        if (!e.target.value.trim()) {
                          return;
                        }

                        const parsedValue = Number(e.target.value.replace(",", "."));

                        if (!Number.isFinite(parsedValue)) {
                          return;
                        }

                        const newFee = Math.round(parsedValue * 100);
                        if (newFee !== order.delivery_fee) {
                          onUpdateDeliveryFee(order.id, newFee);
                        }
                      }}
                      className="min-h-11 w-28 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-base text-[#103d2c] outline-none transition focus:border-[#103d2c] sm:w-24 sm:text-sm"
                    />
                  </div>
                  <div className="flex items-center justify-between border-t border-[#103d2c]/15 pt-2">
                    <span className="font-semibold text-[#103d2c]">Total</span>
                    <span className="text-lg font-semibold text-[#4b164c]">
                      {formatCurrency(order.total)}
                    </span>
                  </div>
                </div>
              </article>
            ))
          : null}
      </div>
    </PanelShell>
  );
}

function OrderInfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
        {label}
      </p>
      <p className="mt-1 text-base leading-7 text-[#526354] lg:text-sm lg:leading-6">
        {value}
      </p>
    </div>
  );
}

function OrderAction({ label, onClick, primary = false, danger = false }: { label: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`min-h-12 rounded-xl px-4 text-sm font-bold transition active:scale-[.98] ${primary ? "bg-[#103d2c] text-white hover:bg-[#18573f]" : danger ? "border border-[#c93636]/30 bg-[#fff0f0] text-[#b42323]" : "bg-[#edf3ef] text-[#103d2c]"}`}>
      {label}
    </button>
  );
}

function PanelShell({
  title,
  action,
  children,
}: {
  title: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-[#d7a948]/35 bg-white">
      <div className="flex flex-col gap-3 border-b border-[#d7a948]/25 p-4 md:flex-row md:items-center md:justify-between">
        <h2 className="text-2xl font-semibold text-[#103d2c]">{title}</h2>
        <div className="w-full md:w-auto">{action}</div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ProductsPanel({
  categories,
  product,
  products,
  selectedProductId,
  onAdd,
  onDelete,
  onSelect,
  onUpdate,
}: {
  categories: Category[];
  product?: Product;
  products: Product[];
  selectedProductId: string;
  onAdd: () => void;
  onDelete: (productId: string) => void;
  onSelect: (productId: string) => void;
  onUpdate: (productId: string, patch: Partial<Product>) => void;
}) {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const visibleProducts = products.filter((item) =>
    item.name.toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")) &&
    (categoryFilter === "all" || item.categoryId === categoryFilter),
  );

  return (
    <PanelShell
      title="Produtos"
      action={
        <button
          type="button"
          onClick={onAdd}
          className="min-h-10 border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:bg-[#d7a948] hover:text-[#103d2c]"
        >
          + Produto
        </button>
      }
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]">
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-[#4b164c]">Pesquisar produto<input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite o nome" className="min-h-12 rounded-xl border border-[#103d2c]/15 bg-white px-4 text-base font-normal normal-case text-[#103d2c] outline-none focus:border-[#d7a948]" /></label>
        <label className="grid gap-1 text-xs font-bold uppercase tracking-wider text-[#4b164c]">Categoria<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="min-h-12 rounded-xl border border-[#103d2c]/15 bg-white px-4 text-base font-normal normal-case text-[#103d2c]"><option value="all">Todas</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      </div>
      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
          {visibleProducts.map((item) => (
            <article key={item.id} className={`rounded-2xl border p-3 transition ${selectedProductId === item.id ? "border-[#d7a948] bg-[#fffaf0]" : "border-[#103d2c]/10 bg-white"}`}>
              <button type="button" onClick={() => onSelect(item.id)} className="flex w-full items-center gap-3 text-left">
                <div className="size-14 shrink-0 rounded-xl bg-[#edf3ef] bg-cover bg-center" style={{ backgroundImage: `url(${item.image})`, backgroundPosition: item.imagePosition }} />
                <div className="min-w-0"><p className="truncate font-bold text-[#103d2c]">{item.name}</p><p className="mt-1 text-xs text-[#68756c]">{categories.find((category) => category.id === item.categoryId)?.name}</p></div>
              </button>
              <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <label className="flex min-h-11 items-center rounded-xl border border-[#103d2c]/10 bg-white px-3 text-sm font-bold text-[#4b164c]">R$ <input aria-label={`Preço de ${item.name}`} defaultValue={centsToInput(item.price)} onBlur={(event) => onUpdate(item.id, { price: inputToCents(event.target.value) })} className="min-w-0 flex-1 bg-transparent pl-1 outline-none" /></label>
                <button type="button" onClick={() => onUpdate(item.id, { active: item.active === false })} className={`min-h-11 rounded-xl px-3 text-xs font-bold ${item.active === false ? "bg-[#fff0f0] text-[#b42323]" : "bg-[#eaf8ef] text-[#14743f]"}`}>{item.active === false ? "Inativo" : "Ativo"}</button>
              </div>
            </article>
          ))}
          {visibleProducts.length === 0 ? <EmptyState label="Nenhum produto encontrado." /> : null}
        </div>

        {product ? (
          <div className="grid gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Nome"
                value={product.name}
                onChange={(value) => onUpdate(product.id, { name: value })}
              />
              <SelectField
                label="Categoria"
                value={product.categoryId}
                onChange={(value) => onUpdate(product.id, { categoryId: value })}
                options={categories.map((category) => ({
                  value: category.id,
                  label: category.name,
                }))}
              />
              <MoneyField
                label="Preço"
                value={product.price}
                onChange={(value) => onUpdate(product.id, { price: value })}
              />
              <MoneyField
                label="Preço original"
                value={product.originalPrice ?? 0}
                onChange={(value) =>
                  onUpdate(product.id, {
                    originalPrice: value > 0 ? value : undefined,
                  })
                }
              />
              <TextField
                label="Selo"
                value={product.tag ?? ""}
                onChange={(value) =>
                  onUpdate(product.id, { tag: value || undefined })
                }
              />
              <TextField
                label="Porção"
                value={product.serves ?? ""}
                onChange={(value) =>
                  onUpdate(product.id, { serves: value || undefined })
                }
              />
              <TextField
                label="Tempo de preparo"
                value={product.preparationTime ?? ""}
                onChange={(value) =>
                  onUpdate(product.id, { preparationTime: value || undefined })
                }
              />
              <TextField
                label="Posição da imagem"
                value={product.imagePosition}
                onChange={(value) =>
                  onUpdate(product.id, { imagePosition: value })
                }
              />
            </div>

            <TextAreaField
              label="Descrição"
              value={product.description}
              onChange={(value) => onUpdate(product.id, { description: value })}
            />

            <TextField
              label="Caminho da imagem"
              value={product.image}
              onChange={(value) => onUpdate(product.id, { image: value })}
            />

            <label className="flex min-h-12 items-center gap-3 border border-[#d7a948]/35 bg-[#fffaf0] px-3">
              <input
                type="checkbox"
                checked={Boolean(product.customizable)}
                onChange={(event) =>
                  onUpdate(product.id, { customizable: event.target.checked })
                }
                className="size-4 accent-[#103d2c]"
              />
              <span className="text-sm font-semibold text-[#103d2c]">
                Permitir personalização por complementos
              </span>
            </label>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onDelete(product.id)}
                className="min-h-10 border border-[#8a1f2d] px-4 text-sm font-semibold text-[#8a1f2d] transition hover:bg-[#8a1f2d] hover:text-white"
              >
                Excluir produto
              </button>
            </div>
          </div>
        ) : (
          <EmptyState label="Nenhum produto cadastrado." />
        )}
      </div>
    </PanelShell>
  );
}

function ImagesPanel({
  products,
  onUpdate,
}: {
  products: Product[];
  onUpdate: (productId: string, patch: Partial<Product>) => void;
}) {
  return (
    <PanelShell title="Imagens" action={<span className="text-sm text-[#526354]" />}>
      <div className="grid gap-4">
        {products.map((product) => (
          <article
            key={product.id}
            className="grid gap-4 rounded-[8px] border border-[#d7a948]/30 p-4 lg:grid-cols-[160px_1fr]"
          >
            <div
              className="min-h-36 rounded-[8px] bg-[#f3ead2] bg-contain bg-center bg-no-repeat"
              style={{
                backgroundImage: product.image ? `url(${product.image})` : undefined,
                backgroundPosition: product.imagePosition,
              }}
            />
            <div className="grid gap-3">
              <div>
                <p className="text-base font-semibold text-[#103d2c]">{product.name}</p>
                <p className="text-sm text-[#526354]">{product.id}</p>
              </div>
              <TextField
                label="Caminho da imagem"
                value={product.image}
                onChange={(value) => onUpdate(product.id, { image: value })}
              />
              <TextField
                label="Posição"
                value={product.imagePosition}
                onChange={(value) =>
                  onUpdate(product.id, { imagePosition: value })
                }
              />
            </div>
          </article>
        ))}
      </div>
    </PanelShell>
  );
}

function CategoriesPanel({
  category,
  categories,
  products,
  selectedCategoryId,
  onAdd,
  onDelete,
  onSelect,
  onUpdate,
}: {
  category?: Category;
  categories: Category[];
  products: Product[];
  selectedCategoryId: string;
  onAdd: () => void;
  onDelete: (categoryId: string) => void;
  onSelect: (categoryId: string) => void;
  onUpdate: (categoryId: string, patch: Partial<Category>) => void;
}) {
  return (
    <PanelShell
      title="Categorias"
      action={
        <button
          type="button"
          onClick={onAdd}
          className="min-h-10 border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:bg-[#d7a948] hover:text-[#103d2c]"
        >
          + Categoria
        </button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <EntityList
          items={categories.map((item) => ({
            id: item.id,
            label: item.name,
            detail: `${products.filter((product) => product.categoryId === item.id).length} produtos`,
          }))}
          selectedId={selectedCategoryId}
          onSelect={onSelect}
        />

        {category ? (
          <div className="grid gap-4">
            <TextField
              label="Nome"
              value={category.name}
              onChange={(value) => onUpdate(category.id, { name: value })}
            />
            <TextAreaField
              label="Descrição"
              value={category.description}
              onChange={(value) => onUpdate(category.id, { description: value })}
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onDelete(category.id)}
                className="min-h-10 border border-[#8a1f2d] px-4 text-sm font-semibold text-[#8a1f2d] transition hover:bg-[#8a1f2d] hover:text-white"
              >
                Excluir categoria
              </button>
            </div>
          </div>
        ) : (
          <EmptyState label="Nenhuma categoria cadastrada." />
        )}
      </div>
    </PanelShell>
  );
}

function ComplementsPanel({
  group,
  groups,
  selectedGroupId,
  onAddGroup,
  onAddOption,
  onDeleteGroup,
  onDeleteOption,
  onSelectGroup,
  onUpdateGroup,
  onUpdateOption,
}: {
  group?: ComplementGroup;
  groups: ComplementGroup[];
  selectedGroupId: string;
  onAddGroup: () => void;
  onAddOption: (groupId: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onDeleteOption: (groupId: string, optionId: string) => void;
  onSelectGroup: (groupId: string) => void;
  onUpdateGroup: (groupId: string, patch: Partial<ComplementGroup>) => void;
  onUpdateOption: (
    groupId: string,
    optionId: string,
    patch: Partial<ComplementOption>,
  ) => void;
}) {
  return (
    <PanelShell
      title="Complementos"
      action={
        <button
          type="button"
          onClick={onAddGroup}
          className="min-h-10 border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:bg-[#d7a948] hover:text-[#103d2c]"
        >
          + Grupo
        </button>
      }
    >
      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <EntityList
          items={groups.map((item) => ({
            id: item.id,
            label: item.title,
            detail: `${item.options.length} opções`,
          }))}
          selectedId={selectedGroupId}
          onSelect={onSelectGroup}
        />

        {group ? (
          <div className="grid gap-5">
            <div className="grid gap-4 md:grid-cols-2">
              <TextField
                label="Título"
                value={group.title}
                onChange={(value) => onUpdateGroup(group.id, { title: value })}
              />
              <SelectField
                label="Tipo"
                value={group.type}
                onChange={(value) =>
                  onUpdateGroup(group.id, {
                    type: value as ComplementGroup["type"],
                  })
                }
                options={[
                  { value: "single", label: "Escolha única" },
                  { value: "multiple", label: "Múltipla escolha" },
                ]}
              />
              <NumberField
                label="Mínimo"
                value={group.minSelections ?? 0}
                onChange={(value) =>
                  onUpdateGroup(group.id, {
                    minSelections: value > 0 ? value : undefined,
                  })
                }
              />
              <NumberField
                label="Máximo"
                value={group.maxSelections ?? 0}
                onChange={(value) =>
                  onUpdateGroup(group.id, {
                    maxSelections: value > 0 ? value : undefined,
                  })
                }
              />
            </div>

            <TextAreaField
              label="Descrição"
              value={group.description}
              onChange={(value) => onUpdateGroup(group.id, { description: value })}
            />

            <label className="flex min-h-12 items-center gap-3 border border-[#d7a948]/35 bg-[#fffaf0] px-3">
              <input
                type="checkbox"
                checked={group.required}
                onChange={(event) =>
                  onUpdateGroup(group.id, { required: event.target.checked })
                }
                className="size-4 accent-[#103d2c]"
              />
              <span className="text-sm font-semibold text-[#103d2c]">
                Grupo obrigatório
              </span>
            </label>

            <div className="rounded-[8px] border border-[#d7a948]/30">
              <div className="flex items-center justify-between border-b border-[#d7a948]/25 p-3">
                <h3 className="text-lg font-semibold text-[#103d2c]">Opções</h3>
                <button
                  type="button"
                  onClick={() => onAddOption(group.id)}
                  className="min-h-9 border border-[#103d2c] px-3 text-sm font-semibold text-[#103d2c] transition hover:bg-[#103d2c] hover:text-white"
                >
                  + Opção
                </button>
              </div>

              <div className="grid gap-3 p-3">
                {group.options.length === 0 ? (
                  <EmptyState label="Nenhuma opção cadastrada." />
                ) : (
                  group.options.map((option) => (
                    <div
                      key={option.id}
                      className="grid gap-3 rounded-[8px] border border-[#d7a948]/25 p-3 md:grid-cols-[1fr_1fr_130px_auto]"
                    >
                      <TextField
                        label="Nome"
                        value={option.name}
                        onChange={(value) =>
                          onUpdateOption(group.id, option.id, { name: value })
                        }
                      />
                      <TextField
                        label="Descrição"
                        value={option.description ?? ""}
                        onChange={(value) =>
                          onUpdateOption(group.id, option.id, {
                            description: value || undefined,
                          })
                        }
                      />
                      <MoneyField
                        label="Preço"
                        value={option.price}
                        onChange={(value) =>
                          onUpdateOption(group.id, option.id, { price: value })
                        }
                      />
                      <button
                        type="button"
                        onClick={() => onDeleteOption(group.id, option.id)}
                        className="min-h-10 self-end border border-[#8a1f2d] px-3 text-sm font-semibold text-[#8a1f2d] transition hover:bg-[#8a1f2d] hover:text-white"
                      >
                        Excluir
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onDeleteGroup(group.id)}
                className="min-h-10 border border-[#8a1f2d] px-4 text-sm font-semibold text-[#8a1f2d] transition hover:bg-[#8a1f2d] hover:text-white"
              >
                Excluir grupo
              </button>
            </div>
          </div>
        ) : (
          <EmptyState label="Nenhum grupo cadastrado." />
        )}
      </div>
    </PanelShell>
  );
}

function EntityList({
  items,
  selectedId,
  onSelect,
}: {
  items: { id: string; label: string; detail: string }[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="max-h-[680px] overflow-y-auto rounded-[8px] border border-[#d7a948]/30 p-2">
      {items.length === 0 ? (
        <EmptyState label="Nenhum registro." />
      ) : (
        <div className="grid gap-2">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelect(item.id)}
              className={`min-h-16 rounded-[8px] border px-3 text-left transition ${
                selectedId === item.id
                  ? "border-[#103d2c] bg-[#103d2c] text-white"
                  : "border-[#d7a948]/20 bg-[#fffaf0] text-[#103d2c] hover:border-[#d7a948]"
              }`}
            >
              <span className="block text-sm font-semibold">{item.label}</span>
              <span
                className={`mt-1 block text-xs ${
                  selectedId === item.id ? "text-white/70" : "text-[#526354]"
                }`}
              >
                {item.detail}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
      />
    </label>
  );
}

function TextAreaField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 resize-none border border-[#d7a948]/45 bg-[#fffaf0] px-3 py-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
      />
    </label>
  );
}

function MoneyField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
        {label}
      </span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={centsToInput(value)}
        onChange={(event) => onChange(inputToCents(event.target.value))}
        className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
        {label}
      </span>
      <input
        type="number"
        min="0"
        step="1"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
      />
    </label>
  );
}

function SelectField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-[8px] border border-dashed border-[#d7a948]/45 bg-[#fffaf0] p-4 text-sm text-[#526354]">
      {label}
    </div>
  );
}
