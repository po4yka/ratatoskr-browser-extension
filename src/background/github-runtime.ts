import { createGithubRepositoryClient } from '../github/client';
import { handleGithubMessage, isGithubMessageCandidate } from '../protocol/github';
import type { RuntimeSender } from '../protocol/messages';

interface GitHubRuntimeOptions {
  readonly accessToken: () => Promise<string>;
  readonly endpoint: () => Promise<string>;
  readonly fetcher: typeof fetch;
}

export function createGithubRuntime(options: GitHubRuntimeOptions) {
  return {
    handles: isGithubMessageCandidate,
    handle: async (message: unknown, context: { readonly extensionId: string; readonly sender: RuntimeSender }) => handleGithubMessage(message, {
      accessToken: options.accessToken,
      client: createGithubRepositoryClient({ endpoint: await options.endpoint(), fetch: options.fetcher }),
      context,
    }),
  };
}
