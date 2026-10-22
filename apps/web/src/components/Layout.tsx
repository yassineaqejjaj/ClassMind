import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  GraduationCap,
  Home,
  Library,
  LogOut,
  Network,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { NavLink, Outlet } from "react-router-dom";
import { api } from "@/services/api";
import { userManager } from "@/services/auth";
import { LogoMark } from "./Logo";

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: "/", label: "Tableau de bord", icon: Home, end: true },
  { to: "/classes", label: "Mes classes", icon: GraduationCap },
  { to: "/competences", label: "Compétences", icon: Network },
  { to: "/exercices/nouveau", label: "Studio IA", icon: Sparkles },
  { to: "/bibliotheque", label: "Bibliothèque", icon: Library },
];

export function useCurrentUser() {
  return useQuery({
    queryKey: ["oidc-user"],
    queryFn: async () => {
      const p = (await userManager.getUser())?.profile;
      const name = p?.name ?? p?.preferred_username ?? "";
      const first = (p?.given_name as string | undefined) ?? name.split(" ")[0];
      const initials = name
        .split(/[\s.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0].toUpperCase())
        .join("");
      return { name, first, initials: initials || "?" };
    },
    staleTime: Infinity,
  });
}

export default function Layout() {
  const user = useCurrentUser();
  const settings = useQuery({ queryKey: ["settings"], queryFn: api.settings });
  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-xl focus:bg-white focus:p-3"
      >
        Aller au contenu
      </a>
      <nav
        aria-label="Navigation principale"
        className="flex flex-col gap-1 bg-ink px-3.5 py-5 md:sticky md:top-0 md:h-screen md:w-[248px] md:shrink-0"
      >
        <NavLink
          to="/"
          aria-label="ClassMind, accueil"
          className="flex items-center gap-3 px-3 pb-4 pt-1 md:pb-6"
        >
          <LogoMark />
          <span className="text-xl font-bold tracking-tight text-white">ClassMind</span>
        </NavLink>
        <div className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="nav-item whitespace-nowrap">
              <Icon size={20} aria-hidden="true" /> {label}
            </NavLink>
          ))}
        </div>
        <div className="hidden flex-1 md:block" />
        <div className="mt-2 flex gap-1 md:flex-col">
          <NavLink to="/parametres" className="nav-item">
            <Settings size={20} aria-hidden="true" /> Paramètres
          </NavLink>
          <button
            onClick={() => userManager.signoutRedirect()}
            className="nav-item w-full text-left"
          >
            <LogOut size={20} aria-hidden="true" /> Déconnexion
          </button>
        </div>
        <div className="mt-2 hidden items-center gap-3 border-t border-white/10 px-3 pt-4 md:flex">
          <div
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-dark text-[13px] font-semibold text-white"
          >
            {user.data?.initials}
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-white">{user.data?.name}</span>
            <span className="truncate text-xs text-[#A5B4D4]">{settings.data?.establishment}</span>
          </div>
        </div>
      </nav>
      <main id="contenu" className="min-w-0 flex-1 px-5 py-8 md:px-10 md:pb-14">
        <Outlet />
        <p className="mt-12 flex items-center gap-2 text-xs text-muted">
          <BookOpen size={14} aria-hidden="true" />
          Les analyses sont des aides à la décision : l'enseignant reste responsable des choix
          pédagogiques.
        </p>
      </main>
    </div>
  );
}
