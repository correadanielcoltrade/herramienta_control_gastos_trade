interface StatCardProps {
  label: string;
  value: number;
  tone?: "brand" | "accent" | "slate";
}

const toneMap = {
  brand: "bg-gradient-to-br from-brand-50 to-brand-100 text-brand-900 border-brand-200",
  accent: "bg-gradient-to-br from-accent-50 to-accent-100 text-accent-900 border-accent-200",
  slate: "bg-slate-50 text-slate-800 border-slate-200",
};

export function StatCard({ label, value, tone = "brand" }: StatCardProps) {
  return (
    <div className={`rounded-3xl border px-5 py-5 shadow-panel hover:shadow-lg transition ${toneMap[tone]}`}>
      <p className="text-sm font-medium">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
    </div>
  );
}

