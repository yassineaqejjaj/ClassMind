import * as Label from "@radix-ui/react-label";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import {
  AlertTriangle,
  CheckCircle2,
  CircleDashed,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { Link } from "react-router-dom";
import { cn, LEVEL_FILL, LEVEL_LABEL } from "@/lib";

// Rayons : 12 px boutons/champs, 16 px cartes ; cibles d'au moins 44 px.
const button = cva(
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-transparent px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-brand text-white hover:bg-brand-dark",
        outline: "border-line bg-white text-ink hover:bg-slate-100",
        danger: "bg-bad text-white hover:opacity-90",
        onDark: "bg-white text-ink hover:bg-brand-soft",
        ghostDark: "border-white/40 bg-transparent text-white hover:bg-white/10",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export function Button({
  className,
  variant,
  asChild,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof button> & { asChild?: boolean }) {
  const C = asChild ? Slot : "button";
  return <C className={cn(button({ variant }), className)} {...p} />;
}

export const Card = ({
  title,
  children,
  className,
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) => (
  <section className={cn("rounded-2xl border border-line bg-white p-6 shadow-sm", className)}>
    {title && <h2 className="mb-4 text-xl font-bold">{title}</h2>}
    {children}
  </section>
);

export const inputClass =
  "min-h-[44px] w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";

export const Field = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string }
>(({ label, error, hint, id, className, ...p }, ref) => {
  const fid = id ?? `f-${label.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <div className="space-y-1">
      <Label.Root htmlFor={fid} className="block text-sm font-medium text-ink">
        {label}
      </Label.Root>
      <input
        ref={ref}
        id={fid}
        aria-invalid={!!error}
        aria-describedby={error ? `${fid}-err` : hint ? `${fid}-hint` : undefined}
        className={cn(inputClass, className)}
        {...p}
      />
      {hint && !error && (
        <p id={`${fid}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${fid}-err`} role="alert" className="text-xs text-bad">
          {error}
        </p>
      )}
    </div>
  );
});
Field.displayName = "Field";

// Chaque statut associe couleur + icône + mot, jamais la couleur seule.
const STATUS: Record<string, { text: string; tone: string; icon: LucideIcon }> = {
  acquise: { text: LEVEL_LABEL.acquise, tone: "bg-teal-soft text-teal-deep", icon: CheckCircle2 },
  en_cours: { text: LEVEL_LABEL.en_cours, tone: "bg-brand-soft text-brand-deep", icon: TrendingUp },
  à_retravailler: {
    text: LEVEL_LABEL["à_retravailler"],
    tone: "bg-amber-soft text-amber-deep",
    icon: AlertTriangle,
  },
  verified: { text: "Vérifié par calcul", tone: "bg-teal-soft text-teal-deep", icon: CheckCircle2 },
  mismatch: {
    text: "Vérification nécessaire",
    tone: "bg-amber-soft text-amber-deep",
    icon: AlertTriangle,
  },
  partial: {
    text: "Partiellement vérifié",
    tone: "bg-slate-100 text-slate-700",
    icon: CircleDashed,
  },
  unverifiable: {
    text: "Non vérifiable automatiquement",
    tone: "bg-slate-100 text-slate-700",
    icon: CircleDashed,
  },
  validated: { text: "Contenu validé", tone: "bg-teal-soft text-teal-deep", icon: CheckCircle2 },
  draft: { text: "À valider", tone: "bg-amber-soft text-amber-deep", icon: Sparkles },
  rejected: { text: "Rejeté", tone: "bg-slate-200 text-slate-700", icon: CircleDashed },
  ai: { text: "Suggestion IA", tone: "bg-brand-soft text-brand-deep", icon: Sparkles },
};
export const Badge = ({ kind }: { kind: string }) => {
  const s = STATUS[kind] ?? { text: kind, tone: "bg-slate-100 text-slate-700", icon: CircleDashed };
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold",
        s.tone,
      )}
    >
      <Icon size={14} aria-hidden="true" />
      {s.text}
    </span>
  );
};

export const ErrorBox = ({ error }: { error: unknown }) =>
  error ? (
    <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-bad">
      {(error as Error).message}
      {(error as { details?: string[] }).details && (
        <ul className="mt-1 list-disc pl-5">
          {(error as { details: string[] }).details.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      )}
    </div>
  ) : null;

export const PageTitle = ({ children, sub }: { children: ReactNode; sub?: string }) => (
  <header className="mb-8">
    <h1 className="text-3xl font-bold tracking-tight">{children}</h1>
    {sub && <p className="mt-1 text-base text-muted">{sub}</p>}
  </header>
);

export const Loading = () => (
  <p role="status" className="text-muted">
    Chargement…
  </p>
);

export const Chip = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span
    className={cn(
      "inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-ink",
      className,
    )}
  >
    {children}
  </span>
);

export const Crumbs = ({ items }: { items: ({ label: string; to?: string } | string)[] }) => (
  <nav aria-label="Fil d'Ariane" className="flex items-center gap-2 text-sm text-muted">
    {items.map((it, i) => {
      const x = typeof it === "string" ? { label: it } : it;
      return (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">/</span>}
          {x.to ? (
            <Link className="font-semibold hover:underline" to={x.to}>
              {x.label}
            </Link>
          ) : (
            <span className="font-semibold text-ink" aria-current="page">
              {x.label}
            </span>
          )}
        </span>
      );
    })}
  </nav>
);

/** Ligne « compétence · niveau · pourcentage » avec barre de progression. */
export const LevelBar = ({
  label,
  level,
  rate,
}: {
  label: string;
  level: string;
  rate: number;
}) => (
  <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-[15px] font-medium text-ink">{label}</span>
      <span className="flex items-center gap-2.5">
        <Badge kind={level} />
        <span className="min-w-[44px] text-right text-base font-bold text-ink">
          {Math.round(rate * 100)} %
        </span>
      </span>
    </div>
    <div className="h-2.5 rounded-md bg-line" role="img" aria-label={`${Math.round(rate * 100)} %`}>
      <div
        className="h-2.5 rounded-md"
        style={{ width: `${Math.round(rate * 100)}%`, background: LEVEL_FILL[level] }}
      />
    </div>
  </div>
);
