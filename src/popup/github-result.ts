import type { RepositoryActionAggregate, RepositoryActionPresentation, RepositoryActionReason, RepositoryActionStatus } from '../github/action-result';
import { message } from '../i18n/messages';

type Row = RepositoryActionPresentation['rows'][number];

export function githubAggregateText(aggregate: RepositoryActionAggregate): string {
  return chrome.i18n.getMessage(statusKey(aggregate));
}

export function githubResultText(row: Row): string {
  return message('githubResultRow', [
    chrome.i18n.getMessage(componentKey(row.component)),
    chrome.i18n.getMessage(statusKey(row.status)),
    row.reason === undefined ? '' : chrome.i18n.getMessage(reasonKey(row.reason)),
  ]);
}

function componentKey(component: Row['component']): string {
  return component === 'metadata' ? 'githubComponentMetadata'
    : component === 'provider_star' ? 'githubComponentStar' : 'githubComponentBackup';
}

function statusKey(status: RepositoryActionStatus | RepositoryActionAggregate): string {
  const keys: Record<RepositoryActionStatus | RepositoryActionAggregate, string> = {
    accepted: 'githubStatusAccepted', already_applied: 'githubStatusAlreadyApplied', failed: 'githubStatusFailed',
    partial: 'githubStatusPartial', refused: 'githubStatusRefused', skipped: 'githubStatusSkipped', succeeded: 'githubStatusSucceeded',
  };
  return keys[status];
}

function reasonKey(reason: RepositoryActionReason): string {
  return `githubReason${reason.split('_').map(capitalize).join('')}`;
}

function capitalize(value: string): string {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
