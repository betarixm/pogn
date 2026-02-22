export class TenantRestrictionError extends Error {
  readonly tenantId: string;

  constructor(tenantId: string) {
    super(`Login rejected: tenant ${tenantId} is not allowed`);
    this.name = "TenantRestrictionError";
    this.tenantId = tenantId;
  }
}

export const validateTenant = (tenantId: string, allowedTenantId: string): void => {
  if (tenantId !== allowedTenantId) {
    throw new TenantRestrictionError(tenantId);
  }
};
