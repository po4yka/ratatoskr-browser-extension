import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const credentialNames = {
  chromium: ['CWS_CLIENT_ID', 'CWS_CLIENT_SECRET', 'CWS_REFRESH_TOKEN', 'CWS_PUBLISHER_ID', 'CWS_EXTENSION_ID'],
  firefox: ['WEB_EXT_API_KEY', 'WEB_EXT_API_SECRET'],
};

function applyArgument(options, input) {
  const flag = input.args[input.index];
  if (flag === '--execute' || flag === '--publish') {
    options[flag.slice(2)] = true;
    return input.index;
  }
  const valueKeys = { '--dist-dir': 'distDir', '--listing-dir': 'listingDir', '--release-dir': 'releaseDir', '--store': 'store' };
  const key = valueKeys[flag];
  if (key === undefined) throw new Error(`unknown argument: ${flag}`);
  const value = input.args[input.index + 1];
  if (value === undefined) throw new Error(`${flag} requires a value`);
  options[key] = value;
  return input.index + 1;
}

function validateOptions(options) {
  if (!['all', 'chromium', 'firefox'].includes(options.store)) throw new Error('--store must be all, chromium, or firefox');
  if (options.publish && !options.execute) throw new Error('--publish requires --execute');
  for (const key of ['distDir', 'listingDir', 'releaseDir']) {
    if (options[key] === '') throw new Error(`--${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} is required`);
    options[key] = resolve(repoRoot, options[key]);
  }
  options.stores = options.store === 'all' ? ['chromium', 'firefox'] : [options.store];
}

function parseArgs(args) {
  const options = { distDir: '', execute: false, listingDir: '', publish: false, releaseDir: '', store: '' };
  for (let index = 0; index < args.length; index += 1) index = applyArgument(options, { args, index });
  validateOptions(options);
  return options;
}

function validateInputs(options) {
  execFileSync(process.execPath, [join(repoRoot, 'scripts/package-smoke.mjs'), '--release-dir', options.releaseDir], { stdio: 'ignore' });
  for (const target of options.stores) {
    const manifestPath = join(options.distDir, target, 'manifest.json');
    const listingPath = join(options.listingDir, target, 'en-US', 'metadata.json');
    if (!existsSync(manifestPath) || !existsSync(listingPath)) throw new Error(`missing validated ${target} release inputs`);
  }
}

function releasePlan(stores) {
  return stores.map((store) => store === 'chromium'
    ? { store, request: {
      upload_path: '/upload/v2/publishers/{CWS_PUBLISHER_ID}/items/{CWS_EXTENSION_ID}:upload',
      publish_path: '/v2/publishers/{CWS_PUBLISHER_ID}/items/{CWS_EXTENSION_ID}:publish',
    } }
    : { store, request: { command: 'web-ext sign --channel listed --no-input --no-config-discovery' } });
}

function missingCredentialBlocker(stores) {
  const blocked = stores.flatMap((store) => {
    const missing = credentialNames[store].filter((name) => !process.env[name]);
    return missing.length === 0 ? [] : [{ store, missing_credentials: missing }];
  });
  return blocked.length === 0 ? undefined : { status: 'blocked', reason: 'missing_owner_credentials', stores: blocked };
}

function chromiumArchive(releaseDir) {
  const names = readdirSync(releaseDir).filter((name) => name.endsWith('-chromium.zip'));
  if (names.length !== 1) throw new Error('expected one validated Chromium archive');
  return join(releaseDir, names[0]);
}

async function chromeRequest(path, request) {
  const response = await fetch(`https://chromewebstore.googleapis.com${path}`, {
    ...request.options,
    headers: { ...request.options.headers, Authorization: `Bearer ${request.token}` },
  });
  if (!response.ok) throw new Error(`Chrome Web Store request failed with HTTP ${response.status}`);
  return response;
}

async function uploadChromium(options) {
  const form = new URLSearchParams({
    client_id: process.env['CWS_CLIENT_ID'], client_secret: process.env['CWS_CLIENT_SECRET'],
    grant_type: 'refresh_token', refresh_token: process.env['CWS_REFRESH_TOKEN'],
  });
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body: form });
  if (!tokenResponse.ok) throw new Error(`Chrome OAuth failed with HTTP ${tokenResponse.status}`);
  const token = (await tokenResponse.json()).access_token;
  if (typeof token !== 'string') throw new Error('Chrome OAuth returned no access token');
  const publisher = encodeURIComponent(process.env['CWS_PUBLISHER_ID']);
  const extension = encodeURIComponent(process.env['CWS_EXTENSION_ID']);
  const uploadPath = `/upload/v2/publishers/${publisher}/items/${extension}:upload`;
  const archive = chromiumArchive(options.releaseDir);
  await chromeRequest(uploadPath, { options: {
    method: 'POST', body: readFileSync(archive),
    headers: { 'Content-Type': 'application/zip', 'X-Goog-Upload-File-Name': basename(archive), 'X-Goog-Upload-Protocol': 'raw' },
  }, token });
  if (options.publish) await chromeRequest(`/v2/publishers/${publisher}/items/${extension}:publish`, { options: { method: 'POST' }, token });
  return { published: options.publish, store: 'chromium', uploaded: true };
}

function uploadFirefox(options) {
  const artifactsDir = join(options.releaseDir, 'signed-firefox');
  mkdirSync(artifactsDir, { recursive: true });
  const binary = join(repoRoot, 'node_modules/.bin/web-ext');
  const args = ['sign', '--channel', 'listed', '--no-input', '--no-config-discovery', '--source-dir', join(options.distDir, 'firefox'), '--artifacts-dir', artifactsDir, '--amo-metadata', join(options.listingDir, 'firefox/en-US/metadata.json')];
  const result = spawnSync(binary, args, { encoding: 'utf8', env: { ...process.env, WEB_EXT_API_KEY: process.env['WEB_EXT_API_KEY'], WEB_EXT_API_SECRET: process.env['WEB_EXT_API_SECRET'] } });
  if (result.status !== 0) throw new Error('Mozilla signing/upload failed; inspect the protected job log');
  return { signed: true, store: 'firefox', uploaded: true };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  validateInputs(options);
  if (!options.execute) return { mode: 'dry-run', stores: releasePlan(options.stores) };
  const blocker = missingCredentialBlocker(options.stores);
  if (blocker !== undefined) {
    process.stderr.write(`${JSON.stringify(blocker)}\n`);
    process.exitCode = 2;
    return undefined;
  }
  const results = [];
  for (const store of options.stores) results.push(store === 'chromium' ? await uploadChromium(options) : uploadFirefox(options));
  return { mode: 'execute', results };
}

try {
  const result = await main();
  if (result !== undefined) process.stdout.write(`${JSON.stringify(result)}\n`);
} catch (error) {
  process.stderr.write(`${JSON.stringify({ status: 'failed', error: error instanceof Error ? error.message : String(error) })}\n`);
  process.exitCode = 1;
}
