export type UserRole = 'OWNER' | 'MEMBER' | 'VIEWER' | string;

function hasWriteRole(roles: readonly UserRole[]): boolean {
  return roles.includes('OWNER') || roles.includes('MEMBER');
}

export function canUpload(roles: readonly UserRole[]): boolean {
  return hasWriteRole(roles);
}

export function canApproveSend(roles: readonly UserRole[]): boolean {
  return hasWriteRole(roles);
}

export function canManageBilling(roles: readonly UserRole[]): boolean {
  return hasWriteRole(roles);
}

export function writeAccessReason(roles: readonly UserRole[]): string {
  if (hasWriteRole(roles)) {
    return '';
  }
  return 'Requires OWNER or MEMBER role';
}
