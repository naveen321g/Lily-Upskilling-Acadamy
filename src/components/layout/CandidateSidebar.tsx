import { Link, useRouterState } from "@tanstack/react-router";
import {
  Award,
  BarChart3,
  Bell,
  Gem,
  History,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MessageSquare,
  Settings,
  Sparkles,
  User,
  Wrench,
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

export function CandidateSidebar({
  onSignOut,
  isAdmin,
}: {
  onSignOut: () => void;
  isAdmin?: boolean;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link to="/" className="flex items-center gap-2 px-2 py-1.5">
          <img src={logo} alt="LUA" className="h-7 w-7 shrink-0" />
          <span className="font-display text-base font-semibold group-data-[collapsible=icon]:hidden">
            LUA
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={pathname === "/dashboard"} tooltip="Dashboard">
                  <Link to="/dashboard">
                    <LayoutDashboard /> <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActivePrefix(pathname, "/skills")}
                  tooltip="My Skills"
                >
                  <Link to="/skills">
                    <Sparkles /> <span>My Skills</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={pathname === "/assessments/history"}
                  tooltip="Verification History"
                >
                  <Link to="/assessments/history">
                    <History /> <span>Verification History</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActivePrefix(pathname, "/interview")}
                  tooltip="AI Interview"
                >
                  <Link to="/interview">
                    <MessageSquare /> <span>AI Interview</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActivePrefix(pathname, "/certificates")}
                  tooltip="Certificates"
                >
                  <Link to="/certificates">
                    <Award /> <span>Certificates</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActivePrefix(pathname, "/badges")}
                  tooltip="My Badges"
                >
                  <Link to="/badges">
                    <Gem /> <span>My Badges</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActivePrefix(pathname, "/analytics")}
                  tooltip="Analytics"
                >
                  <Link to="/analytics">
                    <BarChart3 /> <span>Analytics</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActivePrefix(pathname, "/notifications")}
                  tooltip="Notifications"
                >
                  <Link to="/notifications">
                    <Bell /> <span>Notifications</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActivePrefix(pathname, "/profile")}
                  tooltip="Profile"
                >
                  <Link to="/profile">
                    <User /> <span>Profile</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Help</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActivePrefix(pathname, "/support")}
                  tooltip="Support"
                >
                  <Link to="/support">
                    <LifeBuoy /> <span>Support</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                tooltip="This account also has employee access"
                className="text-primary hover:text-primary"
              >
                <Link to="/admin">
                  <Wrench /> <span>Admin portal</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActivePrefix(pathname, "/settings")}
              tooltip="Settings"
            >
              <Link to="/settings/notifications">
                <Settings /> <span>Settings</span>
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
