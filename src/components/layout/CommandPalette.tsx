import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  BarChart3,
  BookOpen,
  ClipboardCheck,
  FileDown,
  Gem,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Search,
  ShieldAlert,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { listUsers } from "@/lib/users.functions";
import { listSkillsAdmin } from "@/lib/admin.functions";
import { listAllCertificatesAdmin } from "@/lib/certificate.functions";
import { listBadges } from "@/lib/badges.functions";

const DESTINATIONS = [
  { label: "Admin Dashboard", to: "/admin", icon: LayoutDashboard },
  { label: "Candidates", to: "/admin/users", icon: Users },
  { label: "Skills", to: "/admin/skills", icon: Layers },
  { label: "Question Bank", to: "/admin/questions", icon: BookOpen },
  { label: "Assessments", to: "/admin/assessments", icon: ClipboardCheck },
  { label: "Certificates", to: "/admin/certificates", icon: Award },
  { label: "Badges", to: "/admin/badges", icon: Gem },
  { label: "Fraud signals", to: "/admin/fraud", icon: ShieldAlert },
  { label: "Support center", to: "/admin/support", icon: LifeBuoy },
  { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
  { label: "Reports", to: "/admin/reports", icon: FileDown },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const fetchUsers = useServerFn(listUsers);
  const fetchSkills = useServerFn(listSkillsAdmin);
  const fetchCertificates = useServerFn(listAllCertificatesAdmin);
  const fetchBadges = useServerFn(listBadges);

  const searching = open && search.trim().length > 1;
  const q = search.trim().toLowerCase();

  const { data: candidates } = useQuery({
    queryKey: ["command-palette-users", search],
    queryFn: () => fetchUsers({ data: { search } }),
    enabled: searching,
  });
  // These admin list endpoints have no server-side search param — fetch once
  // per palette session and filter client-side, same as the static "Go to"
  // destinations above.
  const { data: allSkills } = useQuery({
    queryKey: ["command-palette-skills"],
    queryFn: () => fetchSkills(),
    enabled: searching,
  });
  const { data: allCertificates } = useQuery({
    queryKey: ["command-palette-certificates"],
    queryFn: () => fetchCertificates(),
    enabled: searching,
  });
  const { data: allBadges } = useQuery({
    queryKey: ["command-palette-badges"],
    queryFn: () => fetchBadges(),
    enabled: searching,
  });

  const matchedSkills = (allSkills ?? [])
    .filter((s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q))
    .slice(0, 6);
  const matchedCertificates = (allCertificates ?? [])
    .filter((c) => c.title.toLowerCase().includes(q) || c.holderName.toLowerCase().includes(q))
    .slice(0, 6);
  const matchedBadges = (allBadges ?? [])
    .filter((b) => b.userName.toLowerCase().includes(q) || b.skillName.toLowerCase().includes(q))
    .slice(0, 6);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function go(to: string) {
    setOpen(false);
    setSearch("");
    navigate({ to });
  }

  function goToCandidate(id: string) {
    setOpen(false);
    setSearch("");
    navigate({ to: "/admin/users/$id", params: { id } });
  }

  return (
    <>
      <Button variant="ghost" size="icon" aria-label="Search" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search users, skills, certificates, badges…"
          value={search}
          onValueChange={setSearch}
        />
        <CommandList>
          <CommandEmpty>No results.</CommandEmpty>
          <CommandGroup heading="Go to">
            {DESTINATIONS.filter((d) => d.label.toLowerCase().includes(search.toLowerCase())).map(
              (d) => {
                const Icon = d.icon;
                return (
                  <CommandItem key={d.to} value={d.label} onSelect={() => go(d.to)}>
                    <Icon /> <span>{d.label}</span>
                  </CommandItem>
                );
              },
            )}
          </CommandGroup>
          {candidates && candidates.length > 0 && (
            <CommandGroup heading="Candidates">
              {candidates.slice(0, 8).map((c) => (
                <CommandItem
                  key={c.id}
                  value={`${c.fullName ?? ""} ${c.email}`}
                  onSelect={() => goToCandidate(c.id)}
                >
                  <Users /> <span>{c.fullName ?? c.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {matchedSkills.length > 0 && (
            <CommandGroup heading="Skills">
              {matchedSkills.map((s) => (
                <CommandItem
                  key={s.id}
                  value={`skill-${s.id}`}
                  onSelect={() => go("/admin/skills")}
                >
                  <Layers /> <span>{s.name}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{s.category}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {matchedCertificates.length > 0 && (
            <CommandGroup heading="Certificates">
              {matchedCertificates.map((c) => (
                <CommandItem
                  key={c.id}
                  value={`cert-${c.id}`}
                  onSelect={() => go("/admin/certificates")}
                >
                  <Award /> <span>{c.title}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{c.holderName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {matchedBadges.length > 0 && (
            <CommandGroup heading="Badges">
              {matchedBadges.map((b) => (
                <CommandItem
                  key={b.id}
                  value={`badge-${b.id}`}
                  onSelect={() => go("/admin/badges")}
                >
                  <Gem /> <span>{b.userName}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{b.skillName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
