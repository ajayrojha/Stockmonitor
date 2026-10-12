import type { Role } from '../auth/types';

// Shared by the mock database (to seed users) and the login page (to offer
// one-click demo sign-in). Remove both uses when the real API arrives.
export const DEMO_PASSWORD = 'Demo@1234';

export const DEMO_ACCOUNTS: { id: string; email: string; name: string; role: Role }[] = [
  { id: 'u-admin', email: 'admin@stockmonitor.dev', name: 'Asha Admin', role: 'admin' },
  { id: 'u-analyst', email: 'analyst@stockmonitor.dev', name: 'Arjun Analyst', role: 'analyst' },
  { id: 'u-viewer', email: 'viewer@stockmonitor.dev', name: 'Vera Viewer', role: 'viewer' },
];
