"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Plans a coupon can be limited to — must match COUPON_PLANS in the API. */
export const COUPON_PLAN_OPTIONS = [
  { id: "creator", label: "Creator" },
  { id: "pro", label: "Pro" },
  { id: "business", label: "Business" },
] as const;

/**
 * Multi-select for the plans a coupon applies to.
 *
 * Native checkboxes named `name`, so a form submit carries one value per
 * selected plan — read with `form.getAll(name)`. Nothing selected means the
 * coupon applies to every plan, matching the API.
 *
 * Deliberately a <fieldset>, not wrapped in the forms' <label>-based Field:
 * checkboxes nested in a single <label> would all toggle the first one.
 */
export function PlanMultiSelect({
  name = "applicable_plans",
  defaultValue = [],
}: {
  name?: string;
  defaultValue?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(
    defaultValue.map((p) => p.toLowerCase()),
  );

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  }

  return (
    <fieldset className="block">
      <legend className="mb-1.5 block text-xs font-medium text-white/60">Plans</legend>
      <div className="flex flex-wrap gap-2">
        {COUPON_PLAN_OPTIONS.map((plan) => {
          const on = selected.includes(plan.id);
          return (
            <label
              key={plan.id}
              className={cn(
                "inline-flex cursor-pointer select-none items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors focus-within:ring-2 focus-within:ring-[#3C50E0]/50",
                on
                  ? "border-[#3C50E0] bg-[#3C50E0]/15 text-white"
                  : "border-white/10 bg-black/20 text-white/60 hover:border-white/20 hover:text-white/85",
              )}
            >
              <input
                type="checkbox"
                name={name}
                value={plan.id}
                checked={on}
                onChange={() => toggle(plan.id)}
                className="sr-only"
              />
              <span
                className={cn(
                  "flex h-4 w-4 items-center justify-center rounded border",
                  on ? "border-[#3C50E0] bg-[#3C50E0]" : "border-white/25",
                )}
                aria-hidden
              >
                {on && <Check className="h-3 w-3 text-white" />}
              </span>
              {plan.label}
            </label>
          );
        })}
      </div>
      <span className="mt-1.5 block text-[11px] text-white/35">
        {selected.length === 0 ? "None selected — applies to all plans" : "Applies only to the selected plans"}
      </span>
    </fieldset>
  );
}
