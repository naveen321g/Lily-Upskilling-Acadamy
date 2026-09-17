import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { User } from "lucide-react";
import { toast } from "sonner";

import { DashboardChrome } from "@/components/layout/DashboardChrome";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { PageHeader } from "@/components/shared/PageHeader";
import { LoadingSkeleton } from "@/components/shared/LoadingSkeleton";
import { ErrorState } from "@/components/shared/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [{ title: "Profile — LUA" }, { name: "robots", content: "noindex" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");

  const {
    data: profile,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ["my-profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
  });

  const { data: roles } = useQuery({
    queryKey: ["my-roles", user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => r.role as string);
    },
  });

  useEffect(() => {
    if (profile?.full_name) setFullName(profile.full_name);
  }, [profile?.full_name]);

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: name })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast.success("Profile updated.");
      queryClient.invalidateQueries({ queryKey: ["my-profile", user.id] });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : "Could not update profile."),
  });

  const extraRoles = (roles ?? []).filter((r) => r !== "candidate");

  return (
    <DashboardChrome>
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-12 lg:px-8">
        <Breadcrumbs items={[{ label: "Dashboard", to: "/dashboard" }, { label: "Profile" }]} />
        <PageHeader
          eyebrow="Account"
          title="Profile"
          subtitle="Your name shown across LUA and your Bustler profile."
        />

        {isLoading ? (
          <LoadingSkeleton className="mt-8 h-64" />
        ) : isError ? (
          <div className="mt-8">
            <ErrorState
              title="Couldn't load your profile"
              description="Please try again."
              onRetry={() => refetch()}
            />
          </div>
        ) : (
          <div className="mt-8 rounded-3xl border border-border/70 bg-card p-6 shadow-soft sm:p-8">
            <div className="flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-soft">
                <User className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold text-foreground">{fullName || user.email}</p>
                <p className="text-xs text-muted-foreground">
                  Member since {formatDate(profile?.created_at) ?? "—"}
                </p>
              </div>
            </div>

            {extraRoles.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {extraRoles.map((r) => (
                  <span
                    key={r}
                    className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary"
                  >
                    {r}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-6 space-y-4 border-t border-border/60 pt-6">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={user.email ?? ""} disabled readOnly />
                <p className="text-xs text-muted-foreground">
                  Managed by your Bustler account sign-in — can't be changed here.
                </p>
              </div>
              <Button
                onClick={() => saveMutation.mutate(fullName.trim())}
                disabled={saveMutation.isPending || !fullName.trim()}
              >
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </div>
        )}
      </main>
    </DashboardChrome>
  );
}
