import type { ReactNode } from "react";

export function PageHeader({ title, eyebrow, children, actions }: {
  title: ReactNode; eyebrow?: ReactNode; children?: ReactNode; actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end gap-4">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="mb-1 font-mono text-xs font-semibold uppercase tracking-[0.14em] text-accent">{eyebrow}</p>}
        <h1 className="title-gradient text-balance text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {children && <div className="mt-2 text-[15px] text-muted">{children}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
