import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const scriptPath = resolve(__dirname, '..', 'tools', 'benchmark-process.ps1');

describe('process benchmark sampler', () => {
  it('fails closed when the target exits during a sample', () => {
    const script = readFileSync(scriptPath, 'utf8');
    expect(script).toContain('catch [System.InvalidOperationException]');
    expect(script).toContain('catch [System.ComponentModel.Win32Exception]');
    expect(script).toContain('partial report');
  });

  it('keeps process-only sampling and the versioned report schema', () => {
    const script = readFileSync(scriptPath, 'utf8');
    expect(script).toContain('schema_version = 1');
    expect(script).toContain('working_set_avg_mb');
    expect(script).not.toMatch(/CommandLine|EnvironmentVariables|GetEnvironmentVariable/);
  });
});
