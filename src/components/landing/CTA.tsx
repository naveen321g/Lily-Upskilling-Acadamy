import { motion } from "motion/react";
import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CTA() {
  return (
    <section id="cta" className="relative px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] px-6 py-20 text-center shadow-elevated sm:px-12"
        style={{ background: "var(--gradient-brand)" }}
      >
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(60% 60% at 30% 20%, oklch(0.98 0.02 175 / 0.35), transparent 70%), radial-gradient(60% 60% at 80% 80%, oklch(0.98 0.02 175 / 0.25), transparent 70%)",
          }}
        />
        <div className="relative">
          <h2 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight text-primary-foreground sm:text-5xl lg:text-6xl">
            Ready to Verify Your Skills?
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-primary-foreground/85 sm:text-lg">
            Join thousands of professionals who have earned trusted, employer-recognized skill
            certifications.
          </p>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-background text-primary shadow-glow hover:-translate-y-0.5 hover:bg-background/95"
              asChild
            >
              <Link to="/auth" search={{ tab: "signup" }}>
                Start Verification
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10"
              asChild
            >
              <a href="mailto:team@lilyhappiness.com">Talk to Sales</a>
            </Button>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
