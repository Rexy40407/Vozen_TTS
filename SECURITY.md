# Security Policy

## Supported versions

Vozen does not currently publish stable versioned releases. Security fixes are
made on the `main` branch and deployed to the hosted service from there.

| Version                          | Supported |
| -------------------------------- | --------- |
| Current `main` branch            | Yes       |
| Older commits and modified forks | No        |

Self-hosters should update to the latest `main` commit before reporting a
problem that may already have been fixed.

## Report a vulnerability privately

Do **not** disclose a suspected vulnerability in a public GitHub issue,
discussion, pull request, or Discord channel.

1. Join the [Vozen support server](https://discord.gg/4kYw2WUbNN).
2. Ask to speak privately with a project maintainer about a security report.
   Do not include exploit details in the public request.
3. Share the report only after the maintainer provides a private channel.

Include, where possible:

- The affected component, commit, URL, or bot command.
- The vulnerability type and potential impact.
- Reproduction steps or a minimal proof of concept.
- Any conditions required for exploitation.
- Suggested remediation, if known.
- A safe way to contact you for follow-up.

Remove tokens, credentials, personal data, and unrelated user content from the
report. If the vulnerability exposes such data, describe it without collecting
or transmitting more than is necessary to demonstrate the issue.

## What to expect

We aim to acknowledge a complete report within seven days. We will investigate,
keep the reporter informed of material progress, and coordinate disclosure after
a fix is available. Response and remediation time depend on severity and
complexity.

Please allow a reasonable remediation period before public disclosure. Reports
made in good faith that follow this policy will not be pursued merely for
identifying and reporting the vulnerability.

Vozen does not currently operate a paid bug bounty program.

## Research guidelines

Security research must not:

- Access, modify, retain, or disclose other people's data.
- Disrupt the hosted bot, website, Discord, or third-party services.
- Use social engineering, phishing, denial of service, or destructive testing.
- Go beyond the minimum access needed to demonstrate the vulnerability.

Vulnerabilities in Discord, GitHub, or another third-party dependency should
also be reported to that project's security team under its own policy.
