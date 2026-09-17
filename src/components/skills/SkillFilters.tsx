import { Filter, ArrowUpDown, X } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export type FilterState = {
  status: string;
  verification: string;
  difficulty: string;
  category: string;
  sort: string;
};

export const DEFAULT_FILTERS: FilterState = {
  status: "all",
  verification: "all",
  difficulty: "all",
  category: "all",
  sort: "newest",
};

const OPTIONS = {
  status: [
    { v: "all", l: "All statuses" },
    { v: "verified", l: "Verified" },
    { v: "pending", l: "Pending" },
    { v: "failed", l: "Failed" },
    { v: "expired", l: "Expired" },
  ],
  verification: [
    { v: "all", l: "All verifications" },
    { v: "ai", l: "AI Verified" },
    { v: "expert", l: "Expert Verified" },
    { v: "certificate", l: "Certificate Verified" },
    { v: "institution", l: "Institution Verified" },
  ],
  difficulty: [
    { v: "all", l: "All levels" },
    { v: "Beginner", l: "Beginner" },
    { v: "Intermediate", l: "Intermediate" },
    { v: "Advanced", l: "Advanced" },
    { v: "Expert", l: "Expert" },
  ],
  category: [
    { v: "all", l: "All categories" },
    { v: "Cybersecurity", l: "Cybersecurity" },
    { v: "Programming", l: "Programming" },
    { v: "Cloud", l: "Cloud" },
    { v: "Networking", l: "Networking" },
    { v: "AI", l: "AI" },
    { v: "UI/UX", l: "UI/UX" },
    { v: "IoT", l: "IoT" },
    { v: "DevOps", l: "DevOps" },
    { v: "Digital Marketing", l: "Digital Marketing" },
  ],
  sort: [
    { v: "newest", l: "Newest" },
    { v: "oldest", l: "Oldest" },
    { v: "score", l: "Highest Score" },
    { v: "alpha", l: "Alphabetical" },
  ],
};

function FilterSelect({
  label,
  icon,
  value,
  onChange,
  options,
}: {
  label: string;
  icon?: React.ReactNode;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 rounded-full bg-card">
          <div className="flex items-center gap-2">
            {icon}
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.v} value={o.v}>
              {o.l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function Body({
  filters,
  setFilters,
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <FilterSelect
        label="Status"
        value={filters.status}
        onChange={(v) => setFilters({ ...filters, status: v })}
        options={OPTIONS.status}
      />
      <FilterSelect
        label="Verification"
        value={filters.verification}
        onChange={(v) => setFilters({ ...filters, verification: v })}
        options={OPTIONS.verification}
      />
      <FilterSelect
        label="Difficulty"
        value={filters.difficulty}
        onChange={(v) => setFilters({ ...filters, difficulty: v })}
        options={OPTIONS.difficulty}
      />
      <FilterSelect
        label="Category"
        value={filters.category}
        onChange={(v) => setFilters({ ...filters, category: v })}
        options={OPTIONS.category}
      />
      <FilterSelect
        label="Sort"
        icon={<ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />}
        value={filters.sort}
        onChange={(v) => setFilters({ ...filters, sort: v })}
        options={OPTIONS.sort}
      />
    </div>
  );
}

export function SkillFilters({
  filters,
  setFilters,
}: {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
}) {
  const dirty =
    filters.status !== "all" ||
    filters.verification !== "all" ||
    filters.difficulty !== "all" ||
    filters.category !== "all" ||
    filters.sort !== "newest";

  return (
    <div className="rounded-3xl border border-border/70 bg-card/60 p-4 shadow-soft sm:p-6">
      {/* Desktop */}
      <div className="hidden lg:block">
        <Body filters={filters} setFilters={setFilters} />
      </div>

      {/* Mobile / Tablet trigger */}
      <div className="flex items-center justify-between gap-2 lg:hidden">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2 rounded-full">
              <Filter className="h-4 w-4" />
              Filters {dirty && <span className="h-2 w-2 rounded-full bg-primary" />}
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>Filter skills</SheetTitle>
              <SheetDescription>Refine your skill list by status, verification, and more.</SheetDescription>
            </SheetHeader>
            <div className="mt-6">
              <Body filters={filters} setFilters={setFilters} />
            </div>
          </SheetContent>
        </Sheet>

        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            <X className="h-4 w-4" /> Reset
          </Button>
        )}
      </div>

      {dirty && (
        <div className="mt-4 hidden justify-end lg:flex">
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 text-muted-foreground"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            <X className="h-4 w-4" /> Reset filters
          </Button>
        </div>
      )}
    </div>
  );
}
