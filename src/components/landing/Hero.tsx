import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Hero() {
  return (
    <section
      id="home"
      className="relative flex min-h-screen items-center overflow-hidden bg-gradient-soft pt-24"
    >
      {/* decorative background */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ backgroundImage: "var(--gradient-radial-mint)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--gradient-brand)" }}
      />

      <div className="relative mx-auto grid w-full max-w-4xl gap-14 px-4 py-16 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut" }}
          className="flex flex-col justify-center"
        >
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-background/70 px-3 py-1 text-xs font-medium text-primary shadow-soft backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5" />
            Employer-trusted skill verification
          </span>

          <h1 className="mt-6 text-5xl font-bold leading-[1.05] tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            Verify Skills. <br />
            Build Trust. <br />
            <span className="text-gradient-brand">Unlock Careers.</span>
          </h1>

          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            Prove your practical skills through secure assessments, AI-powered evaluation, expert
            verification, and employer-recognized digital certificates.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="bg-gradient-brand text-primary-foreground shadow-glow transition-transform hover:-translate-y-0.5 hover:opacity-95"
              asChild
            >
              <Link to="/auth" search={{ tab: "signup" }}>
                Get Started
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" className="border-primary/30 hover:bg-accent" asChild>
              <a href="#skills">Explore Skills</a>
            </Button>
          </div>

          <div className="mt-10 flex items-center gap-6 text-xs text-muted-foreground">
            <div className="flex -space-x-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 w-8 rounded-full border-2 border-background bg-gradient-brand"
                  style={{ opacity: 0.4 + i * 0.15 }}
                />
              ))}
            </div>
            <p>
              <span className="font-semibold text-foreground">10,000+</span> professionals verified
              this year
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
