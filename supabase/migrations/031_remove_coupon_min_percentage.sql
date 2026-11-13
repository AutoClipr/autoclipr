-- Remove the 25% floor on percentage coupons; keep only the 1–100% range.
--
-- Migration 029 required percentage coupons to be at least 25%, added
-- NOT VALID to spare the existing CREATOR15 (15%). That backfired: Postgres
-- re-checks a NOT VALID constraint on every UPDATE of a row, so any change to
-- a sub-25% coupon — even pausing it — failed with
--   new row for relation "coupons" violates check constraint
--   "coupons_min_percentage"
--
-- The floor is dropped entirely (any discount from 1% to 100% is allowed).
-- The range check remains, because 0% or >100% is not a real discount and
-- Dodo would reject the mirrored discount anyway. Every existing row satisfies
-- it, so the constraint is validated immediately.

ALTER TABLE public.coupons
  DROP CONSTRAINT IF EXISTS coupons_min_percentage;

ALTER TABLE public.coupons
  ADD CONSTRAINT coupons_min_percentage
  CHECK (type <> 'percentage' OR (value >= 1 AND value <= 100));
