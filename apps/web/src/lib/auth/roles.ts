export type UserRole = 'OWNER' | 'MEMBER' | 'VIEWER' | string;

function hasWriteRole(roles: readonly UserRole[]): boolean {
  return roles.includes('OWNER') || roles.includes('MEMBER');
}

function isOwner(roles: readonly UserRole[]): boolean {
  return roles.includes('OWNER');
}

export function canUpload(roles: readonly UserRole[]): boolean {
  return hasWriteRole(roles);
}

export function canApproveSend(roles: readonly UserRole[]): boolean {
  return hasWriteRole(roles);
}

export function canManageBilling(roles: readonly UserRole[]): boolean {
  return isOwner(roles);
}

export function writeAccessReason(roles: readonly UserRole[]): string {
  if (hasWriteRole(roles)) {
    return '';
  }
  return 'Requires OWNER or MEMBER role';
}

export function billingAccessReason(roles: readonly UserRole[]): string {
  if (isOwner(roles)) {
    return '';
  }
  return 'Billing settings require OWNER role.';
}
