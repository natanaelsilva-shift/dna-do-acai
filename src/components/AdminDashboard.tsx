"use client";

import Image from "next/image";
import Link from "next/link";
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
  initialCatalog,
  type CatalogData,
  type Category,
  type ComplementGroup,
  type ComplementOption,
  type Product,
  withCatalogProductImages,
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

type AdminTab = "orders" | "products" | "images" | "categories" | "complements";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

const tabs: { id: AdminTab; label: string; shortLabel: string }[] = [
  { id: "orders", label: "Pedidos", shortLabel: "Pedidos" },
  { id: "products", label: "Produtos", shortLabel: "Produtos" },
  { id: "images", label: "Imagens", shortLabel: "Imagens" },
  { id: "categories", label: "Categorias", shortLabel: "Categ." },
  { id: "complements", label: "Complementos", shortLabel: "Compl." },
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
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("dna-catalog-updated", onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("dna-catalog-updated", onStoreChange);
  };
}

function getCatalogSnapshot() {
  return window.localStorage.getItem(CATALOG_STORAGE_KEY) ?? "";
}

function getCatalogServerSnapshot() {
  return "";
}

function parseCatalogSnapshot(snapshot: string) {
  if (!snapshot) {
    return initialCatalog;
  }

  try {
    return withCatalogProductImages(JSON.parse(snapshot) as CatalogData);
  } catch {
    return initialCatalog;
  }
}

