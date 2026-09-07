/**
 * Business Logic & Fee Calculation Rules
 * Cutoff Date: 31-12-2026
 * Any member born on or before 31-12-2008 (or attaining 18+ years of age by 31-12-2026)
 * is flagged as an adult member (is_adult_18_plus = true).
 * Formula: total_amount = total_adults_count * 500
 */

export const CUTOFF_DATE = new Date('2026-12-31T23:59:59Z');
export const CUTOFF_BIRTH_DATE = new Date('2008-12-31T23:59:59Z');
export const FEE_PER_ADULT = 500;

export interface MemberCalculationInput {
  name: string;
  dob: string;
  is_adult_18_plus?: boolean | number;
}

/**
 * Parses DOB string which can be DD-MM-YYYY, DD/MM/YYYY, YYYY-MM-DD,
 * or simply an age number like "25" or "17".
 */
export function determineIsAdult18Plus(dobInput: string | number | undefined): boolean {
  if (!dobInput) return false;

  const inputStr = String(dobInput).trim();
  if (!inputStr) return false;

  // Case 1: Pure number representing age in years
  if (/^\d{1,3}$/.test(inputStr)) {
    const age = parseInt(inputStr, 10);
    // If age is already >= 18 as of now, or reaches 18 by 2026
    return age >= 18;
  }

  // Case 2: Date string
  let birthDate: Date | null = null;

  // Check DD-MM-YYYY or DD/MM/YYYY
  const ddmmyyyy = inputStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    birthDate = new Date(Date.UTC(year, month, day));
  } else {
    // Check YYYY-MM-DD
    const yyyymmdd = inputStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (yyyymmdd) {
      const year = parseInt(yyyymmdd[1], 10);
      const month = parseInt(yyyymmdd[2], 10) - 1;
      const day = parseInt(yyyymmdd[3], 10);
      birthDate = new Date(Date.UTC(year, month, day));
    } else {
      const parsed = new Date(inputStr);
      if (!isNaN(parsed.getTime())) {
        birthDate = parsed;
      }
    }
  }

  if (!birthDate || isNaN(birthDate.getTime())) {
    return false;
  }

  // Born on or before 31-12-2008 (<= 2008-12-31)
  return birthDate.getTime() <= CUTOFF_BIRTH_DATE.getTime();
}

/**
 * Calculates total adults and fee amount for a given list of members.
 */
export function calculateFormFees(members: MemberCalculationInput[]): {
  totalAdultsCount: number;
  totalAmount: number;
  evaluatedMembers: (MemberCalculationInput & { is_adult_18_plus: boolean })[];
} {
  let totalAdultsCount = 0;

  const evaluatedMembers = members.map((m) => {
    // If user explicitly checked 18+ or if calculated by DOB
    const isAdult = m.is_adult_18_plus === true || m.is_adult_18_plus === 1 || determineIsAdult18Plus(m.dob);
    if (isAdult) {
      totalAdultsCount++;
    }
    return {
      ...m,
      is_adult_18_plus: isAdult,
    };
  });

  const totalAmount = totalAdultsCount * FEE_PER_ADULT;

  return {
    totalAdultsCount,
    totalAmount,
    evaluatedMembers,
  };
}
