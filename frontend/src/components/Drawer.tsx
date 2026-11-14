import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/** Выдвижная панель справа (диалог): Esc и клик по фону закрывают, фокус возвращается на место. */
export function Drawer({ open, onClose, title, eyebrow, children }: {
  open: boolean; onClose: () => void; title: string; eyebrow?: string; children: ReactNode;
}) {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const restore = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div aria-hidden className="drawer-backdrop absolute inset-0 bg-black/55 backdrop-blur-sm" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-labelledby="drawer-title"
        className="drawer-panel absolute inset-y-0 right-0 flex w-full max-w-xl flex-col border-l border-white/10 bg-[#0c1018]/95 shadow-2xl backdrop-blur-xl">
        <div className="flex items-start gap-3 border-b border-white/5 px-5 py-4">
          <div className="min-w-0 flex-1">
            {eyebrow && <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-accent">{eyebrow}</p>}
            <h2 id="drawer-title" className="text-xl font-semibold tracking-tight">{title}</h2>
          </div>
          <button ref={closeBtn} type="button" onClick={onClose} aria-label="Закрыть"
            className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-muted transition-colors hover:border-white/25 hover:text-fg">
            <X aria-hidden className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
}
