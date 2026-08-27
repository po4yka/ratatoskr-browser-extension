import { createDoubleConfirmationFlow } from './destructive-confirmation';

export function connectDestructiveDialogs(options: {
  readonly action: 'clear' | 'revoke';
  readonly dispatch: () => Promise<void>;
  readonly invoker: HTMLButtonElement;
}): void {
  const review = dialog(`[data-role="${options.action}-review"]`);
  const final = dialog(`[data-role="${options.action}-final"]`);
  if (review === undefined || final === undefined) return;
  const flow = createDoubleConfirmationFlow({
    dispatch: options.dispatch,
    openFinal: () => open(final, `[data-action="${options.action}-final-confirm"]`),
    openReview: () => open(review, `[data-action="${options.action}-review-confirm"]`),
  });
  options.invoker.addEventListener('click', () => flow.begin(options.invoker));
  bind(`[data-action="${options.action}-review-confirm"]`, () => { review.close(); flow.confirmReview(); });
  bind(`[data-action="${options.action}-final-confirm"]`, () => { final.close(); void flow.confirmFinal(); });
  for (const cancel of document.querySelectorAll<HTMLButtonElement>(`[data-action="${options.action}-cancel"]`)) {
    cancel.addEventListener('click', () => { review.close(); final.close(); flow.cancel(); });
  }
  for (const current of [review, final]) current.addEventListener('cancel', () => flow.cancel());
}

function open(dialogElement: HTMLDialogElement, focusSelector: string): void {
  dialogElement.showModal();
  document.querySelector<HTMLButtonElement>(focusSelector)?.focus();
}

function dialog(selector: string): HTMLDialogElement | undefined {
  return document.querySelector<HTMLDialogElement>(selector) ?? undefined;
}

function bind(selector: string, listener: () => void): void {
  document.querySelector<HTMLButtonElement>(selector)?.addEventListener('click', listener);
}