export function AdminDashboard({
  initialOrders = [],
}: {
  initialOrders?: OrderRecord[];
}) {
  const catalogSnapshot = useSyncExternalStore(
    subscribeCatalogStore,
    getCatalogSnapshot,
    getCatalogServerSnapshot,
  );
  const catalog = useMemo(
    () => parseCatalogSnapshot(catalogSnapshot),
    [catalogSnapshot],
  );
  const [activeTab, setActiveTab] = useState<AdminTab>("orders");
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const latestOrdersRef = useRef<OrderRecord[]>(initialOrders);
  const knownOrderIds = useRef<Set<string>>(
    new Set(initialOrders.map((order) => order.id)),
  );
  const notifiedOrderIds = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(false);
  const isFetchingOrdersRef = useRef(false);

  const selectedProduct =
    catalog.products.find((product) => product.id === selectedProductId) ??
    catalog.products[0];
  const selectedCategory =
    catalog.categories.find((category) => category.id === selectedCategoryId) ??
    catalog.categories[0];
  const selectedGroup =
    catalog.complementGroups.find((group) => group.id === selectedGroupId) ??
    catalog.complementGroups[0];

  const stats = useMemo(
    () => [
      { label: "Pedidos", value: orders.length },
      { label: "Categorias", value: catalog.categories.length },
      { label: "Produtos", value: catalog.products.length },
      { label: "Complementos", value: catalog.complementGroups.length },
      {
        label: "Itens editáveis",
        value:
          catalog.products.length +
          catalog.categories.length +
          catalog.complementGroups.reduce(
            (total, group) => total + group.options.length,
            0,
          ),
      },
    ],
    [catalog, orders.length],
  );

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
    },
    [playNewOrderSound],
  );

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

      const newOrderToNotify = newOrders.find(
        (order) =>
          order.status === "Novo" && !notifiedOrderIds.current.has(order.id),
      );

      newOrders.forEach((order) => {
        if (order.status === "Novo") {
          notifiedOrderIds.current.add(order.id);
        }
      });

      if (newOrderToNotify) {
        notifyNewOrder(newOrderToNotify);
        return true;
      }

      return false;
    },
    [notifyNewOrder],
  );

  const loadOrders = useCallback(
    async ({ silent = false } = {}) => {
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
        const hasNewOrder = checkForNewOrders(nextOrders);

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
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível atualizar o pedido.";

        setOrdersError(message);
        setStatus(message);
      }
    },
    [],
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

  return (
    <main className="min-h-screen bg-[#f6f1e5] pb-32 text-[#16221a] lg:pb-0">
      <header className="sticky top-0 z-40 border-b border-[#d7a948]/35 bg-[#103d2c] px-4 py-3 text-white shadow-[0_12px_30px_rgba(7,27,18,0.18)] md:px-8 md:py-5">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <Image
              src={BRAND_LOGO_SRC}
              alt="Logo da DNA do Açaí"
              width={72}
              height={72}
              priority
              className="size-14 shrink-0 object-contain drop-shadow-[0_10px_22px_rgba(0,0,0,0.3)] md:size-16"
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a948]">
                DNA do Açaí
              </p>
              <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
                Painel administrativo
              </h1>
            </div>
          </div>

          <div className="-mx-1 flex flex-nowrap gap-2 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
            <Link
              href="/"
              className="inline-flex min-h-11 shrink-0 items-center border border-white/30 px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:text-[#f8e8b5]"
            >
              Ver loja
            </Link>
            <button
              type="button"
              onClick={exportCatalog}
              className="min-h-11 shrink-0 border border-[#d7a948] px-4 text-sm font-semibold text-[#f8e8b5] transition hover:bg-[#d7a948] hover:text-[#103d2c]"
            >
              Exportar JSON
            </button>
            <button
              type="button"
              onClick={resetCatalog}
              className="min-h-11 shrink-0 border border-white/30 px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:text-[#f8e8b5]"
            >
              Restaurar
            </button>
            <button
              type="button"
              onClick={publishCatalog}
              className="min-h-11 shrink-0 border border-[#d7a948] bg-[#d7a948] px-5 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f1cf77]"
            >
              Publicar catálogo
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-4 md:px-8 md:py-6 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
          <div className="hidden rounded-[8px] border border-[#d7a948]/35 bg-[#071b12] p-4 text-center text-white shadow-[0_16px_36px_rgba(7,27,18,0.16)] lg:block">
            <Image
              src={BRAND_LOGO_SRC}
              alt="Logo da DNA do Açaí"
              width={160}
              height={160}
              className="mx-auto size-28 object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.32)]"
            />
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a948]">
              DNA Admin
            </p>
          </div>

          <div className="rounded-[8px] border border-[#d7a948]/35 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b164c]">
              Status
            </p>
            <p className="mt-2 text-sm leading-6 text-[#526354]">{status}</p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-[8px] border border-[#d7a948]/30 bg-white p-4"
              >
                <p className="text-2xl font-semibold text-[#103d2c]">{stat.value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-[#4b164c]">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>

          <nav className="hidden gap-2 rounded-[8px] border border-[#d7a948]/35 bg-white p-2 lg:grid">
            {tabs.map((tab) => {
              const badgeCount = tab.id === "orders" ? newOrdersCount : 0;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-h-11 px-3 text-left text-sm font-semibold transition ${
                    activeTab === tab.id
                      ? "bg-[#103d2c] text-white"
                      : "text-[#103d2c] hover:bg-[#f3ead2]"
                  }`}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span>{tab.label}</span>
                    {badgeCount > 0 ? (
                      <span className="rounded-full bg-[#d7a948] px-2 py-0.5 text-xs font-semibold text-[#103d2c]">
                        {badgeCount}
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </nav>
        </aside>

        <section className="min-w-0">
          {activeTab === "orders" ? (
            <OrdersPanel
              error={ordersError}
              highlightedOrderId={highlightedOrderId}
              installAvailable={Boolean(installPrompt)}
              isAdminAppInstalled={isAdminAppInstalled}
              loading={ordersLoading}
              orders={orders}
              onInstallAdminApp={() => void installAdminPwa()}
              onRefresh={loadOrders}
              onUpdateStatus={updateOrderStatus}
              onUpdateDeliveryFee={updateOrderDeliveryFee}
              onEnableSound={() => void enableOrderSound()}
              onTestSound={() => void testOrderSound()}
              soundError={soundError}
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

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d7a948]/35 bg-white/95 px-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2 shadow-[0_-12px_30px_rgba(7,27,18,0.14)] backdrop-blur lg:hidden">
        <div className="mx-auto mb-2 flex max-w-7xl items-center justify-center gap-2 text-[#103d2c]">
          <Image
            src={BRAND_LOGO_SRC}
            alt="Logo da DNA do Açaí"
            width={36}
            height={36}
            className="size-8 object-contain"
          />
          <span className="text-xs font-semibold uppercase tracking-[0.16em]">
            DNA Admin
          </span>
        </div>
        <div className="mx-auto grid max-w-7xl grid-cols-5 gap-1">
          {tabs.map((tab) => {
            const badgeCount = tab.id === "orders" ? newOrdersCount : 0;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex min-h-14 flex-col items-center justify-center rounded-[8px] px-1 text-center text-[11px] font-semibold transition ${
                  activeTab === tab.id
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

function OrdersPanel({
  error,
  highlightedOrderId,
  installAvailable,
  isAdminAppInstalled,
  loading,
  orders,
  onInstallAdminApp,
  onRefresh,
  onUpdateStatus,
  onUpdateDeliveryFee,
  onEnableSound,
  onTestSound,
  soundError,
}: {
  error: string;
  highlightedOrderId: string | null;
  installAvailable: boolean;
  isAdminAppInstalled: boolean;
  loading: boolean;
  orders: OrderRecord[];
  onInstallAdminApp: () => void;
  onRefresh: () => void | Promise<void>;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void | Promise<void>;
  onUpdateDeliveryFee: (orderId: string, deliveryFee: number) => void | Promise<void>;
  onEnableSound: () => void;
  onTestSound: () => void;
  soundError: string;
}) {
  return (
    <PanelShell
      title="Pedidos"
      action={
        <div className="grid w-full gap-2 sm:w-auto sm:grid-cols-2 lg:flex lg:items-center">
          <button
            type="button"
            onClick={() => void onRefresh()}
            className="min-h-12 border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:bg-[#d7a948] hover:text-[#103d2c] lg:min-h-10"
          >
            Atualizar
          </button>
          <button
            type="button"
            onClick={onInstallAdminApp}
            disabled={isAdminAppInstalled}
            title={
              installAvailable
                ? "Instalar painel no celular"
                : "O navegador libera a instalacao quando o PWA esta elegivel"
            }
            className="min-h-12 border border-[#4b164c] bg-[#4b164c] px-4 text-sm font-semibold text-white transition hover:bg-[#3b0a45] disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-10"
          >
            {isAdminAppInstalled
              ? "Painel instalado"
              : "Instalar painel no celular"}
          </button>
          <button
            type="button"
            onClick={onEnableSound}
            className="min-h-12 border border-[#d7a948] bg-[#d7a948] px-4 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f1cf77] lg:min-h-10"
          >
            Ativar som
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
        {soundError ? (
          <div className="rounded-[8px] border border-[#f8b4b4] bg-[#fff1f2] p-4 text-sm text-[#9f1239]">
            {soundError}
          </div>
        ) : null}
        <div className="rounded-[8px] border border-[#d7a948]/30 bg-[#fffaf0] p-4">
          <p className="text-sm font-semibold text-[#103d2c]">
            WhatsApp Business Cloud API
          </p>
          <p className="mt-1 text-sm leading-6 text-[#526354]">
            Estrutura preparada para envio futuro pelo número{" "}
            <span className="font-semibold text-[#4b164c]">
              {WHATSAPP_BUSINESS_PHONE_NUMBER}
            </span>
            .
          </p>
        </div>

        {error ? (
          <div className="rounded-[8px] border border-[#8a1f2d]/30 bg-[#fff0f2] p-4 text-sm text-[#8a1f2d]">
            {error}
          </div>
        ) : null}

        {loading ? <EmptyState label="Carregando pedidos..." /> : null}

        {!loading && orders.length === 0 ? (
          <EmptyState label="Nenhum pedido recebido ainda." />
        ) : null}

        {!loading
          ? orders.map((order) => (
              <article
                id={`order-${order.id}`}
                key={order.id}
                className={`scroll-mt-32 rounded-[8px] border bg-white p-5 shadow-sm transition md:p-6 ${
                  highlightedOrderId === order.id
                    ? "border-[#d7a948] shadow-[0_0_0_3px_rgba(215,169,72,0.24),0_18px_50px_rgba(16,61,44,0.12)]"
                    : "border-[#d7a948]/30"
                }`}
              >
                <div className="flex flex-col gap-4 border-b border-[#d7a948]/25 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4b164c]">
                      Pedido {formatOrderNumber(order.order_number)}
                    </p>
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
      <div className="grid gap-5 xl:grid-cols-[280px_1fr]">
        <EntityList
          items={products.map((item) => ({
            id: item.id,
            label: item.name,
            detail: formatCurrency(item.price),
          }))}
          selectedId={selectedProductId}
          onSelect={onSelect}
        />

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
