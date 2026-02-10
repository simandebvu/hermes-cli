# Security Policy

## Overview

Hermes is designed with security and safety as core principles. This document outlines our security practices and how to report vulnerabilities.

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## What Hermes Does

### Data Sent to GitHub Copilot CLI

Hermes sends the following data to GitHub Copilot CLI for AI analysis:

✅ **Sent:**
- Git repository state (branch names, commit count, tracking status)
- Git status information (clean, dirty, conflicted)
- File paths (for conflict resolution)
- User's natural language intent
- Conflicted file content (only for `hermes conflict apply`)

❌ **NOT Sent:**
- File contents (except during conflict resolution)
- Environment variables
- Secrets or credentials
- `.env` files
- Authentication tokens

### Command Execution

Hermes uses the following safety measures:

1. **Preview Before Execution**
   - All Git commands are displayed before running
   - Users can Ctrl+C to cancel anytime

2. **No Hidden Operations**
   - Every command is shown in the terminal
   - No silent background operations
   - Transparent at all times

3. **Permissions**
   - Hermes uses `--allow-all-tools` for Copilot CLI automation
   - This allows Copilot to suggest commands, but **Hermes controls execution**
   - Users always have the final say

4. **Read-Only Analysis**
   - `hermes plan` and `hermes conflict explain` are read-only
   - No changes made without explicit write commands

## Security Best Practices

### For Users

1. **Review Commands**
   - Always review Git commands before they execute
   - Use `hermes plan` for read-only analysis first

2. **Sensitive Repositories**
   - Be cautious when using `hermes conflict apply` in repositories with secrets
   - Copilot CLI will see conflicted file content

3. **Authentication**
   - Keep your GitHub Copilot CLI authentication secure
   - Use `copilot login` only on trusted machines

4. **Environment Variables**
   - Hermes does not read or transmit environment variables
   - Your credentials in `.env` files are safe

### For Developers

1. **Never Log Secrets**
   - Don't log file contents or environment variables
   - Sanitize all debug output

2. **Validate Inputs**
   - Always validate user inputs before execution
   - Sanitize branch names and file paths

3. **Error Messages**
   - Don't include sensitive data in error messages
   - Avoid exposing internal paths or configurations

4. **Dependencies**
   - Keep dependencies up to date
   - Regularly audit with `npm audit`

## Known Limitations

### What Hermes Cannot Protect Against

1. **User Confirmation Required**
   - If you approve a destructive Git command, Hermes will execute it
   - Always read the commands before proceeding

2. **Git Hooks**
   - Hermes respects all Git hooks in your repository
   - Malicious hooks can run during Git operations

3. **Repository Access**
   - Hermes requires write access to your repository
   - Run only in repositories you trust

4. **Network Security**
   - Communication with GitHub Copilot CLI uses HTTPS
   - Ensure your network connection is secure

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability in Hermes:

### Do:

1. **Email us privately** at security@hermes-git.dev (or create a private GitHub security advisory)
2. **Include details:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if available)

3. **Give us time:**
   - We aim to respond within 48 hours
   - We'll provide a timeline for fixes
   - We'll credit you in the security advisory (if desired)

### Don't:

- ❌ Publicly disclose the vulnerability before a fix is released
- ❌ Exploit the vulnerability for malicious purposes
- ❌ Test vulnerabilities on others' repositories without permission

## Security Updates

Security updates will be released as:
- **Critical:** Within 24-48 hours
- **High:** Within 1 week
- **Medium:** Within 1 month
- **Low:** In next regular release

Updates will be announced via:
- GitHub Security Advisories
- Release notes
- README badges

## Secure Defaults

Hermes ships with secure defaults:

- ✅ Read-only commands are truly read-only
- ✅ All write operations show commands first
- ✅ No automatic remote push operations
- ✅ No silent credential handling
- ✅ Minimal data sent to AI services

## Third-Party Security

### GitHub Copilot CLI

Hermes relies on GitHub Copilot CLI. Security considerations:

- **Data Processing:** Governed by [GitHub's Privacy Statement](https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement)
- **Access Control:** Requires GitHub Copilot subscription and OAuth authentication
- **Network:** All communication uses HTTPS

### Dependencies

Regular security audits of dependencies:

```bash
npm audit
npm audit fix
```

Critical vulnerabilities are patched within 48 hours.

## Compliance

### Data Handling

- **GDPR:** User data (Git metadata) is processed by GitHub Copilot under GitHub's GDPR compliance
- **No Storage:** Hermes does not store user data locally beyond Git's standard operations
- **Minimal Collection:** Only necessary repository metadata is collected

### Code Access

- **Open Source:** All code is open and auditable
- **No Telemetry:** Hermes does not send telemetry or analytics
- **Local Execution:** All Git operations run locally on your machine

## Questions?

For security-related questions:
- Read [INTEGRATION.md](INTEGRATION.md) for technical details
- Check [FAQ in README.md](README.md#faq)
- Contact security@hermes-git.dev (if set up)

## Acknowledgments

We appreciate responsible disclosure from the security community. Contributors who report valid vulnerabilities will be credited in our security advisories.

---

**Last Updated:** 2026-02-10
**Version:** 0.1.0
