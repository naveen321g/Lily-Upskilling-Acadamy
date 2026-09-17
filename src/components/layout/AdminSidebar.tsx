import { Link, useRouterState } from "@tanstack/react-router";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  ClipboardCheck,
  FileDown,
  Gem,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  LogOut,
  Settings,
  ShieldAlert,
  Undo2,
  Users,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import logo from "@/assets/lua-logo.png";

function isActivePrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

type NavItem = { label: string; to: string; icon: React.ComponentType<{ className?: string }> };

const GROUPS: { label: string; items: NavItem[] }[] = [
  { label: "Overview", items: [{ label: "Dashboard", to: "/admin", icon: LayoutDashboard }] },
  { label: "People", items: [{ label: "Candidates", to: "/admin/users", icon: Users }] },
  {
    label: "Verification",
    items: [
      { label: "Certificates", to: "/admin/certificates", icon: Award },
      { label: "Assessments", to: "/admin/assessments", icon: ClipboardCheck },
    ],
  },
  {
    label: "Skills",
    items: [
      { label: "Skill catalog", to: "/admin/skills", icon: Layers },
      { label: "Question Bank", to: "/admin/questions", icon: BookOpen },
    ],
  },
  {
    label: "Trust & Safety",
    items: [
      { label: "Badges", to: "/admin/badges", icon: Gem },
      { label: "Fraud & Risk", to: "/admin/fraud", icon: ShieldAlert },
    ],
  },
  {
    label: "Insights",
    items: [
      { label: "Analytics", to: "/admin/analytics", icon: BarChart3 },
      { label: "Reports", to: "/admin/reports", icon: FileDown },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Notifications", to: "/admin/notifications", icon: Bell },
      { label: "Support", to: "/admin/support", icon: LifeBuoy },
    ],
  },
  { label: "Platform", items: [{ label: "Settings", to: "/admin/settings", icon: Settings }] },
];

export function AdminSidebar({ onSignOut }: { onSignOut: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <img src={logo} alt="LUA" className="h-7 w-7 shrink-0" />
          <div className="group-data-[collapsible=icon]:hidden">
            <p className="font-display text-base font-semibold leading-tight">LUA</p>
            <p className="text-[10px] font-medium uppercase tracking-wider text-primary">Admin</p>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  // "/admin" is a prefix of every other admin route, so it needs an exact match.
                  const active =
                    item.to === "/admin"
                      ? pathname === "/admin"
                      : isActivePrefix(pathname, item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                        <Link to={item.to}>
                          <Icon /> <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Back to my journey">
              <Link to="/dashboard">
                <Undo2 /> <span>Back to My Journey</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSignOut} tooltip="Sign out">
              <LogOut /> <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
