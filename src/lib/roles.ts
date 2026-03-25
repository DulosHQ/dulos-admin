export const ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: [
    'finance.read', 'finance.stats.global',
    'event.read', 'event.write',
    'project.read', 'project.manage',
    'inventory.read',
    'ticket.scan', 'ticket.checkin',
    'marketing.codes.manage',
    'team.manage',
    'sys.config', 'sys.audit',
    'access.stats',
    'order.view.list', 'ticket.read',
  ],
  OPERADOR: [
    'finance.read',
    'event.read', 'event.write',
    'project.read', 'project.manage',
    'inventory.read',
    'ticket.scan', 'ticket.checkin',
    'marketing.codes.manage',
    'access.stats',
    'order.view.list', 'ticket.read',
  ],
  PRODUCTOR: [
    'finance.read',
    'event.read',
    'project.read',
    'inventory.read',
    'access.stats',
    'order.view.list',
  ],
  TAQUILLERO: [
    'ticket.scan', 'ticket.checkin',
    'inventory.read',
    'ticket.read',
  ],
  SOPORTE: [
    'event.read',
    'ticket.read',
    'order.view.list',
  ],
};

export const DEFAULT_ROLE = 'SOPORTE';

export function normalizeRole(input?: string | null): string {
  if (!input) return DEFAULT_ROLE;
  const upper = input.toUpperCase();
  if (ROLE_PERMISSIONS[upper]) return upper;

  // Legacy aliases
  if (upper === 'MANAGER') return 'OPERADOR';
  if (upper === 'OPERATOR') return 'OPERADOR';
  if (upper === 'SUPER_ADMIN') return 'ADMIN';
  if (upper === 'ANALYST') return 'PRODUCTOR';

  return DEFAULT_ROLE;
}
