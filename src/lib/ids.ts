const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MOCK_JOB = /^mock_[0-9a-f-]{36}$/i;
const MOCK_OUT = /^mockout_[0-9a-f-]{36}$/i;
/** One path segment: app slug, then the deployment's job or asset UUID. */
const ROUTED = /^([a-z0-9]+(?:-[a-z0-9]+)*)~([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}

export function isMockJobId(value: string): boolean {
  return MOCK_JOB.test(value);
}

export function isMockOutputId(value: string): boolean {
  return MOCK_OUT.test(value);
}

export function newMockJobId(): string {
  return `mock_${crypto.randomUUID()}`;
}

export function newMockOutputId(): string {
  return `mockout_${crypto.randomUUID()}`;
}

/** Job and output ids the browser polls. The slug selects which deployment to call. */
export function publicRouteId(app: string, id: string): string {
  return `${app}~${id}`;
}

export function parsePublicRouteId(value: string): { app: string; id: string } | null {
  const match = ROUTED.exec(value);
  if (!match) return null;
  return { app: match[1], id: match[2] };
}
