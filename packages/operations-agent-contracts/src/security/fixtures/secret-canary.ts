/**
 * Secret-canary fixtures: token/API-key/email/URL/private-ID/PII-shaped
 * values that are OBVIOUSLY FAKE. They are shaped like real secret classes
 * (so sanitizers must catch them) but every value carries a FAKECANARY
 * marker and no value is a real credential or tied to a real service.
 */
export const SECRET_CANARY_CATEGORIES = ['token', 'apiKey', 'email', 'url', 'privateId', 'pii'] as const;

export type SecretCanaryCategory = (typeof SECRET_CANARY_CATEGORIES)[number];

export interface SecretCanaryFixture {
  readonly id: string;
  readonly category: SecretCanaryCategory;
  /** The fake canary value that leak detection must recognize. */
  readonly value: string;
  readonly description: string;
}

export const SECRET_CANARY_FIXTURES: readonly SecretCanaryFixture[] = [
  {
    id: 'canary-token-slack-shaped',
    category: 'token',
    value: 'xoxb-fake-canary-0123456789abcdef0123',
    description: 'Slack-bot-token-shaped canary (xoxb- prefix, obviously fake body).',
  },
  {
    id: 'canary-apikey-aws-shaped',
    category: 'apiKey',
    value: 'AKIAFAKECANARY000000',
    description: 'AWS-access-key-id-shaped canary (AKIA prefix, fake body).',
  },
  {
    id: 'canary-apikey-github-shaped',
    category: 'apiKey',
    value: 'ghp_FAKECANARY0000000000000000000000000000',
    description: 'GitHub-personal-access-token-shaped canary (ghp_ prefix, fake body).',
  },
  {
    id: 'canary-email-contact',
    category: 'email',
    value: 'fake@example-canary.test',
    description: 'Contact-email-shaped canary on a reserved documentation TLD.',
  },
  {
    id: 'canary-url-callback',
    category: 'url',
    value: 'https://canary.invalid/fake-canary',
    description: 'Callback-URL canary on the reserved .invalid TLD.',
  },
  {
    id: 'canary-private-id-drive-shaped',
    category: 'privateId',
    value: 'FAKECANARY0000000000000000',
    description: 'Cloud-file-id-shaped canary (28-char opaque id, fake body).',
  },
  {
    id: 'canary-pii-email-shaped',
    category: 'pii',
    value: 'fake.pii.canary@example-canary.test',
    description: 'PII-shaped canary (personal email form, obviously fake).',
  },
];
