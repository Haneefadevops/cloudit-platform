/**
 * Deterministic sanitization for untrusted text, per the operator plan:
 * strip control characters, HTML, URLs (except an explicit allowlist),
 * email addresses and token-like long alphanumeric strings.
 *
 * Sanitization is defense in depth: the primary control is the untrusted
 * label from `./label`, which keeps sanitized text out of any instruction
 * channel. This module additionally removes transport and secret-shaped
 * content so sanitized text is safe to log, store or render.
 */
import { SecurityError } from './errors';
import { isUntrustedText, type UntrustedText } from './label';

export const DEFAULT_REPLACEMENT = '[redacted]';

export interface SanitizeOptions {
  /**
   * URLs that survive sanitization. An entry matches either exactly or as a
   * string prefix (use a trailing `/` or `:` to scope an origin). An empty
   * or omitted allowlist strips every URL.
   */
  readonly urlAllowlist?: readonly string[];
  /** Replacement marker for stripped content. Defaults to `[redacted]`. */
  readonly replacement?: string;
}

// C0/C1 control characters except tab and newline (readable formatting is
// preserved), plus invisible format characters used for obfuscation:
// zero-width space/joiners, bidi overrides, word joiner, BOM.
const CONTROL_CHARS =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const ACTIVE_HTML_BLOCK = /<(script|style|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
const HTML_COMMENT = /<!--[\s\S]*?-->/g;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;
const URL_PATTERN = /\b(?:https?:\/\/|www\.)[^\s<>"')\]]+/gi;
const EMAIL_PATTERN = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// Long token-like runs: >= 20 chars of [A-Za-z0-9_-] containing at least one
// letter and one digit.
const TOKEN_PATTERN = /\b(?=[A-Za-z0-9_-]*[A-Za-z])(?=[A-Za-z0-9_-]*\d)[A-Za-z0-9_-]{20,}\b/g;
// Well-known secret shapes (AWS access key id, Slack token, GitHub token,
// Google API key). All fixture canaries use obviously-fake values.
const KNOWN_SECRET_SHAPES: readonly RegExp[] = [
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  /\bxox[bapors]-[A-Za-z0-9-]{8,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/g,
  /\bAIza[0-9A-Za-z_-]{20,}\b/g,
];

function unwrap(input: string | UntrustedText): string {
  if (typeof input === 'string') return input;
  if (isUntrustedText(input)) return input.value;
  throw new SecurityError(
    'SECURITY_ERR_INVALID_INPUT',
    'sanitizeSafeText expects a string or UntrustedText',
  );
}

function isAllowlisted(url: string, allowlist: readonly string[]): boolean {
  const trimmed = url.replace(/[.,;!?]+$/, '');
  return allowlist.some((entry) => {
    const scope = entry.trim();
    return scope.length > 0 && (trimmed === scope || trimmed.startsWith(scope));
  });
}

/**
 * Return a sanitized copy of the input. Never throws on string input; any
 * string is reducible to inert text. Non-string input throws a typed
 * {@link SecurityError} (fail-closed).
 */
export function sanitizeSafeText(input: string | UntrustedText, options: SanitizeOptions = {}): string {
  const replacement = options.replacement ?? DEFAULT_REPLACEMENT;
  const allowlist = options.urlAllowlist ?? [];

  let text = unwrap(input).normalize('NFC');
  text = text.replace(CONTROL_CHARS, '');
  text = text.replace(ACTIVE_HTML_BLOCK, replacement);
  text = text.replace(HTML_COMMENT, '');
  text = text.replace(HTML_TAG, '');
  text = text.replace(URL_PATTERN, (match) => (isAllowlisted(match, allowlist) ? match : replacement));
  text = text.replace(EMAIL_PATTERN, replacement);
  for (const shape of KNOWN_SECRET_SHAPES) {
    text = text.replace(shape, replacement);
  }
  text = text.replace(TOKEN_PATTERN, replacement);
  return text;
}
