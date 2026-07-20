"use client";

import { useCallback, useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isStandaloneApp() {
  const nav = window.navigator as Navigator & { standalone?: boolean };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean(nav.standalone)
  );
}

function isIosDevice() {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const userAgent = nav.userAgent.toLowerCase();
  const isAppleTouchDesktop =
    userAgent.includes("macintosh") && navigator.maxTouchPoints > 1;

  return /iphone|ipad|ipod/.test(userAgent) || isAppleTouchDesktop;
}

export function ClientPwaInstall({
  className = "",
  noteClassName = "text-[#f8e8b5]/86 md:text-right",
}: {
  className?: string;
  noteClassName?: string;
}) {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      setIsInstalled(isStandaloneApp());
      setIsIos(isIosDevice());
    });

    if (!("serviceWorker" in navigator)) {
      return () => window.cancelAnimationFrame(frameId);
    }

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.log("Erro ao registrar service worker da loja", error);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, []);

  useEffect(() => {
    if (!isStandaloneApp() || window.location.pathname !== "/" || window.location.hash) {
      return;
    }

    window.setTimeout(() => {
      document.getElementById("cardapio")?.scrollIntoView({ block: "start" });
    }, 350);
  }, []);

  useEffect(() => {
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");

    const updateInstalledState = () => {
      setIsInstalled(isStandaloneApp());
    };

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setMessage("");
    };

    const handleAppInstalled = () => {
      setInstallPrompt(null);
      setIsInstalled(true);
      setMessage("");
    };

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

  const installStore = useCallback(async () => {
    if (isIos) {
      setMessage("Toque em compartilhar e depois em Adicionar à Tela de Início.");
      return;
    }

    if (!installPrompt) {
      setMessage(
        "Se a instalação não abrir, use o menu do navegador e escolha instalar app.",
      );
      return;
    }

    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;

      setInstallPrompt(null);
      setMessage(
        choice.outcome === "accepted"
          ? "Instalação iniciada."
          : "Instalação cancelada.",
      );
    } catch (error) {
      console.log("Erro ao abrir instalação da loja", error);
      setMessage("Não foi possível abrir a instalação agora.");
    }
  }, [installPrompt, isIos]);

  if (isInstalled) {
    return null;
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void installStore()}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-[8px] border border-[#d7a948]/70 bg-[#071b12]/72 px-4 py-2 text-center text-xs font-semibold uppercase tracking-[0.08em] text-[#f8e8b5] backdrop-blur transition hover:border-[#f8e8b5] hover:bg-[#103d2c] md:w-auto"
      >
        Instalar loja no celular
      </button>
      {(isIos || message) && (
        <p className={`mt-2 max-w-[18rem] text-xs font-medium leading-5 ${noteClassName}`}>
          {message || "Toque em compartilhar e depois em Adicionar à Tela de Início."}
        </p>
      )}
    </div>
  );
}
