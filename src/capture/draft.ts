import { formatWireTimestamp } from '../protocol/wire-timestamp';

export type CaptureEntryPoint = 'popup' | 'page-menu' | 'link-menu' | 'selection-menu';
export type CaptureKind = 'page' | 'link' | 'selection';
export type SocialCaptureProvider = 'x' | 'instagram' | 'threads';

export interface SocialCaptureProvenance {
  readonly acquisition: 'browser_extension';
  readonly capturedAt: string;
  readonly provider: SocialCaptureProvider;
  readonly savedAuthority: 'explicit_user_capture';
}

export interface GitHubRepositoryIntent {
  readonly previewUrl: string;
}

export interface TabContext {
  readonly title?: string;
  readonly url?: string;
}

interface PageDraftInput {
  readonly entryPoint: 'popup' | 'page-menu';
  readonly tab: TabContext;
}

interface LinkDraftInput {
  readonly entryPoint: 'link-menu';
  readonly linkUrl: string;
  readonly tab: TabContext;
}

interface SelectionDraftInput {
  readonly entryPoint: 'selection-menu';
  readonly selectionText: string;
  readonly tab: TabContext;
}

export type CaptureDraftInput = PageDraftInput | LinkDraftInput | SelectionDraftInput;

export interface CaptureDraft {
  readonly captureKind: CaptureKind;
  readonly entryPoint: CaptureEntryPoint;
  readonly github?: GitHubRepositoryIntent;
  readonly sourcePageUrl: string;
  readonly title: string;
  readonly url: string;
  readonly selectionText?: string;
  readonly social?: SocialCaptureProvenance;
}

export type DraftState =
  | { readonly draft: CaptureDraft; readonly status: 'ready' | 'staged' | 'queued' | 'submitted' }
  | { readonly message: string; readonly status: 'error' };

export class CaptureDraftError extends Error {}

const socialRoutes: readonly {
  readonly hosts: ReadonlySet<string>;
  readonly path: RegExp;
  readonly provider: SocialCaptureProvider;
}[] = [
  { hosts: new Set(['x.com', 'www.x.com', 'mobile.x.com']), path: /^\/[A-Za-z0-9_]{1,15}\/status\/\d{1,20}\/?$/, provider: 'x' },
  { hosts: new Set(['instagram.com', 'www.instagram.com']), path: /^\/(?:p|reel)\/[A-Za-z0-9_-]+\/?$/, provider: 'instagram' },
  { hosts: new Set(['threads.net', 'www.threads.net']), path: /^\/@[A-Za-z0-9._]{1,64}\/post\/[A-Za-z0-9_-]+\/?$/, provider: 'threads' },
];

export function createDraft(input: CaptureDraftInput): CaptureDraft {
  const sourcePageUrl = requireHttpUrl(input.tab.url, 'The active page cannot be captured.');
  const title = input.tab.title?.trim() || 'Untitled page';

  if (input.entryPoint === 'link-menu') {
    return {
      captureKind: 'link',
      entryPoint: input.entryPoint,
      sourcePageUrl,
      title,
      url: requireHttpUrl(input.linkUrl, 'The selected link cannot be captured.'),
      ...githubCapture(input.linkUrl),
      ...socialCapture(input.linkUrl),
    };
  }

  if (input.entryPoint === 'selection-menu') {
    const selectionText = input.selectionText.trim();
    if (selectionText === '') {
      throw new CaptureDraftError('Select text before saving it to Ratatoskr.');
    }
    return {
      captureKind: 'selection',
      entryPoint: input.entryPoint,
      selectionText,
      sourcePageUrl,
      title,
      url: sourcePageUrl,
      ...githubCapture(sourcePageUrl),
      ...socialCapture(sourcePageUrl),
    };
  }

  return {
    captureKind: 'page',
    entryPoint: input.entryPoint,
    sourcePageUrl,
    title,
    url: sourcePageUrl,
    ...githubCapture(sourcePageUrl),
    ...socialCapture(sourcePageUrl),
  };
}

/**
 * Recognizes only the repository-root URL shape accepted by the shared GitHub preview contract.
 * The returned URL is for preview routing; the draft keeps the original captured URL unchanged.
 */
export function classifyGithubRepository(value: string): GitHubRepositoryIntent | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (!isGithubRepositoryOrigin(url)) return undefined;
  const match = /^\/([A-Za-z0-9][A-Za-z0-9_.-]{0,99})\/([A-Za-z0-9][A-Za-z0-9_.-]{0,99})\/?$/.exec(url.pathname);
  return match === null ? undefined : { previewUrl: `https://github.com/${match[1]}/${match[2]}` };
}

function isGithubRepositoryOrigin(url: URL): boolean {
  return [
    url.protocol === 'https:',
    url.hostname.toLowerCase() === 'github.com',
    url.username === '',
    url.password === '',
    url.port === '',
    url.search === '',
    url.hash === '',
  ].every(Boolean);
}

/**
 * Identifies only public post permalinks that the owning social service has agreed to receive.
 * The input string is never normalized or rewritten: Platform owns canonicalization.
 */
export function classifySocialCapture(value: string): { readonly provider: SocialCaptureProvider } | undefined {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  if (url.protocol !== 'https:') {
    return undefined;
  }
  const route = socialRoutes.find((candidate) => candidate.hosts.has(url.hostname.toLowerCase())
    && candidate.path.test(url.pathname));
  return route === undefined ? undefined : { provider: route.provider };
}

export function createReadyState(draft: CaptureDraft): DraftState {
  return { draft, status: 'ready' };
}

export function stageDraft(state: DraftState): DraftState {
  return state.status === 'ready'
    ? { draft: state.draft, status: 'staged' }
    : markDraftError('Only a ready draft can be staged.');
}

export function markDraftSubmitted(state: DraftState): DraftState {
  return state.status === 'staged'
    ? { draft: state.draft, status: 'submitted' }
    : markDraftError('Only a staged draft can be marked as submitted.');
}

export function markDraftQueued(state: DraftState): DraftState {
  return state.status === 'staged'
    ? { draft: state.draft, status: 'queued' }
    : markDraftError('Only a staged draft can be queued.');
}

export function markDraftError(message: string): DraftState {
  return { message, status: 'error' };
}

function requireHttpUrl(value: string | undefined, message: string): string {
  if (value === undefined) {
    throw new CaptureDraftError(message);
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new CaptureDraftError(message);
    }
    return value;
  } catch {
    throw new CaptureDraftError(message);
  }
}

function socialCapture(url: string): { readonly social: SocialCaptureProvenance } | Record<never, never> {
  const route = classifySocialCapture(url);
  return route === undefined
    ? {}
    : {
      social: {
        acquisition: 'browser_extension',
        capturedAt: formatWireTimestamp(new Date()),
        provider: route.provider,
        savedAuthority: 'explicit_user_capture',
      },
    };
}

function githubCapture(url: string): { readonly github: GitHubRepositoryIntent } | Record<never, never> {
  const github = classifyGithubRepository(url);
  return github === undefined ? {} : { github };
}
