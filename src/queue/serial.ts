export class SerialQueueOperations {
  private tail: Promise<void> = Promise.resolve();

  run<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(operation, operation);
    this.tail = result.then(ignoreResult, ignoreResult);
    return result;
  }
}

function ignoreResult(): void {}
