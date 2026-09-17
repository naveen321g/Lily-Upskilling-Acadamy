import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackLink({
  to,
  label,
  params,
}: {
  to: string;
  label: string;
  params?: Record<string, string>;
}) {
  return (
    <Button variant="ghost" size="sm" className="mb-4" asChild>
      <Link to={to} params={params}>
        <ArrowLeft className="h-4 w-4" /> {label}
      </Link>
    </Button>
  );
}
