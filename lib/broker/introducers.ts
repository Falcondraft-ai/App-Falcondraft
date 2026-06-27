import type { BrokerIntroducerRow } from "@/types/database";

/**
 * Retrocession owed for a commission, given a rate (%). Returns null when there
 * is nothing to compute (no amount, or no/zero rate), rounded to the cent.
 */
export function computeRetrocession(
  commissionAmount: number | null | undefined,
  rate: number | null | undefined,
): number | null {
  if (commissionAmount == null || !Number.isFinite(commissionAmount)) {
    return null;
  }
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  return Math.round(commissionAmount * (rate / 100) * 100) / 100;
}

export type IntroducerLite = {
  id: string;
  name: string;
  rate: number | null;
};

export type ResolvedRetrocession = {
  introducer_id: string | null;
  retrocession_rate: number | null;
  retrocession_amount: number | null;
  retrocession_beneficiary: string | null;
};

/**
 * Resolves the retrocession fields of a commission line. When the client has an
 * introducer, the line is linked to it (so it shows up in the introducer's
 * relevé) and — unless an amount was entered by hand — the retrocession is
 * computed from the introducer's default rate.
 */
export function resolveRetrocession(input: {
  commissionAmount: number | null;
  retrocessionAmount: number | null;
  retrocessionRate: number | null;
  retrocessionBeneficiary: string | null;
  introducer: IntroducerLite | null;
}): ResolvedRetrocession {
  const intro = input.introducer;
  const beneficiary = input.retrocessionBeneficiary?.trim() || null;

  if (!intro) {
    return {
      introducer_id: null,
      retrocession_rate: input.retrocessionRate ?? null,
      retrocession_amount: input.retrocessionAmount ?? null,
      retrocession_beneficiary: beneficiary,
    };
  }

  const userSetAmount =
    input.retrocessionAmount != null &&
    Number.isFinite(input.retrocessionAmount);

  if (userSetAmount) {
    return {
      introducer_id: intro.id,
      retrocession_rate: input.retrocessionRate ?? intro.rate ?? null,
      retrocession_amount: input.retrocessionAmount as number,
      retrocession_beneficiary: beneficiary || intro.name,
    };
  }

  return {
    introducer_id: intro.id,
    retrocession_rate: intro.rate ?? null,
    retrocession_amount: computeRetrocession(input.commissionAmount, intro.rate),
    retrocession_beneficiary: intro.name,
  };
}

export function introducerDisplayName(
  introducer: Pick<BrokerIntroducerRow, "name">,
): string {
  return introducer.name?.trim() || "Apporteur";
}

export function formatRate(rate: number | null | undefined): string {
  if (rate == null || !Number.isFinite(rate)) return "—";
  return `${rate.toLocaleString("fr-FR", { maximumFractionDigits: 2 })} %`;
}
