export const TEST_ORGANIZATION_ID = 'e2e-test-organization';

export function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Organization-Id': TEST_ORGANIZATION_ID,
  };
}

export function tomorrowISO(days = 1) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}
