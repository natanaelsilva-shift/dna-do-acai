"use client";

import { useRef, useState } from "react";
import type { DeliveryMethod, OrderCustomizationLine, PaymentMethod } from "@/data/orders";
import { useCart } from "@/components/cart/CartProvider";
import { useCheckout } from "@/components/checkout/CheckoutProvider";
import { useStore } from "@/components/store/StoreProvider";
import { ProductArt } from "@/components/product/ProductArt";
import { useDialog } from "@/hooks/useDialog";
import { paymentLabels } from "@/lib/checkout/form";
import { formatCurrency } from "@/lib/format/currency";

type Step = "bag" | "details";

// Sacola + checkout. Celular: bottom sheet. Desktop: drawer à direita.
// Toda regra (itens, totais, validação, envio) vem dos providers existentes;
// aqui é só interface.
export function CartSheet() {
  const { isCartDrawerOpen, closeCartDrawer } = useCart();
  const [step, setStep] = useState<Step>("bag");
  const panelRef = useRef<HTMLDivElement>(null);

  function close() {
    closeCartDrawer();
    setStep("bag");
  }

  useDialog(panelRef, isCartDrawerOpen, close);

  if (!isCartDrawerOpen) return null;

  return (
    <div className="dna-store fixed inset-0 z-[70] !bg-transparent">
      <button
        type="button"
        aria-label="Fechar sacola"
        tabIndex={-1}
        onClick={close}
        className="dna-fade-in absolute inset-0 cursor-default bg-dna-night/70 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sacola-title"
        className="dna-paper dna-sheet-in absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col rounded-t-[1.75rem] shadow-[0_-30px_80px_rgb(10_4_12/0.5)] lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[min(31rem,100vw)] lg:rounded-none lg:rounded-l-[1.75rem]"
      >
        {step === "bag" ? (
          <BagStep onClose={close} onContinue={() => setStep("details")} />
        ) : (
          <DetailsStep onBack={() => setStep("bag")} onClose={close} />
        )}
      </div>
    </div>
  );
}

function SheetHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center gap-2 border-b border-dna-ink/10 px-5 py-4 lg:px-7 lg:py-5">
      <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-dna-ink/15 lg:hidden" />
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar para a sacola"
          className="-ml-2 grid size-11 place-items-center rounded-full text-xl hover:bg-dna-ink/5"
        >
          ←
        </button>
      ) : null}
      <h2 id="sacola-title" className="dna-title flex-1 text-2xl lg:text-3xl">
        {title}
      </h2>
      <button
        type="button"
        onClick={onClose}
        aria-label="Fechar sacola"
        className="-mr-2 grid size-11 place-items-center rounded-full text-2xl leading-none hover:bg-dna-ink/5"
      >
        ×
      </button>
    </header>
  );
}

