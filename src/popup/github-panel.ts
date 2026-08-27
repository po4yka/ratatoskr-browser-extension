import type { CaptureDraft } from '../capture/draft';
import { projectGithubActionResult, type RepositoryActionPresentation } from '../github/action-result';
import { createGithubActionFlow, type ConfirmationSelection, type GitHubActionIntent } from '../github/confirmation';
import type { GitHubRepositoryPreview, RepositoryActionMode } from '../github/preview';
import {
  createGithubActionMessage,
  createGithubPreviewMessage,
  decodeGithubActionReply,
  decodeGithubPreviewReply,
} from '../protocol/github';
import { message } from '../i18n/messages';
import { githubAggregateText, githubResultText } from './github-result';

export interface GitHubPanel {
  present(draft: CaptureDraft | undefined, actionable: boolean): void;
}

interface GitHubElements {
  readonly account: HTMLOutputElement;
  readonly actions: Readonly<Record<RepositoryActionMode, HTMLButtonElement>>;
  readonly availability: HTMLElement;
  readonly description: HTMLOutputElement;
  readonly dialogs: Readonly<Record<'track' | 'star', HTMLDialogElement>>;
  readonly fullName: HTMLOutputElement;
  readonly language: HTMLOutputElement;
  readonly panel: HTMLElement;
  readonly results: HTMLUListElement;
  readonly starTarget: HTMLOutputElement;
  readonly stars: HTMLOutputElement;
  readonly trackTarget: HTMLOutputElement;
}

export function connectGithubPanel(): GitHubPanel | undefined {
  const elements = githubElements();
  if (elements === undefined) return undefined;
  return new PopupGitHubPanel(elements);
}

class PopupGitHubPanel implements GitHubPanel {
  private actionable = false;
  private currentPreview: GitHubRepositoryPreview | undefined;
  private currentUrl: string | undefined;
  private pending: ConfirmationSelection | undefined;
  private dialogInvoker: HTMLButtonElement | undefined;
  private readonly flow = createGithubActionFlow({
    createConfirmationEvidenceRef: () => `browser-extension-confirmation:${crypto.randomUUID()}`,
    createIdempotencyKey: () => `browser-extension-github-action:${crypto.randomUUID()}`,
  });

  constructor(private readonly elements: GitHubElements) {
    for (const mode of ['metadata', 'track', 'star'] as const) {
      elements.actions[mode].addEventListener('click', () => this.select(mode, elements.actions[mode]));
    }
    bind('[data-action="github-track-confirm"]', () => this.confirm('track'));
    bind('[data-action="github-star-confirm"]', () => this.confirm('star'));
    bind('[data-action="github-track-cancel"]', () => this.cancel('track'));
    bind('[data-action="github-star-cancel"]', () => this.cancel('star'));
  }

  present(draft: CaptureDraft | undefined, actionable: boolean): void {
    this.actionable = actionable;
    const repositoryUrl = draft?.github?.previewUrl;
    this.elements.panel.hidden = repositoryUrl === undefined;
    if (repositoryUrl === undefined) {
      this.currentUrl = undefined;
      this.currentPreview = undefined;
      return;
    }
    this.updateActions();
    if (repositoryUrl === this.currentUrl) return;
    this.currentUrl = repositoryUrl;
    this.currentPreview = undefined;
    this.elements.availability.textContent = message('githubChecking');
    this.updateActions();
    void this.loadPreview(repositoryUrl);
  }

  private async loadPreview(repositoryUrl: string): Promise<void> {
    try {
      const reply = decodeGithubPreviewReply(await chrome.runtime.sendMessage(createGithubPreviewMessage(repositoryUrl)));
      if (this.currentUrl !== repositoryUrl) return;
      if (reply.type !== 'github.repository.previewed' || reply.status !== 'available') {
        this.unavailable();
        return;
      }
      this.currentPreview = reply.preview;
      this.renderPreview(reply.preview);
    } catch {
      if (this.currentUrl === repositoryUrl) this.unavailable();
    }
  }

  private select(mode: RepositoryActionMode, invoker: HTMLButtonElement): void {
    if (!this.actionable || this.currentPreview === undefined) return;
    const selection = this.flow.select(this.currentPreview, mode);
    if (selection.status === 'ready') {
      void this.submit(selection.intent);
    } else if (selection.status === 'confirmation-required') {
      this.pending = selection;
      this.dialogInvoker = invoker;
      this.openDialog(selection);
    }
  }

  private confirm(mode: 'track' | 'star'): void {
    if (this.pending?.mode !== mode || this.currentPreview === undefined) return;
    const intent = this.flow.confirm(this.pending, this.currentPreview);
    this.pending = undefined;
    this.elements.dialogs[mode].close();
    this.restoreDialogFocus();
    if (intent !== undefined) void this.submit(intent);
  }

