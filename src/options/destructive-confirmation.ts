interface FocusTarget {
  focus(): void;
}

export function createDoubleConfirmationFlow(options: {
  readonly dispatch: () => Promise<void>;
  readonly openFinal: () => void;
  readonly openReview: () => void;
}): {
  begin(invoker: FocusTarget): void;
  cancel(): void;
  confirmFinal(): Promise<void>;
  confirmReview(): void;
} {
  let invoker: FocusTarget | undefined;
  let pending = false;
  return {
    begin(target) {
      if (pending) return;
      invoker = target;
      options.openReview();
    },
    cancel() {
      invoker?.focus();
      invoker = undefined;
    },
    async confirmFinal() {
      if (pending || invoker === undefined) return;
      pending = true;
      try {
        await options.dispatch();
      } finally {
        pending = false;
        invoker?.focus();
        invoker = undefined;
      }
    },
    confirmReview() {
      if (invoker !== undefined && !pending) options.openFinal();
    },
  };
}
