"use client";

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Comportamento de diálogo modal: foco inicial, Tab preso dentro, Escape fecha,
// trava o scroll da página e devolve o foco ao elemento que abriu.
export function useDialog(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
) {
  // Ref para que um onClose recriado a cada render não reinicie o foco.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;

    const dialog = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const first =
        dialog?.querySelector<HTMLElement>("[data-autofocus]") ??
        dialog?.querySelector<HTMLElement>(FOCUSABLE);
      first?.focus({ preventScroll: true });
    };
    const frame = requestAnimationFrame(focusFirst);

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab" || !dialog) return;

      const focusables = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null,
      );
      if (focusables.length === 0) return;

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = originalOverflow;
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [ref, open]);
}
