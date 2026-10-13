"use client";

import Image from "next/image";
import type { ComboCup, ComplementGroup, ComplementOption, Product } from "@/data/menu";
import type { DeliveryMethod, OrderCustomizationLine, PaymentMethod } from "@/data/orders";
import { useCustomizer } from "@/components/builder/CustomizerProvider";
import { useCart } from "@/components/cart/CartProvider";
import { useCheckout } from "@/components/checkout/CheckoutProvider";
import { useStore } from "@/components/store/StoreProvider";
import type { CartItem } from "@/lib/cart/types";
import {
  getOptionQuantity,
  isQuantityGroup,
  type SelectionState,
} from "@/lib/catalog/customization";
import { paymentLabels, type CheckoutForm, type SubmitState } from "@/lib/checkout/form";
import { formatCurrency, formatOptionPrice } from "@/lib/format/currency";

export function MenuCatalog() {
  const { isStoreOpen } = useStore();
  const {
    cartItems,
    totalItems,
    totalPrice,
    incrementCartItem,
    decrementCartItem,
    isCartDrawerOpen,
    openCartDrawer,
    closeCartDrawer,
  } = useCart();
  const {
    customizingProduct,
    isCombo,
    selections,
    comboStepIndex,
    customizableComboCups,
    activeComboCup,
    activeComplementGroups,
    pureComboCups,
    customizedPrice,
    isCustomizationValid,
    customizationError,
    confirmCustomization,
    goToPreviousComboCup,
    resetCurrentCustomization,
    closeCustomizer,
    toggleOption,
    incrementOptionQuantity,
    decrementOptionQuantity,
  } = useCustomizer();
  const {
    checkout,
    canCheckout,
    orderTotal,
    submitState,
    submitMessage,
    updateCheckoutField,
    submitOrder,
  } = useCheckout();
  // Provisório (até o redesign do carrinho): só sacola, dock e personalizador.
  return (
    <section id="sacola" className="scroll-mt-24 bg-dna-night pb-28 pt-16 text-[#16221a] lg:pb-24">
      <div className="mx-auto max-w-xl px-4">
          <OrderSummary
            cartItems={cartItems}
            checkout={checkout}
            canCheckout={canCheckout}
            isStoreOpen={isStoreOpen}
            subtotal={totalPrice}
            submitMessage={submitMessage}
            submitState={submitState}
            totalItems={totalItems}
            onIncrement={incrementCartItem}
            onDecrement={decrementCartItem}
            onCheckoutChange={updateCheckoutField}
            onSubmit={submitOrder}
          />
      </div>

      <MobileCartDock
        totalItems={totalItems}
        totalPrice={orderTotal}
        onOpen={openCartDrawer}
      />

      {isCartDrawerOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-end bg-[#16221a]/60 pt-8 backdrop-blur-sm lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Carrinho"
          onClick={() => closeCartDrawer()}
        >
          <div className="w-full" onClick={(event) => event.stopPropagation()}>
            <OrderSummary
              variant="drawer"
              cartItems={cartItems}
              checkout={checkout}
              canCheckout={canCheckout}
              isStoreOpen={isStoreOpen}
              subtotal={totalPrice}
              submitMessage={submitMessage}
              submitState={submitState}
              totalItems={totalItems}
              onClose={() => closeCartDrawer()}
              onIncrement={incrementCartItem}
              onDecrement={decrementCartItem}
              onCheckoutChange={updateCheckoutField}
              onSubmit={submitOrder}
            />
          </div>
        </div>
      ) : null}

      {customizingProduct ? (
        <CupCustomizer
          product={customizingProduct}
          activeComboCup={activeComboCup}
          currentStep={comboStepIndex}
          errorMessage={customizationError}
          isCombo={isCombo}
          selections={selections}
          complementGroups={activeComplementGroups}
          pureComboCups={pureComboCups}
          totalSteps={customizableComboCups.length}
          totalPrice={customizedPrice}
          isValid={isCustomizationValid}
          onBack={comboStepIndex > 0 ? goToPreviousComboCup : undefined}
          onClose={closeCustomizer}
          onConfirm={confirmCustomization}
          onDecrementOption={decrementOptionQuantity}
          onIncrementOption={incrementOptionQuantity}
          onReset={resetCurrentCustomization}
          onToggleOption={toggleOption}
        />
      ) : null}
    </section>
  );
}

