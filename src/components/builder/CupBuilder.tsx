"use client";

import { useMemo, useState } from "react";
import type { ComplementGroup, ComplementOption, Product } from "@/data/menu";
import { ingredientCues } from "@/data/experience";
import { cupSizes, defaultBuilderProductId } from "@/data/sizes";
import { useCart } from "@/components/cart/CartProvider";
import { useStore } from "@/components/store/StoreProvider";
import { CupPreview, type PreviewIngredient } from "@/components/builder/CupPreview";
import {
  SPOON_NAPKIN_GROUP_ID,
  TURBINE_GROUP_ID,
  buildCustomizedCupCartLine,
  calculateCustomizedPrice,
  decrementOptionSelection,
  getComplementGroupsForProduct,
  getDefaultSelections,
  getOptionQuantity,
  incrementOptionSelection,
  isQuantityGroup,
  isSelectionValid,
  toggleOptionSelection,
  type SelectionResult,
  type SelectionState,
} from "@/lib/catalog/customization";
import { formatCurrency, formatOptionPrice } from "@/lib/format/currency";

const FREE_GROUP_ID = "complementos";

// Configurador visual. Usa os produtos reais "Monte seu açaí" e as mesmas
// regras/linhas de carrinho do personalizador: o item que entra na sacola é
// idêntico ao montado pelo cardápio.
export function CupBuilder() {
  const { products, complementGroups } = useStore();
  const { addCartLine, openCartDrawer } = useCart();

  const sizes = useMemo(
    () =>
      cupSizes
        .map((size) => ({
          ...size,
          product: products.find((product) => product.id === size.productId),
        }))
        .filter((size): size is typeof size & { product: Product } => Boolean(size.product)),
    [products],
  );

  const [productId, setProductId] = useState(defaultBuilderProductId);
  const activeSize = sizes.find((size) => size.productId === productId) ?? sizes[0];
  const product = activeSize?.product;
  const groups = useMemo(
    () => (product ? getComplementGroupsForProduct(product, complementGroups) : []),
    [product, complementGroups],
  );

  const [selections, setSelections] = useState<SelectionState>(() =>
    getDefaultSelections(complementGroups),
  );
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState<string | null>(null);

  if (!product || !activeSize) {
    return null;
  }

  const freeGroup = groups.find((group) => group.id === FREE_GROUP_ID);
  const turbineGroup = groups.find((group) => group.id === TURBINE_GROUP_ID);
  const spoonGroup = groups.find((group) => group.id === SPOON_NAPKIN_GROUP_ID);
  const otherGroups = groups.filter(
    (group) => ![FREE_GROUP_ID, TURBINE_GROUP_ID, SPOON_NAPKIN_GROUP_ID].includes(group.id),
  );
  const freeLimit = freeGroup?.maxSelections ?? 0;
  const freeSelected = freeGroup ? selections[freeGroup.id] ?? [] : [];
  const price = calculateCustomizedPrice(product, selections, groups);
  const valid = isSelectionValid(selections, groups);

  const previewIngredients: PreviewIngredient[] = freeGroup
    ? freeSelected
        .map((optionId) => freeGroup.options.find((option) => option.id === optionId))
        .filter((option): option is ComplementOption => Boolean(option))
        .map((option) => ({
          id: option.id,
          label: option.name,
          asset: ingredientCues.find((cue) => cue.id === option.id)?.asset,
        }))
    : [];
  const previewExtras = turbineGroup
    ? turbineGroup.options
        .map((option) => ({
          id: option.id,
          label: option.name,
          quantity: getOptionQuantity(selections[turbineGroup.id] ?? [], option.id, true),
        }))
        .filter((extra) => extra.quantity > 0)
    : [];

  function apply(result: SelectionResult) {
    setSelections(result.selections);
    if (result.error !== null) setMessage(result.error);
    setAdded(null);
  }

  function changeSize(nextProductId: string) {
    const nextProduct = sizes.find((size) => size.productId === nextProductId)?.product;
    if (!nextProduct) return;

    const nextGroups = getComplementGroupsForProduct(nextProduct, complementGroups);
    const nextLimit = nextGroups.find((group) => group.id === FREE_GROUP_ID)?.maxSelections;
    const current = selections[FREE_GROUP_ID] ?? [];

    setProductId(nextProductId);
    setAdded(null);

    if (nextLimit !== undefined && current.length > nextLimit) {
      setSelections({ ...selections, [FREE_GROUP_ID]: current.slice(0, nextLimit) });
      setMessage(
        `O copo de ${nextProduct.name.match(/\d+ml/)?.[0] ?? "menor tamanho"} leva até ${nextLimit} complementos grátis. Mantivemos os ${nextLimit} primeiros.`,
      );
    } else {
      setMessage("");
    }
  }

  function addToCart() {
    if (!product || !valid) return;

    addCartLine(buildCustomizedCupCartLine(product, selections, groups));
    setAdded(`${product.name} na sacola.`);
    setMessage("");
    setSelections(getDefaultSelections(complementGroups));
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-16">
      <div className="lg:sticky lg:top-24 lg:self-start">
        <CupPreview
          size={activeSize.size}
          scale={activeSize.scale}
          ingredients={previewIngredients}
          extras={previewExtras}
          freeCount={freeSelected.length}
          freeLimit={freeLimit}
        />
      </div>

      <div className="grid gap-10">
        <BuilderStep number={1} title="Escolha o tamanho">
          <div role="radiogroup" aria-label="Tamanho do copo" className="grid grid-cols-3 gap-2 sm:gap-3">
            {sizes.map((size) => {
              const selected = size.productId === productId;
              const limit = size.product.complementLimit;
              return (
                <button
                  key={size.productId}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => changeSize(size.productId)}
                  className={`group flex min-h-36 flex-col justify-between rounded-[1.25rem] border p-3 text-left transition-colors duration-200 sm:p-4 ${
                    selected
                      ? "border-dna-cream bg-dna-cream text-dna-ink"
                      : "border-dna-cream/15 bg-dna-night/30 text-dna-cream hover:border-dna-cream/40"
                  }`}
                >
                  <span className="dna-display text-[2.6rem] leading-none sm:text-6xl">
                    {size.size}
                    <span className="ml-0.5 align-top text-base font-bold sm:text-lg">ml</span>
                  </span>
                  <span>
                    <span className={`block text-[0.8rem] leading-tight sm:text-sm ${selected ? "text-dna-ink/70" : "text-dna-cream/65"}`}>
                      {size.tagline}
                    </span>
                    <span className="dna-price mt-1.5 block text-base sm:text-lg">
                      {formatCurrency(size.product.price)}
                    </span>
                    {limit ? (
                      <span className={`mt-0.5 block text-xs ${selected ? "text-dna-ink/60" : "text-dna-cream/50"}`}>
                        até {limit} complementos
                      </span>
                    ) : null}
                  </span>
                </button>
              );
            })}
          </div>
        </BuilderStep>

        {freeGroup ? (
          <BuilderStep
            number={2}
            title="Complementos grátis"
            aside={`${freeSelected.length} de ${freeLimit}`}
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
              {freeGroup.options.map((option) => {
                const selected = freeSelected.includes(option.id);
                const blocked = !selected && freeSelected.length >= freeLimit;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={selected}
                    aria-disabled={blocked}
                    onClick={() => apply(toggleOptionSelection(selections, freeGroup, option.id))}
                    className={`relative flex min-h-20 items-end rounded-[1.1rem] border p-3 text-left transition-[background-color,border-color,opacity,transform] duration-200 active:scale-[0.98] ${
                      selected
                        ? "border-dna-cream bg-dna-cream text-dna-ink"
                        : "border-dna-cream/15 bg-dna-night/30 text-dna-cream hover:border-dna-cream/40"
                    } ${blocked ? "opacity-45" : ""}`}
                  >
                    <span className="text-[0.95rem] font-semibold leading-tight sm:text-base">{option.name}</span>
                    <SelectedMark selected={selected} />
                  </button>
                );
              })}
            </div>
          </BuilderStep>
        ) : null}

        {turbineGroup ? (
          <BuilderStep number={3} title="Turbine seu açaí" aside="opcional">
            <ul className="grid gap-2">
              {turbineGroup.options.map((option) => {
                const quantity = getOptionQuantity(selections[turbineGroup.id] ?? [], option.id, true);
                return (
                  <li
                    key={option.id}
                    className={`flex min-h-14 items-center justify-between gap-3 rounded-[1rem] border px-4 transition-colors ${
                      quantity > 0 ? "border-dna-sprout/60 bg-dna-forest/40" : "border-dna-cream/12"
                    }`}
                  >
                    <span>
                      <span className="block font-semibold">{option.name}</span>
                      <span className="text-sm text-dna-cream/60">{formatOptionPrice(option.price)} cada</span>
                    </span>
                    <Stepper
                      label={option.name}
                      quantity={quantity}
                      onDecrement={() => apply(decrementOptionSelection(selections, turbineGroup, option.id))}
                      onIncrement={() => apply(incrementOptionSelection(selections, turbineGroup, option.id))}
                    />
                  </li>
                );
              })}
            </ul>
          </BuilderStep>
        ) : null}

        {[spoonGroup, ...otherGroups].map((group, index) =>
          group ? (
            <BuilderStep key={group.id} number={4 + index} title={group.title}>
              <ChoiceGroup group={group} selections={selections} onChange={apply} />
            </BuilderStep>
          ) : null,
        )}

        <div className="sticky bottom-3 z-20 lg:static">
          <div className="dna-glass flex items-center justify-between gap-4 rounded-[1.4rem] p-3 pl-5 lg:bg-transparent lg:p-0 lg:backdrop-blur-none lg:[border:0]">
            <div aria-live="polite">
              <span className="block text-sm text-dna-cream/65">Total do copo</span>
              <span className="dna-price block text-2xl lg:text-3xl">{formatCurrency(price)}</span>
            </div>
            <button
              type="button"
              disabled={!valid}
              onClick={addToCart}
              className="dna-btn dna-btn-primary min-h-13 px-6"
            >
              Adicionar à sacola
            </button>
          </div>

          <div aria-live="polite" className="mt-3 empty:hidden">
            {message ? <p className="rounded-xl bg-dna-night/50 px-4 py-3 text-sm text-dna-cream/90">{message}</p> : null}
            {added ? (
              <p className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-dna-forest/70 px-4 py-3 text-sm">
                {added}
                <button type="button" onClick={openCartDrawer} className="font-semibold underline underline-offset-4">
                  Ver sacola
                </button>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function BuilderStep({
  number,
  title,
  aside,
  children,
}: {
  number: number;
  title: string;
  aside?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="min-w-0">
      <legend className="mb-4 flex w-full items-baseline justify-between gap-4">
        <span className="dna-title text-2xl sm:text-3xl">
          <span className="mr-2 text-dna-orchid">{number}.</span>
          {title}
        </span>
        {aside ? <span className="shrink-0 text-sm text-dna-cream/60">{aside}</span> : null}
      </legend>
      {children}
    </fieldset>
  );
}

function ChoiceGroup({
  group,
  selections,
  onChange,
}: {
  group: ComplementGroup;
  selections: SelectionState;
  onChange: (result: SelectionResult) => void;
}) {
  const selectedIds = selections[group.id] ?? [];
  const quantityGroup = isQuantityGroup(group);

  return (
    <div className="flex flex-wrap gap-2">
      {group.options.map((option) => {
        const selected = getOptionQuantity(selectedIds, option.id, quantityGroup) > 0;
        return (
          <button
            key={option.id}
            type="button"
            className="dna-chip"
            aria-pressed={selected}
            onClick={() => onChange(toggleOptionSelection(selections, group, option.id))}
          >
            {option.name}
            {option.price > 0 ? <span className="opacity-70">{formatOptionPrice(option.price)}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

function Stepper({
  label,
  quantity,
  onDecrement,
  onIncrement,
}: {
  label: string;
  quantity: number;
  onDecrement: () => void;
  onIncrement: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={onDecrement}
        disabled={quantity === 0}
        aria-label={`Diminuir ${label}`}
        className="grid size-11 place-items-center rounded-full text-xl transition-colors enabled:hover:bg-white/10 disabled:opacity-30"
      >
        −
      </button>
      <span className="w-6 text-center font-semibold tabular-nums" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        onClick={onIncrement}
        aria-label={`Adicionar ${label}`}
        className="grid size-11 place-items-center rounded-full bg-dna-cream text-xl text-dna-ink transition-transform active:scale-95"
      >
        +
      </button>
    </div>
  );
}

function SelectedMark({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`absolute right-3 top-3 grid size-6 place-items-center rounded-full border transition-colors ${
        selected ? "border-dna-leaf bg-dna-leaf text-white" : "border-dna-cream/30"
      }`}
    >
      {selected ? (
        <svg viewBox="0 0 16 16" className="size-3.5">
          <path d="M3.5 8.5 6.5 11.5 12.5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : null}
    </span>
  );
}
