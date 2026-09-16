import {
  buildReportCommandCanonical,
  expectedStateForCommand,
  normalizeRejectReason,
  rejectReasonDigest,
  REPORT_RECIPIENT_POLICY_KEY,
  signReportCommandCanonical,
  verifyReportCommandAckBody,
  verifyReportCommandClaimBody,
} from './report-command-payload.util';

const secret = 'phase-10-test-secret-with-at-least-32-chars';

const fields = {
  commandKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
  commandType: 'APPROVE_AND_SEND' as const,
  reportKey: 'cavetta.monthly_maintenance.2026-09',
  clientKey: 'cavetta',
  expectedRowVersion: 7,
  expectedState: 'DRAFT',
  nonce: 'ab'.repeat(32),
  issuedAt: 1_789_430_400,
  expiresAt: 1_789_430_520,
  correlationId: '0f1e2d3c4b5a69788796a5b4c3d2e1f0',
  recipientPolicyKey: REPORT_RECIPIENT_POLICY_KEY,
  reasonDigest: '-',
};

const expectedCanonical =
  'v1\n' +
  'a1b2c3d4e5f60718293a4b5c6d7e8f90\n' +
  'APPROVE_AND_SEND\n' +
  'cavetta.monthly_maintenance.2026-09\n' +
  'cavetta\n' +
  '7\n' +
  'DRAFT\n' +
  'ab'.repeat(32) +
  '\n' +
  '1789430400\n' +
  '1789430520\n' +
  '0f1e2d3c4b5a69788796a5b4c3d2e1f0\n' +
  'cavetta-monthly-report\n' +
  '-';

describe('expectedStateForCommand', () => {
  it('maps APPROVE_AND_SEND and REJECT to DRAFT and RETRY_SEND to SEND_FAILED', () => {
    expect(expectedStateForCommand('APPROVE_AND_SEND')).toBe('DRAFT');
    expect(expectedStateForCommand('REJECT')).toBe('DRAFT');
    expect(expectedStateForCommand('RETRY_SEND')).toBe('SEND_FAILED');
  });
});

describe('normalizeRejectReason', () => {
  it('returns null for empty-ish inputs', () => {
    expect(normalizeRejectReason(undefined)).toBeNull();
    expect(normalizeRejectReason(null)).toBeNull();
    expect(normalizeRejectReason('')).toBeNull();
    expect(normalizeRejectReason('   ')).toBeNull();
    expect(
      normalizeRejectReason(
        `${String.fromCharCode(9)}${String.fromCharCode(10)}`,
      ),
    ).toBeNull();
  });

  it('rejects non-string input', () => {
    expect(() => normalizeRejectReason(42)).toThrow('Invalid request');
    expect(() => normalizeRejectReason({})).toThrow('Invalid request');
  });

  it('NFC-normalizes decomposed input', () => {
    const decomposed = 'Café'.normalize('NFD');
    expect(normalizeRejectReason(decomposed)).toBe('Café'.normalize('NFC'));
  });

  it('strips control characters from all ranges', () => {
    const input = `a${String.fromCharCode(1)}b${String.fromCharCode(31)}c${String.fromCharCode(127)}d${String.fromCharCode(159)}e`;
    expect(normalizeRejectReason(input)).toBe('abcde');
  });

  it('trims and collapses internal whitespace', () => {
    expect(normalizeRejectReason('  too   many\t words \n here  ')).toBe(
      'too many words here',
    );
  });

  it('throws when the normalized result exceeds 300 characters', () => {
    expect(() => normalizeRejectReason('x'.repeat(301))).toThrow(
      'Invalid request',
    );
    expect(normalizeRejectReason('x'.repeat(300))).toHaveLength(300);
  });
});

describe('rejectReasonDigest', () => {
  it('returns the sha256 hex digest of a normalized reason', () => {
    expect(rejectReasonDigest('Report not ready for sign-off')).toBe(
      'b3568ae6ee4dc3736dcc47812d994013a51dc60483fbc56bd8049c7c6fbe8f52',
    );
  });

  it('returns a dash for null', () => {
    expect(rejectReasonDigest(null)).toBe('-');
  });
});