function MobileCartDock({
  onOpen,
  totalItems,
  totalPrice,
}: {
  onOpen: () => void;
  totalItems: number;
  totalPrice: number;
}) {
  if (totalItems === 0) {
    return null;
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d7a948]/35 bg-[#fffaf0]/96 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 shadow-[0_-14px_34px_rgba(16,61,44,0.14)] backdrop-blur lg:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-14 w-full items-center justify-between gap-4 bg-[#103d2c] px-4 text-left text-white shadow-[0_12px_28px_rgba(16,61,44,0.22)] transition active:translate-y-px"
      >
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-[#d7a948]">
            Sacola
          </span>
          <span className="block text-sm font-semibold">
            {totalItems} {totalItems === 1 ? "item" : "itens"}
          </span>
        </span>
        <span className="text-base font-semibold">
          {formatCurrency(totalPrice)}
        </span>
      </button>
    </div>
  );
}

function CustomizationSummary({
  customization,
}: {
  customization: OrderCustomizationLine[];
}) {
  return (
    <div className="mt-3 space-y-3">
      {customization.map((line) => (
        <div key={`${line.groupTitle}-${line.options}`}>
          <p className="text-xs font-semibold leading-5 text-[#103d2c]">
            {line.groupTitle}:
          </p>
          {line.optionsList && line.optionsList.length > 0 ? (
            <ul className="mt-1 list-disc space-y-1 pl-4 text-xs leading-5 text-[#526354]">
              {line.optionsList.map((option) => (
                <li key={`${line.groupTitle}-${option}`}>{option}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-xs leading-5 text-[#526354]">{line.options}</p>
          )}
          {line.price > 0 ? (
            <p className="mt-1 text-xs font-semibold text-[#4b164c]">
              Extras: {formatCurrency(line.price)}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function OrderSummary({
  cartItems,
  checkout,
  canCheckout,
  isStoreOpen,
  onClose,
  subtotal,
  submitMessage,
  submitState,
  totalItems,
  variant = "sidebar",
  onIncrement,
  onDecrement,
  onCheckoutChange,
  onSubmit,
}: {
  cartItems: CartItem[];
  checkout: CheckoutForm;
  canCheckout: boolean;
  isStoreOpen: boolean;
  onClose?: () => void;
  subtotal: number;
  submitMessage: string;
  submitState: SubmitState;
  totalItems: number;
  variant?: "sidebar" | "drawer";
  onIncrement: (itemId: string) => void;
  onDecrement: (itemId: string) => void;
  onCheckoutChange: <Key extends keyof CheckoutForm>(
    field: Key,
    value: CheckoutForm[Key],
  ) => void;
  onSubmit: () => void;
}) {
  const isDrawer = variant === "drawer";

  return (
    <aside className={isDrawer ? "h-full" : "hidden lg:block"}>
      <div
        className={
          isDrawer
            ? "flex max-h-[min(88dvh,760px)] w-full flex-col overflow-hidden rounded-t-[18px] border border-[#d7a948]/40 bg-white shadow-[0_-24px_70px_rgba(0,0,0,0.28)]"
            : "sticky top-24 rounded-[8px] border border-[#d7a948]/40 bg-white p-5 shadow-[0_18px_50px_rgba(16,61,44,0.08)]"
        }
      >
        <div
          className={
            isDrawer
              ? "flex shrink-0 items-start justify-between gap-4 border-b border-[#d7a948]/30 px-4 py-4"
              : ""
          }
        >
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#4b164c]">
              Carrinho
            </p>
            <h3 className="mt-2 text-xl font-semibold text-[#103d2c] sm:text-2xl">
              Finalizar pedido
            </h3>
          </div>

          {isDrawer ? (
            <button
              type="button"
              onClick={onClose}
              className="grid size-11 shrink-0 place-items-center border border-[#103d2c]/25 text-2xl leading-none text-[#103d2c] transition hover:bg-[#f3ead2]"
              aria-label="Fechar carrinho"
            >
              ×
            </button>
          ) : null}
        </div>

        <div
          className={
            isDrawer
              ? "min-h-0 overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-4"
              : ""
          }
        >

        {totalItems === 0 ? (
          <p className="mt-5 text-sm leading-6 text-[#526354]">
            Escolha um produto ou personalize um copo para iniciar a sacola.
          </p>
        ) : (
          <div className="mt-5 space-y-4">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="border-b border-[#d7a948]/20 pb-4 last:border-b-0"
              >
                <div className="flex items-start gap-3">
                  {item.image ? (
                    <div className="relative size-14 shrink-0 overflow-hidden rounded-[8px] bg-[#f3ead2]">
                      <CatalogImage
                        src={item.image}
                        alt={item.name}
                        position={item.imagePosition}
                      />
                    </div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-[#103d2c]">{item.name}</p>
                    <p className="mt-1 text-xs text-[#526354]">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-[#4b164c]">
                    {formatCurrency(item.unitPrice * item.quantity)}
                  </p>
                </div>

                {item.customization ? (
                  <CustomizationSummary customization={item.customization} />
                ) : null}

                <div className="mt-3 flex min-h-11 w-fit items-center border border-[#103d2c]">
                  <button
                    type="button"
                    onClick={() => onDecrement(item.id)}
                    className="grid size-11 place-items-center text-lg font-semibold text-[#103d2c] transition hover:bg-[#f3ead2]"
                    aria-label={`Diminuir ${item.name}`}
                  >
                    -
                  </button>
                  <span className="grid min-w-10 place-items-center text-sm font-semibold text-[#103d2c]">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onIncrement(item.id)}
                    className="grid size-11 place-items-center bg-[#103d2c] text-lg font-semibold text-white transition hover:bg-[#4b164c]"
                    aria-label={`Aumentar ${item.name}`}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 border-t border-[#103d2c]/15 pt-5">
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                Nome
              </span>
              <input
                value={checkout.customerName}
                onChange={(event) =>
                  onCheckoutChange("customerName", event.target.value)
                }
                className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                placeholder="Seu nome"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                Telefone
              </span>
              <input
                value={checkout.customerPhone}
                onChange={(event) =>
                  onCheckoutChange("customerPhone", event.target.value)
                }
                className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                placeholder="(00) 00000-0000"
              />
            </label>
          </div>

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
              Tipo de pedido
            </p>
            <div className="mt-2 grid grid-cols-2 border border-[#d7a948]/45">
              {(["delivery", "pickup"] as DeliveryMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onCheckoutChange("deliveryMethod", method)}
                  className={`min-h-11 px-3 text-sm font-semibold transition ${
                    checkout.deliveryMethod === method
                      ? "bg-[#103d2c] text-white"
                      : "bg-white text-[#103d2c] hover:bg-[#f3ead2]"
                  }`}
                >
                  {method === "delivery" ? "Entrega" : "Retirada"}
                </button>
              ))}
            </div>
          </div>

          {checkout.deliveryMethod === "delivery" ? (
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                  Endereço
                </span>
                <input
                  value={checkout.address}
                  onChange={(event) => onCheckoutChange("address", event.target.value)}
                  className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                  placeholder="Rua, número e complemento"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                  Bairro
                </span>
                <input
                  value={checkout.neighborhood}
                  onChange={(event) =>
                    onCheckoutChange("neighborhood", event.target.value)
                  }
                  className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                  placeholder="Seu bairro"
                />
              </label>
            </div>
          ) : null}

          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
              Pagamento
            </p>
            <div className="mt-2 grid gap-2">
              {(["pix", "card", "cash"] as PaymentMethod[]).map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => onCheckoutChange("paymentMethod", method)}
                  className={`min-h-11 border px-3 text-left text-sm font-semibold transition ${
                    checkout.paymentMethod === method
                      ? "border-[#103d2c] bg-[#103d2c] text-white"
                      : "border-[#d7a948]/45 bg-white text-[#103d2c] hover:bg-[#f3ead2]"
                  }`}
                >
                  {paymentLabels[method]}
                </button>
              ))}
            </div>
          </div>

          {checkout.paymentMethod === "cash" ? (
            <label className="mt-4 grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
                Troco
              </span>
              <input
                value={checkout.changeFor}
                onChange={(event) => onCheckoutChange("changeFor", event.target.value)}
                className="min-h-11 border border-[#d7a948]/45 bg-[#fffaf0] px-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
                placeholder="Troco para quanto?"
              />
            </label>
          ) : null}

          <label className="mt-4 grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
              Observações
            </span>
            <textarea
              value={checkout.notes}
              onChange={(event) => onCheckoutChange("notes", event.target.value)}
              className="min-h-20 resize-none border border-[#d7a948]/45 bg-[#fffaf0] px-3 py-3 text-sm text-[#103d2c] outline-none transition focus:border-[#103d2c]"
              placeholder="Ex.: sem granola, retirar no balcão às 18h"
            />
          </label>
        </div>

        <div className="mt-5 space-y-2 border-t border-[#103d2c]/15 pt-4">
          <div className="flex items-center justify-between text-sm text-[#526354]">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm text-[#526354]">
            <span>Taxa de entrega</span>
            <span>A combinar</span>
          </div>
          <div className="flex items-center justify-between pt-2">
            <p className="text-sm font-semibold text-[#103d2c]">Total</p>
            <p className="text-xl font-semibold text-[#4b164c]">
              {formatCurrency(subtotal)}
            </p>
          </div>
        </div>

        {!isStoreOpen ? (
          <p className="mt-5 rounded-[8px] border border-[#4b164c]/25 bg-[#f7ecf8] px-3 py-3 text-sm font-semibold leading-6 text-[#4b164c]">
            No momento estamos fechados. Volte em breve 💜
          </p>
        ) : null}

        {submitMessage ? (
          <p
            className={`mt-5 rounded-[8px] border px-3 py-3 text-sm leading-6 ${
              submitState === "success"
                ? "border-[#103d2c]/25 bg-[#e9f4ee] text-[#103d2c]"
                : "border-[#8a1f2d]/25 bg-[#fff0f2] text-[#8a1f2d]"
            }`}
          >
            {submitMessage}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!isStoreOpen || !canCheckout || submitState === "submitting"}
          onClick={onSubmit}
          className="mt-5 min-h-12 w-full border border-[#103d2c] bg-[#103d2c] px-4 text-sm font-semibold text-white transition enabled:hover:border-[#d7a948] enabled:hover:bg-[#d7a948] enabled:hover:text-[#103d2c] disabled:cursor-not-allowed disabled:opacity-45"
        >
          {submitState === "submitting"
            ? "Enviando pedido..."
            : !isStoreOpen
              ? "Loja fechada"
              : canCheckout
              ? "Finalizar pedido"
              : "Preencha os dados"}
        </button>

        </div>
      </div>
    </aside>
  );
}

function CupCustomizer({
  product,
  activeComboCup,
  currentStep,
  errorMessage,
  isCombo,
  selections,
  complementGroups,
  pureComboCups,
  totalSteps,
  totalPrice,
  isValid,
  onBack,
  onClose,
  onConfirm,
  onDecrementOption,
  onIncrementOption,
  onReset,
  onToggleOption,
}: {
  product: Product;
  activeComboCup?: ComboCup;
  currentStep: number;
  errorMessage: string;
  isCombo: boolean;
  selections: SelectionState;
  complementGroups: ComplementGroup[];
  pureComboCups: ComboCup[];
  totalSteps: number;
  totalPrice: number;
  isValid: boolean;
  onBack?: () => void;
  onClose: () => void;
  onConfirm: () => void;
  onDecrementOption: (group: ComplementGroup, optionId: string) => void;
  onIncrementOption: (group: ComplementGroup, optionId: string) => void;
  onReset: () => void;
  onToggleOption: (group: ComplementGroup, optionId: string) => void;
}) {
  const isLastStep = !isCombo || currentStep === totalSteps - 1;

  return (
    <div className="fixed inset-0 z-50 grid items-end bg-[#16221a]/70 px-3 pt-8 backdrop-blur-sm sm:place-items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-title"
        className="mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-t-[18px] bg-[#fffaf0] shadow-[0_28px_90px_rgba(0,0,0,0.28)] sm:max-h-[92vh] sm:rounded-[8px]"
      >
        <div className="grid gap-4 border-b border-[#d7a948]/35 bg-white p-4 sm:grid-cols-[1fr_140px] sm:p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#4b164c] sm:tracking-[0.16em]">
              {isCombo ? product.name : "Personalize seu copo"}
            </p>
            <h3
              id="customizer-title"
              className="mt-2 text-xl font-semibold leading-tight text-[#103d2c] sm:text-2xl"
            >
              {isCombo && activeComboCup
                ? `Personalize o ${activeComboCup.label}`
                : product.name}
            </h3>
            <p className="mt-2 text-sm leading-6 text-[#526354]">
              {isCombo
                ? `Etapa ${currentStep + 1} de ${totalSteps}. Escolha os complementos deste copo sem misturar com os demais.`
                : "Monte do seu jeito escolhendo os complementos inclusos deste copo."}
            </p>
            {isCombo && pureComboCups.length > 0 ? (
              <div className="mt-3 grid gap-2">
                {pureComboCups.map((cup) => (
                  <p
                    key={cup.id}
                    className="w-fit rounded-[8px] border border-[#d7a948]/35 bg-[#fffaf0] px-3 py-2 text-xs font-semibold text-[#4b164c]"
                  >
                    {cup.label}: Açaí puro, sem complementos.
                  </p>
                ))}
              </div>
            ) : null}
          </div>

          {product.image ? (
            <div className="relative hidden min-h-32 overflow-hidden rounded-[8px] bg-[#103d2c] sm:block">
              <CatalogImage
                src={product.image}
                alt={product.name}
                position={product.imagePosition}
              />
            </div>
          ) : null}
        </div>

        <div className="overflow-y-auto px-4 py-4 sm:px-5">
          <div className="space-y-5">
            {complementGroups.map((group) => (
              <ComplementGroupSelector
                key={group.id}
                group={group}
                selectedIds={selections[group.id] ?? []}
                onDecrement={(optionId) => onDecrementOption(group, optionId)}
                onIncrement={(optionId) => onIncrementOption(group, optionId)}
                onToggle={(optionId) => onToggleOption(group, optionId)}
              />
            ))}
            {errorMessage ? (
              <p className="rounded-[8px] border border-[#8a1f2d]/30 bg-[#fff0f2] px-3 py-3 text-sm text-[#8a1f2d]">
                {errorMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="border-t border-[#d7a948]/35 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4b164c]">
                {isCombo ? "Total do combo" : "Total do copo"}
              </p>
              <p className="text-2xl font-semibold text-[#103d2c]">
                {formatCurrency(totalPrice)}
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {onBack ? (
                <button
                  type="button"
                  onClick={onBack}
                  className="min-h-11 border border-[#103d2c]/30 px-4 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f3ead2]"
                >
                  Voltar
                </button>
              ) : null}
              <button
                type="button"
                onClick={onReset}
                className="min-h-11 border border-[#d7a948]/60 px-4 text-sm font-semibold text-[#4b164c] transition hover:bg-[#f3ead2]"
              >
                Limpar escolhas
              </button>
              <button
                type="button"
                onClick={onClose}
                className="min-h-11 border border-[#103d2c]/30 px-4 text-sm font-semibold text-[#103d2c] transition hover:bg-[#f3ead2]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!isValid}
                onClick={onConfirm}
                className="min-h-11 border border-[#103d2c] bg-[#103d2c] px-5 text-sm font-semibold text-white transition enabled:hover:border-[#d7a948] enabled:hover:bg-[#d7a948] enabled:hover:text-[#103d2c] disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isCombo ? (isLastStep ? "Adicionar ao carrinho" : "Continuar") : "Adicionar copo"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComplementGroupSelector({
  group,
  onDecrement,
  onIncrement,
  selectedIds,
  onToggle,
}: {
  group: ComplementGroup;
  onDecrement: (optionId: string) => void;
  onIncrement: (optionId: string) => void;
  selectedIds: string[];
  onToggle: (optionId: string) => void;
}) {
  const usesQuantity = isQuantityGroup(group);

  return (
    <section className="rounded-[8px] border border-[#d7a948]/30 bg-white p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h4 className="text-base font-semibold text-[#103d2c]">{group.title}</h4>
          <p className="mt-1 text-sm text-[#526354]">{group.description}</p>
        </div>
        <span className="w-fit bg-[#f3ead2] px-2 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#4b164c]">
          {group.required
            ? "Obrigatório"
            : group.maxSelections
              ? `Até ${group.maxSelections}`
              : "Opcional"}
        </span>
      </div>

      <div className="mt-4 grid gap-2">
        {group.options.map((option) => {
          const quantity = getOptionQuantity(selectedIds, option.id, usesQuantity);
          const isSelected = quantity > 0;
          const maxReached =
            group.type === "multiple" &&
            group.maxSelections !== undefined &&
            selectedIds.length >= group.maxSelections &&
            !isSelected;

          if (usesQuantity) {
            return (
              <ComplementQuantityOption
                key={option.id}
                option={option}
                quantity={quantity}
                onDecrement={() => onDecrement(option.id)}
                onIncrement={() => onIncrement(option.id)}
              />
            );
          }

          return (
            <ComplementOptionButton
              key={option.id}
              group={group}
              option={option}
              selected={isSelected}
              disabled={maxReached}
              onToggle={() => onToggle(option.id)}
            />
          );
        })}
      </div>
    </section>
  );
}

function ComplementQuantityOption({
  option,
  quantity,
  onDecrement,
  onIncrement,
}: {
  option: ComplementOption;
  quantity: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  const selected = quantity > 0;

  return (
    <div
      className={`grid min-h-16 gap-3 rounded-[8px] border px-3 py-3 transition sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${
        selected
          ? "border-[#103d2c] bg-[#f3ead2]"
          : "border-[#d7a948]/25 bg-white"
      }`}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[#103d2c]">{option.name}</p>
        {option.description ? (
          <p className="mt-1 text-xs leading-5 text-[#526354]">
            {option.description}
          </p>
        ) : null}
        <p className="mt-1 text-xs font-semibold text-[#4b164c]">
          {formatOptionPrice(option.price)} cada
        </p>
      </div>

      <div className="flex min-h-11 w-fit items-center border border-[#103d2c]/35 bg-white">
        <button
          type="button"
          onClick={onDecrement}
          disabled={quantity === 0}
          className="grid size-11 place-items-center text-lg font-semibold text-[#103d2c] transition enabled:hover:bg-[#f3ead2] disabled:cursor-not-allowed disabled:opacity-35"
          aria-label={`Diminuir ${option.name}`}
        >
          -
        </button>
        <span className="grid min-w-10 place-items-center text-sm font-semibold text-[#103d2c]">
          {quantity}
        </span>
        <button
          type="button"
          onClick={onIncrement}
          className="grid size-11 place-items-center bg-[#103d2c] text-lg font-semibold text-white transition hover:bg-[#4b164c]"
          aria-label={`Adicionar ${option.name}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function ComplementOptionButton({
  group,
  option,
  selected,
  disabled,
  onToggle,
}: {
  group: ComplementGroup;
  option: ComplementOption;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-disabled={disabled}
      className={`grid min-h-16 grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 rounded-[8px] border px-3 py-3 text-left transition ${
        selected
          ? "border-[#103d2c] bg-[#f3ead2]"
          : "border-[#d7a948]/25 bg-white hover:border-[#d7a948]"
      } ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
      aria-pressed={selected}
    >
      <span
        className={`grid size-5 place-items-center border ${
          selected ? "border-[#103d2c] bg-[#103d2c]" : "border-[#d7a948]"
        } ${group.type === "single" ? "rounded-full" : "rounded-[4px]"}`}
        aria-hidden="true"
      >
        {selected ? <span className="size-2 bg-[#d7a948]" /> : null}
      </span>

      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[#103d2c]">
          {option.name}
        </span>
        {option.description ? (
          <span className="mt-1 block text-xs leading-5 text-[#526354]">
            {option.description}
          </span>
        ) : null}
      </span>

      <span className="shrink-0 text-sm font-semibold text-[#4b164c]">
        {formatOptionPrice(option.price)}
      </span>
    </button>
  );
}

function CatalogImage({
  alt,
  position,
  src,
}: {
  alt: string;
  position: string;
  src: string;
}) {
  const canRenderImage = src.startsWith("/images/");

  return (
    <div
      className="relative h-full min-h-full w-full overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#fff7df_0%,#f3ead2_48%,#e2cf9f_100%)]"
    >
      {canRenderImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 430px) 100vw, 180px"
          className="object-contain p-2 drop-shadow-[0_16px_24px_rgba(22,34,26,0.22)]"
          style={{ objectPosition: position }}
        />
      ) : null}
    </div>
  );
}
