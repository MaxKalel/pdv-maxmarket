import { useEffect, type ReactNode } from "react";

/** Janela modal operada por teclado. Esc sempre fecha. */
export function Janela({ titulo, onFechar, children, largura = "max-w-xl" }: {
  titulo: string; onFechar: () => void; children: ReactNode; largura?: string;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); onFechar(); }
    };
    window.addEventListener("keydown", h, true);
    return () => window.removeEventListener("keydown", h, true);
  }, [onFechar]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/50 p-4 backdrop-blur-sm">
      <div className={`w-full ${largura} rounded-xl border-2 border-foreground bg-card shadow-2xl animate-in zoom-in-95 fade-in duration-150`}>
        <div className="flex items-center justify-between border-b-2 border-foreground px-6 py-3">
          <h2 className="text-xl font-bold uppercase tracking-wide">{titulo}</h2>
          <span className="kbd">Esc fecha</span>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
