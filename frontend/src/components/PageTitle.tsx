interface PageTitleProps {
  title: string;
  description: string;
}

export function PageTitle({ title, description }: PageTitleProps) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      <p className="text-xs uppercase tracking-[0.35em] text-brand-600">Operacion</p>
      <h2 className="text-3xl font-bold text-slate-900">{title}</h2>
      <p className="max-w-3xl text-sm text-slate-600">{description}</p>
    </div>
  );
}

