"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { Toast } from "./ui";

type ShowToast = (message: string) => void;

const ToastContext = createContext<ShowToast>(() => {});

export function useToast(): ShowToast {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string; id: number } | null>(null);

  const show = useCallback((message: string) => {
    setState((prev) => ({ message, id: (prev?.id ?? 0) + 1 }));
  }, []);

  const dismiss = useCallback(() => setState(null), []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast key={state?.id} message={state?.message ?? ""} visible={state !== null} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}
