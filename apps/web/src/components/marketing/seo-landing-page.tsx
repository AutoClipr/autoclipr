import Link from "next/link";
import { MarketingHero } from "@/components/marketing/marketing-hero";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { CTA } from "@/components/landing/cta";
import type { LandingPage } from "@/lib/landing-pages";

export function SeoLandingPage({ page }: { page: LandingPage }) {
  return (
    <>
      <div className="relative isolate">
        <MarketingHero label="AutoClipr for creators" title={page.h1} description={page.subtitle}>
          <Button variant="gradient" size="lg" className="mt-10" asChild>
            <Link href="/register">
              {page.heroCta}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </MarketingHero>
      </div>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
          {page.benefits.map((b) => (
            <div key={b.title} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 backdrop-blur transition-all hover:-translate-y-0.5 hover:border-white/20">
              <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-400/25 bg-emerald-500/15">
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              </span>
              <h2 className="text-lg font-bold text-white">{b.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{b.body}</p>
            </div>
          ))}
        </div>
      </section>

      {page.comparison && (
        <section className="px-4 py-16 sm:px-6">
          <div className="mx-auto max-w-4xl">
            <p className="section-label-white mx-auto mb-4 flex w-fit">Side by side</p>
            <h2 className="text-center text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
              AutoClipr vs {page.comparison.competitor}
            </h2>
            <div className="mt-10 overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-white">
                    <th className="p-4 font-semibold">Feature</th>
                    <th className="p-4 font-semibold text-emerald-300">AutoClipr</th>
                    <th className="p-4 font-semibold">{page.comparison.competitor}</th>
                  </tr>
                </thead>
                <tbody>
                  {page.comparison.rows.map((row) => (
                    <tr key={row.feature} className="border-b border-white/[0.06] last:border-0">
                      <td className="p-4 font-medium text-white/80">{row.feature}</td>
                      <td className="p-4 text-white/70">{row.autoclipr}</td>
                      <td className="p-4 text-white/50">{row.competitor}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-center text-xs text-white/35">{page.comparison.note}</p>
          </div>
        </section>
      )}

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="section-label-white mx-auto mb-4 flex w-fit">How it works</p>
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Three steps to your first clips</h2>
          <ol className="mt-12 space-y-4">
            {page.steps.map((step, i) => (
              <li key={step.title} className="flex gap-5 rounded-3xl border border-white/10 bg-white/[0.03] p-5 backdrop-blur">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-black shadow-[0_0_20px_-6px_rgba(255,255,255,0.6)]">
                  {i + 1}
                </span>
                <div>
                  <h3 className="text-lg font-bold text-white">{step.title}</h3>
                  <p className="mt-1 text-white/55">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="section-label-white mx-auto mb-4 flex w-fit">FAQ</p>
          <h2 className="text-center text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Questions, answered</h2>
          <Accordion type="single" collapsible className="mt-10">
            {page.faq.map((item, i) => (
              <AccordionItem key={item.q} value={`faq-${i}`} className="mb-3 rounded-2xl border border-white/10 bg-white/[0.03] px-5 backdrop-blur">
                <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
                <AccordionContent className="text-white/55">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <CTA />
    </>
  );
}
