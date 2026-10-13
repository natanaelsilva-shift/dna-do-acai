"use client";

import { useRef } from "react";
import type { ComplementGroup, ComplementOption } from "@/data/menu";
import { useCustomizer } from "@/components/builder/CustomizerProvider";
import { ProductArt } from "@/components/product/ProductArt";
import { useDialog } from "@/hooks/useDialog";
import { getOptionQuantity, isQuantityGroup } from "@/lib/catalog/customization";
import { formatCurrency, formatOptionPrice } from "@/lib/format/currency";

// Personalizador aberto pelos cards do cardápio (copos e combos). Toda a regra
// vem do CustomizerProvider; aqui é só interface.
export function CustomizerDialog() {
  const {
    customizingProduct: product,
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
  const panelRef = useRef<HTMLDivElement>(null);

  useDialog(panelRef, Boolean(product), closeCustomizer);

  if (!product) return null;

  const totalSteps = customizableComboCups.length;
  const isLastStep = !isCombo || comboStepIndex === totalSteps - 1;

  return (
    <div className="dna-store fixed inset-0 z-[70] !bg-transparent">
      <button
        type="button"
        aria-label="Fechar personalização"
        tabIndex={-1}
        onClick={closeCustomizer}
        className="dna-fade-in absolute inset-0 cursor-default bg-dna-night/75 backdrop-blur-sm"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-title"
        className="dna-sheet-in absolute inset-x-0 bottom-0 flex max-h-[94dvh] flex-col rounded-t-[1.75rem] bg-dna-plum shadow-[0_-30px_80px_rgb(0_0_0/0.5)] lg:inset-y-0 lg:left-auto lg:right-0 lg:max-h-none lg:w-[min(36rem,100vw)] lg:rounded-none lg:rounded-l-[1.75rem]"
      >
        <header className="relative flex shrink-0 items-start gap-4 border-b border-dna-cream/10 px-5 pb-4 pt-6 lg:px-7">
          <span aria-hidden="true" className="absolute left-1/2 top-2 h-1 w-10 -translate-x-1/2 rounded-full bg-dna-cream/20 lg:hidden" />
          <div className="h-24 w-20 shrink-0 overflow-hidden rounded-2xl bg-dna-night/40">
            <ProductArt product={product} className="h-full" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-dna-sprout">
              {isCombo ? `${product.name}, copo ${comboStepIndex + 1} de ${totalSteps}` : "Personalize seu copo"}
            </p>
            <h2 id="customizer-title" className="dna-title mt-1 text-2xl lg:text-3xl">
              {isCombo && activeComboCup ? `Personalize o ${activeComboCup.label}` : product.name}
            </h2>
            {isCombo ? (
              <div className="mt-3 flex gap-1.5" aria-hidden="true">
                {customizableComboCups.map((cup, index) => (
                  <span
                    key={cup.id}
                    className={`h-1.5 flex-1 rounded-full ${index <= comboStepIndex ? "bg-dna-sprout" : "bg-dna-cream/15"}`}
                  />
                ))}
              </div>
            ) : null}
            {isCombo && pureComboCups.length > 0 ? (
              <p className="mt-2 text-sm text-dna-cream/65">
                {pureComboCups.map((cup) => `${cup.label}: açaí puro, sem complementos.`).join(" ")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={closeCustomizer}
            aria-label="Fechar personalização"
            className="-mr-2 -mt-1 grid size-11 shrink-0 place-items-center rounded-full text-2xl leading-none hover:bg-white/10"
          >
            ×
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-7 overflow-y-auto overscroll-contain px-5 py-6 lg:px-7">
          {activeComplementGroups.map((group) => (
            <GroupSection
              key={group.id}
              group={group}
              selectedIds={selections[group.id] ?? []}
              onToggle={(optionId) => toggleOption(group, optionId)}
              onIncrement={(optionId) => incrementOptionQuantity(group, optionId)}
              onDecrement={(optionId) => decrementOptionQuantity(group, optionId)}
            />
          ))}
          {customizationError ? (
            <p role="alert" className="rounded-xl bg-dna-night/60 px-4 py-3 text-sm">
              {customizationError}
            </p>
          ) : null}
        </div>

        <footer className="shrink-0 border-t border-dna-cream/10 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 lg:px-7 lg:pb-7">
          <div className="flex items-end justify-between gap-4">
            <div aria-live="polite">
              <span className="block text-sm text-dna-cream/65">{isCombo ? "Total do combo" : "Total do copo"}</span>
              <span className="dna-price block text-3xl">{formatCurrency(customizedPrice)}</span>
            </div>
            <button type="button" onClick={resetCurrentCustomization} className="text-sm font-semibold text-dna-cream/70 underline underline-offset-4 hover:text-dna-cream">
              Limpar escolhas
            </button>
          </div>
          <div className="mt-4 flex gap-2">
            {isCombo && comboStepIndex > 0 ? (
              <button type="button" onClick={goToPreviousComboCup} className="dna-btn dna-btn-ghost">
                Voltar
              </button>
            ) : (
              <button type="button" onClick={closeCustomizer} className="dna-btn dna-btn-ghost">
                Cancelar
              </button>
            )}
            <button
              type="button"
              disabled={!isCustomizationValid}
              onClick={confirmCustomization}
              className="dna-btn dna-btn-primary flex-1"
            >
              {isCombo ? (isLastStep ? "Adicionar ao carrinho" : "Continuar") : "Adicionar copo"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function GroupSection({
  group,
  selectedIds,
  onToggle,
  onIncrement,
  onDecrement,
}: {
  group: ComplementGroup;
  selectedIds: string[];
  onToggle: (optionId: string) => void;
  onIncrement: (optionId: string) => void;
  onDecrement: (optionId: string) => void;
}) {
  const quantityGroup = isQuantityGroup(group);
  const badge = group.required
    ? "Obrigatório"
    : group.maxSelections
      ? `${selectedIds.length} de ${group.maxSelections}`
      : "Opcional";

  return (
    <fieldset>
      <legend className="mb-1 flex w-full items-baseline justify-between gap-4">
        <span className="dna-title text-xl">{group.title}</span>
        <span className="shrink-0 text-sm text-dna-cream/60">{badge}</span>
      </legend>
      <p className="mb-3 text-sm text-dna-cream/60">{group.description}</p>

      {quantityGroup ? (
        <ul className="grid gap-2">
          {group.options.map((option) => (
            <QuantityRow
              key={option.id}
              option={option}
              quantity={getOptionQuantity(selectedIds, option.id, true)}
              onIncrement={() => onIncrement(option.id)}
              onDecrement={() => onDecrement(option.id)}
            />
          ))}
        </ul>
      ) : (
        <div className={group.type === "single" ? "flex flex-wrap gap-2" : "grid grid-cols-2 gap-2"}>
          {group.options.map((option) => {
            const selected = selectedIds.includes(option.id);
            const blocked =
              group.type === "multiple" &&
              group.maxSelections !== undefined &&
              selectedIds.length >= group.maxSelections &&
              !selected;

            return group.type === "single" ? (
              <button
                key={option.id}
                type="button"
                className="dna-chip"
                aria-pressed={selected}
                onClick={() => onToggle(option.id)}
              >
                {option.name}
              </button>
            ) : (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                aria-disabled={blocked}
                onClick={() => onToggle(option.id)}
                className={`flex min-h-14 items-center justify-between gap-2 rounded-[1rem] border px-3 text-left font-semibold transition-colors ${
                  selected
                    ? "border-dna-cream bg-dna-cream text-dna-ink"
                    : "border-dna-cream/15 hover:border-dna-cream/40"
                } ${blocked ? "opacity-45" : ""}`}
              >
                <span className="leading-tight">{option.name}</span>
                <span className="shrink-0 text-xs opacity-70">{formatOptionPrice(option.price)}</span>
              </button>
            );
          })}
        </div>
      )}
    </fieldset>
  );
}

function QuantityRow({
  option,
  quantity,
  onIncrement,
  onDecrement,
}: {
  option: ComplementOption;
  quantity: number;
  onIncrement: () => void;
  onDecrement: () => void;
}) {
  return (
    <li
      className={`flex min-h-14 items-center justify-between gap-3 rounded-[1rem] border px-4 transition-colors ${
        quantity > 0 ? "border-dna-sprout/60 bg-dna-forest/40" : "border-dna-cream/12"
      }`}
    >
      <span>
        <span className="block font-semibold">{option.name}</span>
        <span className="text-sm text-dna-cream/60">{formatOptionPrice(option.price)} cada</span>
      </span>
      <span className="flex items-center gap-1">
        <button
          type="button"
          onClick={onDecrement}
          disabled={quantity === 0}
          aria-label={`Diminuir ${option.name}`}
          className="grid size-11 place-items-center rounded-full text-xl enabled:hover:bg-white/10 disabled:opacity-30"
        >
          −
        </button>
        <span className="w-6 text-center font-semibold tabular-nums">{quantity}</span>
        <button
          type="button"
          onClick={onIncrement}
          aria-label={`Adicionar ${option.name}`}
          className="grid size-11 place-items-center rounded-full bg-dna-cream text-xl text-dna-ink active:scale-95"
        >
          +
        </button>
      </span>
    </li>
  );
}
