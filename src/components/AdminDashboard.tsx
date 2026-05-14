"use client";

import Link from "next/link";
import {
  useCallback,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import {
  CATALOG_STORAGE_KEY,
  heroImage,
  initialCatalog,
  type CatalogData,
  type Category,
  type ComplementGroup,
  type ComplementOption,
  type Product,
} from "@/data/menu";
import {
  ORDER_STATUSES,
  WHATSAPP_BUSINESS_PHONE_NUMBER,
  type OrderRecord,
  type OrderStatus,
} from "@/data/orders";

type AdminTab = "orders" | "products" | "images" | "categories" | "complements";

const tabs: { id: AdminTab; label: string }[] = [
  { id: "orders", label: "Pedidos" },
  { id: "products", label: "Produtos" },
  { id: "images", label: "Imagens" },
  { id: "categories", label: "Categorias" },
  { id: "complements", label: "Complementos" },
];

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
    return JSON.parse(snapshot) as CatalogData;
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

  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError("");

    try {
      const response = await fetch("/api/orders", { cache: "no-store" });
      const body = (await response.json()) as {
        orders?: OrderRecord[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Não foi possível carregar os pedidos.");
      }

      setOrders(body.orders ?? []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível carregar os pedidos.";

      setOrdersError(message);
      setStatus(message);
    } finally {
      setOrdersLoading(false);
    }
  }, []);

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
      image: heroImage,
      imagePosition: "50% 50%",
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
    <main className="min-h-screen bg-[#f6f1e5] text-[#16221a]">
      <header className="border-b border-[#d7a948]/35 bg-[#103d2c] px-5 py-5 text-white md:px-8">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d7a948]">
              DNA do Açaí
            </p>
            <h1 className="mt-2 text-3xl font-semibold">Painel administrativo</h1>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href="/"
              className="inline-flex min-h-11 items-center border border-white/30 px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:text-[#f8e8b5]"
            >
              Ver loja
            </Link>
            <button
              type="button"
              onClick={exportCatalog}
              className="min-h-11 border border-[#d7a948] px-4 text-sm font-semibold text-[#f8e8b5] transition hover:bg-[#d7a948] hover:text-[#103d2c]"
            >
              Exportar JSON
            </button>
            <button
              type="button"
              onClick={resetCatalog}
              className="min-h-11 border border-white/30 px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:text-[#f8e8b5]"
            >
              Restaurar
            </button>
            <button
              type="button"
              onClick={publishCatalog}
              className="min-h-11 border border-[#d7a948] bg-[#d7a948] px-5 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f1cf77]"
            >
              Publicar catálogo
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-6 md:px-8 lg:grid-cols-[260px_1fr]">
        <aside className="space-y-4">
          <div className="rounded-[8px] border border-[#d7a948]/35 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b164c]">
              Status
            </p>
            <p className="mt-2 text-sm leading-6 text-[#526354]">{status}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
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

          <nav className="grid gap-2 rounded-[8px] border border-[#d7a948]/35 bg-white p-2">
            {tabs.map((tab) => (
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
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="min-w-0">
          {activeTab === "orders" ? (
            <OrdersPanel
              error={ordersError}
              loading={ordersLoading}
              orders={orders}
              onRefresh={loadOrders}
              onUpdateStatus={updateOrderStatus}
              onUpdateDeliveryFee={updateOrderDeliveryFee}
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
      </div>
    </main>
  );
}

function OrdersPanel({
  error,
  loading,
  orders,
  onRefresh,
  onUpdateStatus,
  onUpdateDeliveryFee,
}: {
  error: string;
  loading: boolean;
  orders: OrderRecord[];
  onRefresh: () => void | Promise<void>;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void | Promise<void>;
  onUpdateDeliveryFee: (orderId: string, deliveryFee: number) => void | Promise<void>;
}) {
  return (
    <PanelShell
      title="Pedidos"
      action={
        <button
          type="button"
          onClick={() => void onRefresh()}
          className="min-h-10 border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition hover:border-[#d7a948] hover:bg-[#d7a948] hover:text-[#103d2c]"
        >
          Atualizar
        </button>
      }
    >
      <div className="grid gap-4">
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
                key={order.id}
                className="rounded-[8px] border border-[#d7a948]/30 bg-white p-4"
              >
                <div className="flex flex-col gap-3 border-b border-[#d7a948]/25 pb-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4b164c]">
                      Pedido {formatOrderNumber(order.order_number)}
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-[#103d2c]">
                      {order.customer_name}
                    </h3>
                    <p className="mt-1 text-sm text-[#526354]">
                      {formatDateTime(order.created_at)} / {order.customer_phone}
                    </p>
                  </div>

                  <label className="grid gap-1">
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
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
                      className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm font-semibold text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                    >
                      {ORDER_STATUSES.map((statusOption) => (
                        <option key={statusOption} value={statusOption}>
                          {statusOption}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 py-4 lg:grid-cols-3">
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

                <div className="border-y border-[#d7a948]/25 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4b164c]">
                    Itens e complementos
                  </p>
                  <div className="mt-3 grid gap-3">
                    {order.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[8px] border border-[#d7a948]/25 bg-[#fffaf0] p-3"
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
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid gap-2 pt-4 text-sm sm:ml-auto sm:max-w-sm">
                  <div className="flex items-center justify-between text-[#526354]">
                    <span>Subtotal</span>
                    <span>{formatCurrency(order.subtotal)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[#526354]">
                    <span>Taxa de entrega</span>
                    <span>
                      {order.delivery_fee > 0
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
                      defaultValue={(order.delivery_fee / 100).toFixed(2)}
                      onBlur={(e) => {
                        const newFee = Math.round(parseFloat(e.target.value) * 100);
                        if (newFee !== order.delivery_fee) {
                          onUpdateDeliveryFee(order.id, newFee);
                        }
                      }}
                      className="w-20 border border-[#d7a948]/45 bg-[#fffaf0] px-2 py-1 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
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
      <p className="mt-1 text-sm leading-6 text-[#526354]">{value}</p>
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
        {action}
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
              label="URL da imagem"
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
              className="min-h-36 rounded-[8px] bg-[#103d2c] bg-cover bg-center"
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
                label="URL da imagem"
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
