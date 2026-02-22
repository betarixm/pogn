import { describe, test, expect } from "bun:test";
import { TenantRestrictionError, validateTenant } from "../../app/auth/errors";

const ALLOWED_TENANT = "postechackr.onmicrosoft.com";

describe("validateTenant", () => {
  test("does not throw when tenant matches", () => {
    expect(() => validateTenant(ALLOWED_TENANT, ALLOWED_TENANT)).not.toThrow();
  });

  test("throws TenantRestrictionError for a different tenant", () => {
    expect(() =>
      validateTenant("foreign.onmicrosoft.com", ALLOWED_TENANT),
    ).toThrow(TenantRestrictionError);
  });

  test("error carries the rejected tenant id", () => {
    const foreign = "attacker.onmicrosoft.com";
    let caught: unknown;
    try {
      validateTenant(foreign, ALLOWED_TENANT);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(TenantRestrictionError);
    expect((caught as TenantRestrictionError).tenantId).toBe(foreign);
  });

  test("throws for an empty tenant id", () => {
    expect(() => validateTenant("", ALLOWED_TENANT)).toThrow(
      TenantRestrictionError,
    );
  });

  test("comparison is case-sensitive", () => {
    expect(() =>
      validateTenant(ALLOWED_TENANT.toUpperCase(), ALLOWED_TENANT),
    ).toThrow(TenantRestrictionError);
  });

  test("error name is TenantRestrictionError", () => {
    let caught: unknown;
    try {
      validateTenant("other.onmicrosoft.com", ALLOWED_TENANT);
    } catch (error) {
      caught = error;
    }
    expect((caught as Error).name).toBe("TenantRestrictionError");
  });
});
