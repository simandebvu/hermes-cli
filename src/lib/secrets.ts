import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ─── Types ──────────────────────────────────────────────────────────────────

export type Severity = 'blocked' | 'warn';

export interface SecretPattern {
  id: string;
  description: string;
  severity: Severity;
  pattern: RegExp;
  rotation?: string; // where to rotate/revoke the key
}

export interface Finding {
  patternId: string;
  description: string;
  severity: Severity;
  line: number;
  preview: string; // masked snippet for display
  rotation?: string;
}

export interface FileFindings {
  file: string;
  findings: Finding[];
  maxSeverity: Severity;
}

export interface ScanResult {
  blocked: FileFindings[];
  warned: FileFindings[];
  clean: string[];
  skipped: string[]; // binary files etc
}

// ─── Filename blocklist ──────────────────────────────────────────────────────

const BLOCKED_FILENAMES: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /^\.env$/, description: 'Environment variable file' },
  { pattern: /^\.env\..+/, description: 'Environment variable file' },
  { pattern: /id_rsa$/, description: 'SSH private key' },
  { pattern: /id_ed25519$/, description: 'SSH private key' },
  { pattern: /id_ecdsa$/, description: 'SSH private key' },
  { pattern: /id_dsa$/, description: 'SSH private key' },
  { pattern: /\.pem$/, description: 'PEM certificate/key file' },
  { pattern: /\.p12$/, description: 'PKCS#12 certificate file' },
  { pattern: /\.pfx$/, description: 'PKCS#12 certificate file' },
  { pattern: /\.jks$/, description: 'Java keystore file' },
  { pattern: /\.keystore$/, description: 'Keystore file' },
  { pattern: /credentials\.json$/, description: 'Credentials file' },
  { pattern: /google-services\.json$/, description: 'Google services config (may contain API keys)' },
  { pattern: /firebase-adminsdk.*\.json$/, description: 'Firebase admin SDK credentials' },
  { pattern: /serviceAccountKey.*\.json$/, description: 'Service account credentials' },
  { pattern: /\.netrc$/, description: '.netrc credentials file' },
];

const WARNED_FILENAMES: Array<{ pattern: RegExp; description: string }> = [
  { pattern: /\.npmrc$/, description: '.npmrc (may contain auth tokens)' },
  { pattern: /\.pypirc$/, description: '.pypirc (may contain PyPI token)' },
  { pattern: /secrets?\.(json|yaml|yml|toml)$/, description: 'Secrets config file' },
  { pattern: /config\.(local|private|secret)\.(json|yaml|yml|toml|js|ts)$/, description: 'Local/private config file' },
  { pattern: /private.*\.(json|yaml|yml|toml)$/, description: 'Private config file' },
];

// ─── Content patterns ─────────────────────────────────────────────────────────