  private cancel(mode: 'track' | 'star'): void {
    if (this.pending?.mode === mode) this.flow.cancel(this.pending);
    this.pending = undefined;
    this.elements.dialogs[mode].close();
    this.restoreDialogFocus();
  }

  private async submit(intent: GitHubActionIntent): Promise<void> {
    this.elements.availability.textContent = message('githubSubmitting');
    try {
      const reply = decodeGithubActionReply(await chrome.runtime.sendMessage(createGithubActionMessage(intent)));
      if (reply.type !== 'github.repository.action-completed') {
        this.elements.availability.textContent = message('githubActionUnavailable');
        return;
      }
      const presentation = projectGithubActionResult(reply.result);
      this.elements.availability.textContent = message('githubActionResult', githubAggregateText(presentation.aggregate));
      this.elements.results.replaceChildren(...presentation.rows.map(resultRow));
    } catch {
      this.elements.availability.textContent = message('githubActionUnavailable');
    }
  }

  private renderPreview(preview: GitHubRepositoryPreview): void {
    this.elements.availability.textContent = message('githubPreviewAvailable');
    this.elements.fullName.value = preview.target.repositoryFullName;
    this.elements.description.value = preview.description ?? message('commonNotProvided');
    this.elements.stars.value = String(preview.stargazerCount);
    this.elements.language.value = preview.primaryLanguage ?? message('commonNotProvided');
    this.updateActions();
  }

  private unavailable(): void {
    this.currentPreview = undefined;
    this.elements.availability.textContent = message('githubUnavailable');
    this.updateActions();
  }

  private updateActions(): void {
    for (const mode of ['metadata', 'track', 'star'] as const) {
      const available = this.currentPreview?.availableActions.includes(mode) === true
        && (mode !== 'star' || this.currentPreview.accountRef !== undefined);
      this.elements.actions[mode].hidden = !available;
      this.elements.actions[mode].disabled = !available || !this.actionable;
    }
  }

  private openDialog(selection: ConfirmationSelection): void {
    if (selection.mode === 'track') this.elements.trackTarget.value = selection.prompt.repositoryFullName;
    if (selection.mode === 'star') {
      this.elements.starTarget.value = selection.prompt.repositoryFullName;
      this.elements.account.value = selection.prompt.accountRef ?? message('commonUnavailable');
    }
    this.elements.dialogs[selection.mode].showModal();
    this.elements.dialogs[selection.mode].querySelector<HTMLButtonElement>('button')?.focus();
  }

  private restoreDialogFocus(): void {
    this.dialogInvoker?.focus();
    this.dialogInvoker = undefined;
  }
}

function resultRow(row: RepositoryActionPresentation['rows'][number]): HTMLLIElement {
  const item = document.createElement('li');
  item.dataset.status = row.status;
  item.textContent = githubResultText(row);
  return item;
}

function bind(selector: string, listener: () => void): void {
  document.querySelector<HTMLButtonElement>(selector)?.addEventListener('click', listener);
}

function githubElements(): GitHubElements | undefined {
  const elements = {
    account: document.querySelector<HTMLOutputElement>('[data-role="github-star-account"]'),
    actions: {
      metadata: document.querySelector<HTMLButtonElement>('[data-action="github-metadata"]'),
      star: document.querySelector<HTMLButtonElement>('[data-action="github-star"]'),
      track: document.querySelector<HTMLButtonElement>('[data-action="github-track"]'),
    },
    availability: document.querySelector<HTMLElement>('[data-role="github-availability"]'),
    description: document.querySelector<HTMLOutputElement>('[data-role="github-description"]'),
    dialogs: {
      star: document.querySelector<HTMLDialogElement>('[data-role="github-star-confirmation"]'),
      track: document.querySelector<HTMLDialogElement>('[data-role="github-track-confirmation"]'),
    },
    fullName: document.querySelector<HTMLOutputElement>('[data-role="github-full-name"]'),
    language: document.querySelector<HTMLOutputElement>('[data-role="github-language"]'),
    panel: document.querySelector<HTMLElement>('[data-role="github-preview"]'),
    results: document.querySelector<HTMLUListElement>('[data-role="github-results"]'),
    starTarget: document.querySelector<HTMLOutputElement>('[data-role="github-star-target"]'),
    stars: document.querySelector<HTMLOutputElement>('[data-role="github-stars"]'),
    trackTarget: document.querySelector<HTMLOutputElement>('[data-role="github-track-target"]'),
  };
  return Object.values(elements).some(missing) ? undefined : elements as unknown as GitHubElements;
}

function missing(value: unknown): boolean {
  return value === null || (typeof value === 'object' && value !== null && Object.values(value).some((entry) => entry === null));
}