describe('buildReportCommandCanonical', () => {
  it('joins exactly 13 lines in contract order', () => {
    expect(buildReportCommandCanonical(fields)).toBe(expectedCanonical);
    expect(buildReportCommandCanonical(fields).split('\n')).toHaveLength(13);
  });
});

describe('signReportCommandCanonical', () => {
  it('produces a pinned HMAC-SHA256 hex signature', () => {
    expect(signReportCommandCanonical(expectedCanonical, secret)).toBe(
      '6ac22c7ea9ee1aa584b72e0099b0a267e42c1d59e451a422f3c4abdcc9b724ba',
    );
  });

  it('changes when any canonical field is tampered', () => {
    const baseline = signReportCommandCanonical(expectedCanonical, secret);
    for (const tampered of [
      expectedCanonical.replace('APPROVE_AND_SEND', 'REJECT'),
      expectedCanonical.replace('cavetta\n', 'other-client\n'),
      expectedCanonical.replace('\n7\n', '\n8\n'),
      expectedCanonical.replace('DRAFT', 'SENT'),
      expectedCanonical.replace('1789430520', '1789430600'),
      expectedCanonical.replace('cavetta-monthly-report', '-'),
      expectedCanonical.replace(/\n-$/, '\n-other-digest'),
      `v2${expectedCanonical.slice(2)}`,
    ]) {
      expect(signReportCommandCanonical(tampered, secret)).not.toBe(baseline);
    }
  });

  it('rejects a missing or short secret', () => {
    expect(() =>
      signReportCommandCanonical(expectedCanonical, undefined),
    ).toThrow('Invalid request');
    expect(() =>
      signReportCommandCanonical(expectedCanonical, 'short'),
    ).toThrow('Invalid request');
  });

  it('does not validate expiry — that is enforced DB-side and by n8n', () => {
    const expired = buildReportCommandCanonical({
      ...fields,
      expiresAt: fields.issuedAt - 1,
    });
    expect(() => signReportCommandCanonical(expired, secret)).not.toThrow();
  });
});

describe('verifyReportCommandClaimBody', () => {
  const valid = {
    commandKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    clientKey: 'cavetta',
    nonce: 'ab'.repeat(32),
  };

  it('accepts a well-shaped body', () => {
    expect(verifyReportCommandClaimBody(valid)).toEqual(valid);
  });

  it.each([
    ['missing nonce', { ...valid, nonce: undefined }],
    ['short nonce', { ...valid, nonce: 'ab'.repeat(31) }],
    ['uppercase nonce', { ...valid, nonce: 'AB'.repeat(32) }],
    [
      'bad commandKey',
      { ...valid, commandKey: 'zz2c3d4e5f60718293a4b5c6d7e8f90' },
    ],
    ['short commandKey', { ...valid, commandKey: 'ab' }],
    ['bad clientKey', { ...valid, clientKey: '-cavetta' }],
    ['long clientKey', { ...valid, clientKey: `a${'b'.repeat(121)}` }],
    ['non-object body', 'nope'],
    ['null body', null],
  ])('rejects %s', (_label, body) => {
    expect(() => verifyReportCommandClaimBody(body)).toThrow('Invalid request');
  });
});

describe('verifyReportCommandAckBody', () => {
  const valid = {
    commandKey: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
    clientKey: 'cavetta',
    resultCode: 'acknowledged',
  };

  it('accepts every acknowledge result code', () => {
    for (const resultCode of [
      'acknowledged',
      'rejected_state',
      'rejected_stale_version',
      'rejected_pdf_unavailable',
      'rejected_recipient_policy',
      'failed_safe',
    ]) {
      expect(verifyReportCommandAckBody({ ...valid, resultCode })).toEqual({
        ...valid,
        resultCode,
      });
    }
  });

  it.each([
    ['unknown resultCode', { ...valid, resultCode: 'sent' }],
    ['resultCode of dispatched', { ...valid, resultCode: 'dispatched' }],
    ['non-string resultCode', { ...valid, resultCode: 7 }],
    ['bad commandKey', { ...valid, commandKey: 'x'.repeat(32) }],
    ['bad clientKey', { ...valid, clientKey: 'Cavetta' }],
    ['non-object body', 42],
  ])('rejects %s', (_label, body) => {
    expect(() => verifyReportCommandAckBody(body)).toThrow('Invalid request');
  });
});