function BagStep({ onClose, onContinue }: { onClose: () => void; onContinue: () => void }) {
  const { cartItems, totalItems, totalPrice, incrementCartItem, decrementCartItem, clearCart, priceNotice } = useCart();
  const { submitState, submitMessage } = useCheckout();
  const { products } = useStore();

  if (submitState === "success" && totalItems === 0) {
    return (
      <>
        <SheetHeader title="Pedido enviado" onClose={onClose} />
        <div className="flex flex-1 flex-col items-start justify-center gap-5 px-5 py-10 lg:px-7">
          <span aria-hidden="true" className="grid size-14 place-items-center rounded-full bg-dna-leaf text-2xl text-white">
            ✓
          </span>
          <p role="status" className="text-lg leading-relaxed">
            {submitMessage}
          </p>
          <button type="button" onClick={onClose} className="dna-btn dna-btn-primary">
            Voltar ao cardápio
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <SheetHeader title="Sua sacola" onClose={onClose} />

      {priceNotice ? <p role="status" className="mx-5 mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{priceNotice}</p> : null}

      {totalItems === 0 ? (
        <div className="flex flex-1 flex-col items-start justify-center gap-4 px-5 py-12 lg:px-7">
          <p className="text-lg">Sua sacola está vazia.</p>
          <p className="text-dna-ink/65">Escolha um copo no cardápio ou monte o seu.</p>
          <a href="#cardapio" onClick={onClose} className="dna-btn dna-btn-primary">
            Ver cardápio
          </a>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-dna-ink/10 overflow-y-auto overscroll-contain px-5 lg:px-7">
          {cartItems.map((item) => {
            const product = products.find((candidate) => candidate.id === item.productId);
            return (
              <li key={item.id} className="flex gap-4 py-4">
                <div className="h-20 w-16 shrink-0 overflow-hidden rounded-xl bg-dna-acai/90 p-1">
                  {product ? <ProductArt product={product} className="h-full" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-semibold leading-snug">{item.name}</p>
                    <p className="dna-price shrink-0 text-lg">{formatCurrency(item.unitPrice * item.quantity)}</p>
                  </div>
                  <p className="mt-0.5 text-sm text-dna-ink/60">
                    {formatCurrency(item.unitPrice)} cada
                  </p>
                  {item.customization && item.customization.length > 0 ? (
                    <Choices lines={item.customization} />
                  ) : null}
                  <div className="mt-3 flex w-fit items-center gap-1 rounded-full bg-dna-ink/5 p-1">
                    <button
                      type="button"
                      onClick={() => decrementCartItem(item.id)}
                      aria-label={`Diminuir ${item.name}`}
                      className="grid size-10 place-items-center rounded-full text-lg hover:bg-dna-ink/10"
                    >
                      −
                    </button>
                    <span className="w-6 text-center font-semibold tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => incrementCartItem(item.id)}
                      aria-label={`Aumentar ${item.name}`}
                      className="grid size-10 place-items-center rounded-full bg-dna-ink text-lg text-dna-cream"
                    >
                      +
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {totalItems > 0 ? (
        <footer className="shrink-0 border-t border-dna-ink/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 lg:px-7 lg:pb-7">
          <Totals subtotal={totalPrice} />
          <button type="button" onClick={clearCart} className="mt-3 text-sm font-semibold text-dna-berry underline">Limpar sacola</button>
          <button type="button" onClick={onContinue} className="dna-btn dna-btn-primary mt-4 w-full">
            Continuar
          </button>
        </footer>
      ) : null}
    </>
  );
}

function Choices({ lines }: { lines: OrderCustomizationLine[] }) {
  return (
    <details className="group mt-2 text-sm">
      <summary className="cursor-pointer list-none font-semibold text-dna-berry [&::-webkit-details-marker]:hidden">
        <span className="group-open:hidden">Ver escolhas</span>
        <span className="hidden group-open:inline">Ocultar escolhas</span>
      </summary>
      <dl className="mt-2 space-y-2 text-dna-ink/75">
        {lines.map((line) => (
          <div key={`${line.groupTitle}-${line.options}`}>
            <dt className="font-semibold text-dna-ink">{line.groupTitle}</dt>
            <dd>
              {line.optionsList && line.optionsList.length > 0 ? line.optionsList.join(", ") : line.options}
              {line.price > 0 ? (
                <span className="ml-1 font-semibold text-dna-berry">(+{formatCurrency(line.price)})</span>
              ) : null}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

function Totals({ subtotal }: { subtotal: number }) {
  return (
    <dl className="grid gap-1.5 text-[0.95rem]">
      <div className="flex justify-between text-dna-ink/70">
        <dt>Subtotal</dt>
        <dd>{formatCurrency(subtotal)}</dd>
      </div>
      <div className="flex justify-between text-dna-ink/70">
        <dt>Taxa de entrega</dt>
        <dd>A combinar</dd>
      </div>
      <div className="flex items-baseline justify-between pt-1">
        <dt className="font-semibold">Total</dt>
        <dd className="dna-price text-2xl">{formatCurrency(subtotal)}</dd>
      </div>
    </dl>
  );
}

function DetailsStep({ onBack, onClose }: { onBack: () => void; onClose: () => void }) {
  const { isStoreOpen, isStoreClosed, storeUnavailableMessage } = useStore();
  const { totalItems, priceNotice } = useCart();
  const {
    checkout,
    canCheckout,
    orderTotal,
    submitState,
    submitMessage,
    updateCheckoutField,
    submitOrder,
  } = useCheckout();

  if (submitState === "success" && totalItems === 0) {
    return <BagStep onClose={onClose} onContinue={onBack} />;
  }

  return (
    <>
      <SheetHeader title="Entrega e pagamento" onBack={onBack} onClose={onClose} />

      <form
        id="checkout-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submitOrder();
        }}
        className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-5 py-5 lg:px-7"
      >
        <Field label="Nome">
          <input
            data-autofocus
            name="name"
            value={checkout.customerName}
            onChange={(event) => updateCheckoutField("customerName", event.target.value)}
            className="dna-field"
            placeholder="Seu nome"
            autoComplete="name"
          />
        </Field>

        <Field label="Telefone">
          <input
            value={checkout.customerPhone}
            onChange={(event) => updateCheckoutField("customerPhone", event.target.value)}
            className="dna-field"
            placeholder="(00) 00000-0000"
            type="tel"
            name="tel"
            inputMode="tel"
            autoComplete="tel"
          />
        </Field>

        <fieldset>
          <legend className="dna-label mb-2">Tipo de pedido</legend>
          <div className="grid grid-cols-2 gap-1 rounded-full bg-dna-ink/6 p-1">
            {(["delivery", "pickup"] as DeliveryMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                aria-pressed={checkout.deliveryMethod === method}
                onClick={() => updateCheckoutField("deliveryMethod", method)}
                className={`min-h-11 rounded-full font-semibold transition-colors ${
                  checkout.deliveryMethod === method ? "bg-dna-ink text-dna-cream" : "hover:bg-dna-ink/5"
                }`}
              >
                {method === "delivery" ? "Entrega" : "Retirada"}
              </button>
            ))}
          </div>
        </fieldset>

        {checkout.deliveryMethod === "delivery" ? (
          <>
            <Field label="Endereço">
              <input
                value={checkout.address}
                onChange={(event) => updateCheckoutField("address", event.target.value)}
                className="dna-field"
                placeholder="Rua ou avenida"
                autoComplete="street-address"
                name="address"
              />
            </Field>
            <Field label="Número">
              <input value={checkout.addressNumber} onChange={(event) => updateCheckoutField("addressNumber", event.target.value)} className="dna-field" placeholder="Número ou S/N" name="address-number" maxLength={20} />
            </Field>
            <Field label="Complemento (opcional)">
              <input value={checkout.addressComplement} onChange={(event) => updateCheckoutField("addressComplement", event.target.value)} className="dna-field" placeholder="Apartamento, bloco, casa…" name="address-complement" maxLength={120} />
            </Field>
            <Field label="Referência (opcional)">
              <input value={checkout.addressReference} onChange={(event) => updateCheckoutField("addressReference", event.target.value)} className="dna-field" placeholder="Um ponto próximo para ajudar na entrega" name="address-reference" maxLength={180} />
            </Field>
            <Field label="Bairro">
              <input
                value={checkout.neighborhood}
                onChange={(event) => updateCheckoutField("neighborhood", event.target.value)}
                className="dna-field"
                placeholder="Seu bairro"
                name="neighborhood"
                autoComplete="address-level3"
              />
            </Field>
          </>
        ) : null}

        <fieldset>
          <legend className="dna-label mb-2">Pagamento</legend>
          <div className="grid gap-2">
            {(["pix", "card", "cash"] as PaymentMethod[]).map((method) => (
              <button
                key={method}
                type="button"
                aria-pressed={checkout.paymentMethod === method}
                onClick={() => updateCheckoutField("paymentMethod", method)}
                className={`flex min-h-12 items-center justify-between rounded-[var(--radius-field)] border px-4 text-left font-semibold transition-colors ${
                  checkout.paymentMethod === method
                    ? "border-dna-ink bg-dna-ink text-dna-cream"
                    : "border-dna-ink/15 bg-white hover:border-dna-ink/40"
                }`}
              >
                {paymentLabels[method]}
                <span
                  aria-hidden="true"
                  className={`size-4 rounded-full border-2 ${
                    checkout.paymentMethod === method ? "border-dna-cream bg-dna-sprout" : "border-dna-ink/30"
                  }`}
                />
              </button>
            ))}
          </div>
        </fieldset>

        {checkout.paymentMethod === "cash" ? (
          <Field label="Troco">
            <input
              value={checkout.changeFor}
              onChange={(event) => updateCheckoutField("changeFor", event.target.value)}
              className="dna-field"
              placeholder="Ex.: 50,00; vazio se não precisar"
              name="change-for"
              autoComplete="off"
              inputMode="decimal"
            />
          </Field>
        ) : null}

        <Field label="Observações">
          <textarea
            value={checkout.notes}
            onChange={(event) => updateCheckoutField("notes", event.target.value)}
            className="dna-field min-h-24 resize-none py-3"
            placeholder="Ex.: sem granola, retirar no balcão às 18h"
            name="notes"
            autoComplete="off"
          />
        </Field>
      </form>

      <footer className="shrink-0 border-t border-dna-ink/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 lg:px-7 lg:pb-7">
        <div className="flex items-baseline justify-between">
          <span className="font-semibold">Total</span>
          <span className="dna-price text-2xl">{formatCurrency(orderTotal)}</span>
        </div>
        <p className="text-sm text-dna-ink/60">Taxa de entrega a combinar.</p>

        {priceNotice ? <p role="status" className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{priceNotice}</p> : null}

        {!isStoreOpen ? (
          <p className="mt-3 rounded-xl bg-dna-acai/10 px-4 py-3 text-sm font-semibold text-dna-acai">
            {storeUnavailableMessage}
          </p>
        ) : null}

        {submitMessage && submitState !== "success" ? (
          <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
            {submitMessage}
          </p>
        ) : null}

        <button
          type="submit"
          form="checkout-form"
          disabled={!isStoreOpen || !canCheckout || submitState === "submitting"}
          className="dna-btn dna-btn-primary mt-4 w-full"
        >
          {submitState === "submitting"
            ? "Enviando pedido…"
            : !isStoreOpen
              ? isStoreClosed ? "Loja fechada" : "Verificando loja…"
              : canCheckout
                ? "Finalizar pedido"
                : "Preencha os dados"}
        </button>
      </footer>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="dna-label">{label}</span>
      {children}
    </label>
  );
}
