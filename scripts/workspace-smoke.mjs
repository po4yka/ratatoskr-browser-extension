import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function parsePairs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!flag?.startsWith('--') || value === undefined) throw new Error(`${flag ?? 'argument'} requires a value`);
    options[flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
  }
  return options;
}

function requireOptions(options, names) {
  for (const name of names) if (typeof options[name] !== 'string' || options[name] === '') throw new Error(`--${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
}

function writeJson(path, value) {
  writeFileSync(resolve(repoRoot, path), `${JSON.stringify(value, null, 2)}\n`);
}

function validateOrigin(value) {
  const origin = new URL(value);
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(origin.hostname);
  if (origin.protocol !== 'https:' && !(origin.protocol === 'http:' && loopback)) {
    throw new Error('workspace origin must use HTTPS or loopback HTTP');
  }
  if (origin.pathname !== '/' || origin.search !== '' || origin.hash !== '') throw new Error('workspace origin must not include a path, query, or fragment');
  return origin.origin;
}

function validateWorkspace(options) {
  if (!/^[a-z0-9][a-z0-9-]{0,30}$/.test(options.namespace)) throw new Error('invalid task namespace');
  if (!['fixture', 'composed'].includes(options.kind)) throw new Error('--kind must be fixture or composed');
  const workspaceRoot = resolve(repoRoot, options.workspaceRoot);
  const profilePath = isAbsolute(options.profile) ? options.profile : join(workspaceRoot, options.profile);
  if (!existsSync(profilePath)) throw new Error(`missing workspace profile: ${options.profile}`);
  if (options.kind === 'composed') {
    const revision = execFileSync('git', ['-C', workspaceRoot, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    if (revision !== options.workspaceRevision) throw new Error(`workspace revision mismatch: observed ${revision}`);
  }
  return { profilePath, workspaceRoot };
}

async function fetchJson(origin, request) {
  const response = await fetch(`${origin}${request.path}`, { headers: { Authorization: `Bearer ${request.credential}` } });
  if (!response.ok) throw new Error(`${request.path} returned HTTP ${response.status}`);
  return response.json();
}

function packageArtifacts(releaseDir) {
  const stdout = execFileSync(process.execPath, [join(repoRoot, 'scripts/package-smoke.mjs'), '--release-dir', releaseDir], { encoding: 'utf8' });
  return JSON.parse(stdout).artifacts;
}

async function observe(options) {
  requireOptions(options, ['origin', 'syntheticCredential', 'releaseDir', 'workspaceRoot', 'workspaceRevision', 'profile', 'namespace', 'kind', 'output']);
  const origin = validateOrigin(options.origin);
  validateWorkspace(options);
  const status = await fetchJson(origin, { credential: options.syntheticCredential, path: '/v1/status' });
  if (status.state !== 'operational') throw new Error(`workspace status is ${String(status.state)}`);
  const capabilities = await fetchJson(origin, { credential: options.syntheticCredential, path: '/v1/capabilities' });
  if (!Array.isArray(capabilities.capabilities)) throw new Error('workspace capabilities response is malformed');
  const evidence = {
    artifacts: packageArtifacts(resolve(repoRoot, options.releaseDir)),
    checks: { capabilities: 'passed', packaged_targets: 'passed', public_status: 'operational' },
    kind: options.kind,
    namespace: options.namespace,
    public_origin: origin,
    status: 'observed',
    workspace: { profile: options.profile, revision: options.workspaceRevision },
  };
  writeJson(options.output, evidence);
  return evidence;
}

function finalize(options) {
  requireOptions(options, ['pending', 'teardownEvidence', 'output']);
  const pending = JSON.parse(readFileSync(resolve(repoRoot, options.pending), 'utf8'));
  const teardown = JSON.parse(readFileSync(resolve(repoRoot, options.teardownEvidence), 'utf8'));
  const passed = pending.status === 'observed' && teardown.namespace === pending.namespace && teardown.status === 'passed' && teardown.remaining_resources === 0;
  const evidence = { ...pending, status: passed ? 'passed' : 'blocked', teardown };
  writeJson(options.output, evidence);
  if (!passed) throw new Error('workspace teardown evidence is incomplete');
  return evidence;
}

let output;
try {
  const [mode, ...args] = process.argv.slice(2);
  const options = parsePairs(args);
  output = options.output;
  const result = mode === 'observe' ? await observe(options) : mode === 'finalize' ? finalize(options) : (() => { throw new Error('mode must be observe or finalize'); })();
  process.stdout.write(`${JSON.stringify({ kind: result.kind, status: result.status })}\n`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  if (typeof output === 'string' && !existsSync(resolve(repoRoot, output))) writeJson(output, { error: message, status: 'blocked' });
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
