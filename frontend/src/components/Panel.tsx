import type { PropsWithChildren } from "react";

interface PanelProps extends PropsWithChildren {
  title: string;
  subtitle?: string;
}

export function Panel({ title, subtitle, children }: PanelProps) {
  return (
    <section className="rounded-[28px] border border-brand-100 bg-white p-5 shadow-panel hover:shadow-lg transition xl:p-6 2xl:p-7">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-slate-600">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}