const SECRET_PATTERNS: SecretPattern[] = [
  // Private keys
  {
    id: 'private-key',
    description: 'Private key header',
    severity: 'blocked',
    pattern: /-----BEGIN\s+(RSA\s+|EC\s+|OPENSSH\s+|DSA\s+)?PRIVATE KEY-----/,
  },

  // Anthropic
  {
    id: 'anthropic-key',
    description: 'Anthropic API key',
    severity: 'blocked',
    pattern: /sk-ant-[a-zA-Z0-9_-]{80,}/,
    rotation: 'https://console.anthropic.com/settings/keys',
  },

  // OpenAI
  {
    id: 'openai-key',
    description: 'OpenAI API key',
    severity: 'blocked',
    pattern: /sk-(?:proj-)?[a-zA-Z0-9]{40,}/,
    rotation: 'https://platform.openai.com/api-keys',
  },

  // Google / GCP
  {
    id: 'google-api-key',
    description: 'Google API key',
    severity: 'blocked',
    pattern: /AIza[a-zA-Z0-9_-]{35}/,
    rotation: 'https://console.cloud.google.com/apis/credentials',
  },

  // AWS
  {
    id: 'aws-access-key',
    description: 'AWS access key ID',
    severity: 'blocked',
    pattern: /AKIA[A-Z0-9]{16}/,
    rotation: 'https://console.aws.amazon.com/iam/home#/security_credentials',
  },
  {
    id: 'aws-secret-key',
    description: 'AWS secret access key',
    severity: 'blocked',
    pattern: /aws[_-]?secret[_-]?access[_-]?key\s*[=:]\s*["']?[a-zA-Z0-9/+]{40}/i,
    rotation: 'https://console.aws.amazon.com/iam/home#/security_credentials',
  },

  // GitHub
  {
    id: 'github-token',
    description: 'GitHub personal access token',
    severity: 'blocked',
    pattern: /gh[pousr]_[a-zA-Z0-9]{36}/,
    rotation: 'https://github.com/settings/tokens',
  },
  {
    id: 'github-pat-v2',
    description: 'GitHub fine-grained personal access token',
    severity: 'blocked',
    pattern: /github_pat_[a-zA-Z0-9_]{82}/,
    rotation: 'https://github.com/settings/tokens',
  },

  // Stripe
  {
    id: 'stripe-key',
    description: 'Stripe secret key',
    severity: 'blocked',
    pattern: /(?:sk|rk)_live_[a-zA-Z0-9]{24,}/,
    rotation: 'https://dashboard.stripe.com/apikeys',
  },

  // SendGrid
  {
    id: 'sendgrid-key',
    description: 'SendGrid API key',
    severity: 'blocked',
    pattern: /SG\.[a-zA-Z0-9_-]{22}\.[a-zA-Z0-9_-]{43}/,
    rotation: 'https://app.sendgrid.com/settings/api_keys',
  },

  // Twilio
  {
    id: 'twilio-key',
    description: 'Twilio API key',
    severity: 'blocked',
    pattern: /SK[a-f0-9]{32}/,
    rotation: 'https://www.twilio.com/console/project/api-keys',
  },

  // Database URLs with embedded credentials
  {
    id: 'db-url',
    description: 'Database URL with credentials',
    severity: 'blocked',
    pattern: /(?:mongodb(?:\+srv)?|postgres(?:ql)?|mysql|redis):\/\/[^:/?#\s]+:[^@\s]+@/,
  },

  // Generic high-entropy assignments (warn)
  {
    id: 'password-assignment',
    description: 'Hardcoded password',
    severity: 'warn',
    pattern: /(?:password|passwd|pwd)\s*[=:]\s*["'][^"']{6,}["']/i,
  },
  {
    id: 'secret-assignment',
    description: 'Hardcoded secret',
    severity: 'warn',
    pattern: /(?:secret|api_secret|client_secret)\s*[=:]\s*["'][^"']{8,}["']/i,
  },
  {
    id: 'token-assignment',
    description: 'Hardcoded token',
    severity: 'warn',
    pattern: /(?<![a-z])token\s*[=:]\s*["'][a-zA-Z0-9_\-\.]{16,}["']/i,
  },
];

// ─── Scanning ────────────────────────────────────────────────────────────────

/**
 * Get the list of files staged for commit (added/modified/renamed, not deleted).
 */
export async function getStagedFiles(): Promise<string[]> {
  const { stdout } = await execAsync(
    'git diff --cached --name-only --diff-filter=ACMR'
  );
  return stdout.trim().split('\n').filter(Boolean);
}

/**
 * Read the staged (index) version of a file.
 */
async function readStagedFile(file: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync(`git show ":${file}"`, {
      maxBuffer: 2 * 1024 * 1024, // 2MB limit
    });
    return stdout;
  } catch {
    return null; // binary or unreadable
  }
}

/**
 * Check a filename against blocked/warned filename patterns.
 */
function checkFilename(file: string): Finding | null {
  const basename = file.split('/').pop() || file;

  for (const { pattern, description } of BLOCKED_FILENAMES) {
    if (pattern.test(basename)) {
      return {
        patternId: 'filename-blocked',
        description: `Sensitive filename: ${description}`,
        severity: 'blocked',
        line: 0,
        preview: file,
      };
    }
  }

  for (const { pattern, description } of WARNED_FILENAMES) {
    if (pattern.test(basename)) {
      return {
        patternId: 'filename-warned',
        description: `Potentially sensitive filename: ${description}`,
        severity: 'warn',
        line: 0,
        preview: file,
      };
    }
  }

  return null;
}

/**
 * Scan file content line by line for secret patterns.
 */
function scanContent(content: string): Finding[] {
  const lines = content.split('\n');
  const findings: Finding[] = [];
  const seen = new Set<string>(); // deduplicate same pattern on multiple lines

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const sp of SECRET_PATTERNS) {
      if (sp.pattern.test(line)) {
        const dedupeKey = `${sp.id}:${i}`;
        if (seen.has(dedupeKey)) continue;
        seen.add(dedupeKey);

        findings.push({
          patternId: sp.id,
          description: sp.description,
          severity: sp.severity,
          line: i + 1,
          preview: redactLine(line, sp.pattern),
          rotation: sp.rotation,
        });
      }
    }
  }

  return findings;
}

/**
 * Replace the matched secret value with asterisks, keeping surrounding context.
 */
function redactLine(line: string, pattern: RegExp): string {
  const redacted = line.replace(pattern, (match) => {
    if (match.length <= 8) return '****';
    return match.slice(0, 4) + '...' + match.slice(-4).replace(/./g, '*');
  });
  // Trim long lines
  return redacted.length > 120 ? redacted.slice(0, 117) + '...' : redacted;
}

/**
 * Scan all staged files. Returns a structured result.
 */
export async function scanStagedFiles(): Promise<ScanResult> {
  const files = await getStagedFiles();
  const result: ScanResult = { blocked: [], warned: [], clean: [], skipped: [] };

  await Promise.all(
    files.map(async (file) => {
      const allFindings: Finding[] = [];

      // Filename check
      const filenameFindig = checkFilename(file);
      if (filenameFindig) allFindings.push(filenameFindig);

      // Content check (only if not already fully blocked by filename)
      const content = await readStagedFile(file);
      if (content === null) {
        result.skipped.push(file);
        return;
      }
      allFindings.push(...scanContent(content));

      if (allFindings.length === 0) {
        result.clean.push(file);
        return;
      }

      const maxSeverity: Severity = allFindings.some((f) => f.severity === 'blocked')
        ? 'blocked'
        : 'warn';

      const fileFindings: FileFindings = { file, findings: allFindings, maxSeverity };

      if (maxSeverity === 'blocked') {
        result.blocked.push(fileFindings);
      } else {
        result.warned.push(fileFindings);
      }
    })
  );

  return result;
}
