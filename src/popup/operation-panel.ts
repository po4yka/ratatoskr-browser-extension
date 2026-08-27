import type { CaptureOperationStatus } from '../protocol/capture-status';

export function operationIsTerminal(status: CaptureOperationStatus['status'] | undefined): boolean {
  return status === 'succeeded' || status === 'partially_succeeded' || status === 'failed' || status === 'cancelled';
}

export function operationMessage(operation: CaptureOperationStatus | undefined): string {
  if (operation === undefined) {
    return 'Waiting for Platform acceptance…';
  }
  const social = socialOutcomeMessage(operation);
  if (social !== undefined) return social;
  return genericOperationMessage(operation);
}

function socialOutcomeMessage(operation: CaptureOperationStatus): string | undefined {
  if (operation.socialOutcome?.kind === 'unavailable') {
    return `unavailable — source ${operation.socialOutcome.reason}${failureGuidance(operation)}`;
  }
  return operation.socialOutcome?.kind === 'partial'
    ? 'partial — social post preserved; linked article extraction failed'
    : undefined;
}

function genericOperationMessage(operation: CaptureOperationStatus): string {
  const stage = operation.stage === undefined ? '' : `: ${operation.stage}`;
  const progress = operation.progressPercent === undefined ? '' : ` (${operation.progressPercent}%)`;
  const warnings = operation.warningCount === undefined ? '' : ` — ${operation.warningCount} warning${operation.warningCount === 1 ? '' : 's'}`;
  return `${operation.status}${stage}${progress}${warnings}${failureGuidance(operation)}`;
}

export function retryableOperation(operation: CaptureOperationStatus | undefined): boolean {
  return operation?.retryable === true && operationIsTerminal(operation.status);
}

function failureGuidance(operation: CaptureOperationStatus): string {
  return operation.status !== 'failed' && operation.status !== 'cancelled'
    ? ''
    : operation.retryable ? ' — retry is available' : ' — retry is unavailable';
}
