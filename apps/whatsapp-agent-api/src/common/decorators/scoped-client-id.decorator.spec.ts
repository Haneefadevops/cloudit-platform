import { ForbiddenException } from '@nestjs/common';
import { resolveScopedClientId } from './scoped-client-id.decorator';

describe('resolveScopedClientId', () => {
  it('staff admin gets the route param clientId', () => {
    expect(
      resolveScopedClientId(
        { role: 'admin' },
        { clientId: 'client-from-param' },
      ),
    ).toBe('client-from-param');
  });

  it('staff supervisor gets the route param clientId', () => {
    expect(
      resolveScopedClientId(
        { role: 'supervisor' },
        { clientId: 'client-from-param' },
      ),
    ).toBe('client-from-param');
  });

  it('portal user always gets their own clientId, ignoring the param', () => {
    expect(
      resolveScopedClientId(
        { role: 'client_admin', clientId: 'own-client' },
        { clientId: 'someone-elses-client' },
      ),
    ).toBe('own-client');
  });

  it('portal staff role is also scoped to their own client', () => {
    expect(
      resolveScopedClientId(
        { role: 'client_staff', clientId: 'own-client' },
        { clientId: 'someone-elses-client' },
      ),
    ).toBe('own-client');
  });

  it('rejects non-staff users without a clientId', () => {
    expect(() => resolveScopedClientId({ role: 'agent' }, {})).toThrow(
      ForbiddenException,
    );
  });

  it('rejects requests with no authenticated user', () => {
    expect(() =>
      resolveScopedClientId(undefined, { clientId: 'x' }),
    ).toThrow(ForbiddenException);
  });
});
