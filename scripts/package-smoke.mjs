import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const expectedPermissions = ['activeTab', 'alarms', 'contextMenus', 'storage'];

function parseArgs(args) {
  if (args.length !== 2 || args[0] !== '--release-dir' || args[1] === undefined) {
    throw new Error('usage: package-smoke.mjs --release-dir <path>');
  }
  return resolve(repoRoot, args[1]);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function targetFromName(name) {
  const match = /^ratatoskr-browser-extension-[0-9]+\.[0-9]+\.[0-9]+-(chromium|firefox)\.zip$/.exec(name);
  if (match?.[1] === undefined) throw new Error(`unexpected release archive name: ${name}`);
  return match[1];
}

function archivePaths(files) {
  const paths = Object.keys(files).sort();
  const unsafe = paths.find((path) => path.startsWith('/') || path.startsWith('../') || path.includes('/../') || path.includes('\\'));
  if (unsafe !== undefined) throw new Error(`unsafe archive entry: ${unsafe}`);
  const forbidden = paths.find((path) => path.endsWith('.map') || path.endsWith('.ts') || path.startsWith('node_modules/'));
  if (forbidden !== undefined) throw new Error(`forbidden release entry: ${forbidden}`);
  return paths;
}

function referencedPaths(manifest) {
  return [
    manifest.background?.service_worker,
    ...(manifest.background?.scripts ?? []),
    manifest.action?.default_popup,
    manifest.options_ui?.page,
    ...Object.values(manifest.icons ?? {}),
  ].filter((path) => typeof path === 'string');
}

function validatePermissions(target, manifest) {
  if (JSON.stringify(manifest.permissions) !== JSON.stringify(expectedPermissions)) {
    throw new Error(`${target} permission baseline changed`);
  }
  if ((manifest.host_permissions ?? []).length !== 0) throw new Error(`${target} has host permissions`);
  const csp = manifest.content_security_policy?.extension_pages;
  if (csp !== "script-src 'self'; object-src 'self'") throw new Error(`${target} CSP changed`);
}

function validateReferences(target, archive) {
  const missing = referencedPaths(archive.manifest).filter((path) => !archive.paths.includes(path));
  if (missing.length > 0) throw new Error(`${target} missing referenced files: ${missing.join(', ')}`);
}

function validateFirefoxIdentity(manifest) {
  const firefox = manifest.browser_specific_settings?.gecko;
  if (!firefox?.id || !Array.isArray(manifest.background?.scripts)) throw new Error('firefox target identity mismatch');
}

function validateChromiumIdentity(manifest) {
  if (manifest.browser_specific_settings?.gecko !== undefined) throw new Error('chromium target identity mismatch');
  if (!manifest.background?.service_worker) throw new Error('chromium target identity mismatch');
}

function validateTargetIdentity(target, manifest) {
  if (target === 'firefox') validateFirefoxIdentity(manifest);
  else validateChromiumIdentity(manifest);
}

function validateManifest(target, archive) {
  if (!archive.paths.includes('manifest.json')) throw new Error(`${target} archive has no manifest.json`);
  const manifest = JSON.parse(Buffer.from(archive.files['manifest.json']).toString('utf8'));
  if (manifest.manifest_version !== 3) throw new Error(`${target} is not Manifest V3`);
  validatePermissions(target, manifest);
  validateReferences(target, { manifest, paths: archive.paths });
  validateTargetIdentity(target, manifest);
}

function validateArchive(path) {
  const bytes = readFileSync(path);
  const name = basename(path);
  const target = targetFromName(name);
  const files = unzipSync(bytes);
  const paths = archivePaths(files);
  validateManifest(target, { files, paths });
  return { name, sha256: sha256(bytes), target };
}

function validateChecksums(releaseDir, artifacts) {
  const expected = artifacts.map(({ name, sha256: digest }) => `${digest}  ${name}`).sort().join('\n');
  const actual = readFileSync(join(releaseDir, 'SHA256SUMS'), 'utf8').trim();
  if (actual !== expected) throw new Error('SHA256SUMS does not match release archives');
}

try {
  const releaseDir = parseArgs(process.argv.slice(2));
  const names = readdirSync(releaseDir).filter((name) => name.endsWith('.zip')).sort();
  const artifacts = names.map((name) => validateArchive(join(releaseDir, name)));
  if (artifacts.map(({ target }) => target).join(',') !== 'chromium,firefox') {
    throw new Error('release must contain exactly chromium and firefox archives');
  }
  validateChecksums(releaseDir, artifacts);
  process.stdout.write(`${JSON.stringify({ artifacts, status: 'passed' })}\n`);
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
