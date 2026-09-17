import { describe, expect, it } from "vitest";
import { isFullyVerifiedBustler, isSkillFullyVerified, REQUIRED_VERIFICATIONS } from "./skills-shared";

/**
 * A skill is a plain { status, verifications } shape for these tests —
 * isSkillFullyVerified/isFullyVerifiedBustler only need those two fields,
 * so real MySkillEntry objects aren't necessary here.
 */
function skill(status: string, verifications: string[]) {
  return { status, verifications };
}

describe("isSkillFullyVerified — per-skill business rule", () => {
  // TEST 1
  it("AI Verified + Certificate Verified => fully verified", () => {
    expect(isSkillFullyVerified(skill("verified", ["ai", "certificate"]))).toBe(true);
  });

  // TEST 2
  it("AI Verified + Certificate Pending (no cert badge yet) => NOT fully verified", () => {
    expect(isSkillFullyVerified(skill("verified", ["ai"]))).toBe(false);
  });

  // TEST 3
  it("AI Verified + Certificate Rejected (no cert badge) => NOT fully verified", () => {
    expect(isSkillFullyVerified(skill("verified", ["ai"]))).toBe(false);
  });

  // TEST 4
  it("AI Pending + Certificate Verified => NOT fully verified", () => {
    expect(isSkillFullyVerified(skill("pending", ["certificate"]))).toBe(false);
  });

  // TEST 5
  it("AI Verified + Certificate Missing/not submitted => NOT fully verified", () => {
    expect(isSkillFullyVerified(skill("verified", ["ai"]))).toBe(false);
  });

  it("no verifications at all => NOT fully verified", () => {
    expect(isSkillFullyVerified(skill("pending", []))).toBe(false);
  });

  it("expired skill with both verification types still on record => NOT fully verified", () => {
    // Regression case: an expired skill's verifications array may not have
    // been cleared yet — status must still win.
    expect(isSkillFullyVerified(skill("expired", ["ai", "certificate"]))).toBe(false);
  });

  it("institution verification alone does not count toward Phase 1 requirements", () => {
    expect(isSkillFullyVerified(skill("verified", ["institution"]))).toBe(false);
  });

  it("institution + ai + certificate still counts as fully verified (extra verifications don't hurt)", () => {
    expect(isSkillFullyVerified(skill("verified", ["ai", "certificate", "institution"]))).toBe(
      true,
    );
  });

  it("REQUIRED_VERIFICATIONS is exactly [ai, certificate] for Phase 1 — institution excluded", () => {
    expect(REQUIRED_VERIFICATIONS).toEqual(["ai", "certificate"]);
  });
});

describe("isFullyVerifiedBustler — profile-level business rule", () => {
  const electricianVerified = skill("verified", ["ai", "certificate"]);
  const plumbingVerified = skill("verified", ["ai", "certificate"]);
  const plumbingPendingCert = skill("verified", ["ai"]);
  const photographyNotVerified = skill("pending", []);

  // TEST 6
  it("every skill fully verified => Fully Verified Bustler = true", () => {
    expect(isFullyVerifiedBustler([electricianVerified, plumbingVerified])).toBe(true);
  });

  // TEST 7
  it("one skill not fully verified => Fully Verified Bustler = false", () => {
    expect(
      isFullyVerifiedBustler([electricianVerified, plumbingPendingCert]),
    ).toBe(false);
  });

  // TEST 8
  it("two verified + one not verified => Fully Verified Bustler = false", () => {
    expect(
      isFullyVerifiedBustler([
        electricianVerified,
        plumbingVerified,
        photographyNotVerified,
      ]),
    ).toBe(false);
  });

  // TEST 9
  it("adding a new unverified skill flips a previously-true Bustler status to false", () => {
    const before = [electricianVerified, plumbingVerified];
    expect(isFullyVerifiedBustler(before)).toBe(true);

    const afterAddingSkill = [...before, skill("pending", [])];
    expect(isFullyVerifiedBustler(afterAddingSkill)).toBe(false);
  });

  // TEST 10
  it("revoking one skill's certificate flips a previously-true Bustler status to false", () => {
    const before = [electricianVerified, skill("verified", ["ai", "certificate"])];
    expect(isFullyVerifiedBustler(before)).toBe(true);

    // Certificate badge revoked — that verification type drops off the skill.
    const afterRevocation = [electricianVerified, skill("verified", ["ai"])];
    expect(isFullyVerifiedBustler(afterRevocation)).toBe(false);
  });

  // TEST 11
  it("one verification expiring flips a previously-true Bustler status to false", () => {
    const before = [electricianVerified, skill("verified", ["ai", "certificate"])];
    expect(isFullyVerifiedBustler(before)).toBe(true);

    const afterExpiry = [electricianVerified, skill("expired", ["ai", "certificate"])];
    expect(isFullyVerifiedBustler(afterExpiry)).toBe(false);
  });

  // TEST 12
  it("removing the only unverified skill flips Bustler status back to true", () => {
    const withUnverifiedSkill = [electricianVerified, plumbingVerified, photographyNotVerified];
    expect(isFullyVerifiedBustler(withUnverifiedSkill)).toBe(false);

    const afterRemoval = [electricianVerified, plumbingVerified];
    expect(isFullyVerifiedBustler(afterRemoval)).toBe(true);
  });

  it("no skills at all => Fully Verified Bustler = false (nothing to verify isn't an achievement)", () => {
    expect(isFullyVerifiedBustler([])).toBe(false);
  });

  it("does NOT use the old 'at least one verification per skill' rule", () => {
    // Both skills have *an* active verification (ai), but neither has both
    // required types — this must be false under the corrected rule, even
    // though it would have been true under the old, incorrect one.
    const electricianAiOnly = skill("verified", ["ai"]);
    const plumbingAiOnly = skill("verified", ["ai"]);
    expect(isFullyVerifiedBustler([electricianAiOnly, plumbingAiOnly])).toBe(false);
  });
});
