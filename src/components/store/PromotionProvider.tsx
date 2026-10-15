"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { getPromotionWindow } from "@/data/promotion";

type PromotionClock = {
  now: number;
  currentTime: () => number;
  synchronize: (serverTime: number) => void;
};
const Context = createContext<PromotionClock | null>(null);

// Um relógio compartilhado para cards, personalização, sacola e contador.
// O servidor decide a validade; estes timers curtos só atualizam a interface.
export function PromotionProvider({ initialNow, children }: { initialNow: number; children: ReactNode }) {
  const [now, setNow] = useState(initialNow);
  const anchor = useRef({ server: initialNow, monotonic: 0 });
  const currentTime = useCallback(() => anchor.current.server +
    (anchor.current.monotonic ? performance.now() - anchor.current.monotonic : 0), []);
  const synchronize = useCallback((serverTime: number) => {
    if (!Number.isFinite(serverTime)) return;
    anchor.current = { server: serverTime, monotonic: performance.now() };
    setNow(serverTime);
  }, []);

  useEffect(() => {
    let disposed = false;
    let inFlight = false;
    const controller = new AbortController();
    anchor.current = { server: initialNow, monotonic: performance.now() };
    async function sync() {
      if (inFlight) return;
      inFlight = true;
      const started = performance.now();
      try {
        const response = await fetch("/api/promotion", { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (!disposed && typeof data.serverTime === "number") {
          synchronize(data.serverTime + (performance.now() - started) / 2);
        }
      } catch {
        // Sem rede, continua a partir do último horário do servidor.
      } finally {
        inFlight = false;
      }
    }
    function resume() {
      setNow(currentTime());
      if (document.visibilityState === "visible") void sync();
    }
    void sync();
    const syncTimer = window.setInterval(() => void sync(), 60_000);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      disposed = true;
      controller.abort();
      window.clearInterval(syncTimer);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [currentTime, initialNow, synchronize]);

  useEffect(() => {
    const window = getPromotionWindow();
    const nextBoundary = [Date.parse(window.startAt), Date.parse(window.endAt)]
      .filter((time) => time > now).sort((a, b) => a - b)[0];
    const delay = Math.max(1, Math.min(30_000, (nextBoundary ?? now + 30_000) - now));
    const timer = setTimeout(() => setNow(currentTime()), delay);
    return () => clearTimeout(timer);
  }, [now, currentTime]);

  return <Context.Provider value={{ now, currentTime, synchronize }}>{children}</Context.Provider>;
}

export function usePromotionClock() {
  const context = useContext(Context);
  if (!context) throw new Error("Relógio da promoção indisponível.");
  return context;
}
