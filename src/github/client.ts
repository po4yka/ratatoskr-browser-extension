import { githubCapabilities, repositoryPreview, type GitHubRepositoryPreview } from './preview';
import { githubActionBody } from './action-request';
import { repositoryActionResult, type RepositoryActionResult } from './action-result';
import type { GitHubActionIntent } from './confirmation';

export type GitHubPreviewState =
  | { readonly preview: GitHubRepositoryPreview; readonly status: 'available' }
  | { readonly status: 'unavailable' };

export interface GitHubRepositoryClient {
  action(request: { readonly accessToken: string; readonly intent: GitHubActionIntent }): Promise<RepositoryActionResult>;
  preview(request: { readonly accessToken: string; readonly repositoryUrl: string }): Promise<GitHubPreviewState>;
}

export class GitHubRepositoryClientError extends Error {}

export function createGithubRepositoryClient(options: { readonly endpoint: string; readonly fetch: typeof fetch }): GitHubRepositoryClient {
  const endpoint = httpsOrigin(options.endpoint);
  return {
    action: async (request) => {
      const body = githubActionBody(request.intent);
      if (body === undefined) throw new GitHubRepositoryClientError('GitHub action request was invalid.');
      const response = await authorizedRequest({
        accessToken: request.accessToken,
        fetcher: options.fetch,
        init: { body: JSON.stringify(body), method: 'POST' },
        url: `${endpoint}/v1/gh/repositories/actions`,
      });
      if (!response.ok) throw new GitHubRepositoryClientError('GitHub repository action failed.');
      const result = repositoryActionResult(await response.json());
      if (result === undefined) throw new GitHubRepositoryClientError('GitHub action result was invalid.');
      return result;
    },
    preview: async (request) => {
      const capabilityResponse = await authorizedRequest({
        accessToken: request.accessToken,
        fetcher: options.fetch,
        init: { method: 'GET' },
        url: `${endpoint}/v1/capabilities`,
      });
      if (!capabilityResponse.ok) throw new GitHubRepositoryClientError('GitHub capability request failed.');
      const capabilities = githubCapabilities(await capabilityResponse.json());
      if (capabilities === undefined) return { status: 'unavailable' };
      const previewResponse = await authorizedRequest({
        accessToken: request.accessToken,
        fetcher: options.fetch,
        init: { body: JSON.stringify({ repository_url: request.repositoryUrl }), method: 'POST' },
        url: `${endpoint}/v1/gh/repositories/preview`,
      });
      if (!previewResponse.ok) throw new GitHubRepositoryClientError('GitHub repository preview failed.');
      const preview = repositoryPreview(await previewResponse.json(), capabilities);
      if (preview === undefined) throw new GitHubRepositoryClientError('GitHub repository preview was invalid.');
      return { preview, status: 'available' };
    },
  };
}

function authorizedRequest(options: { readonly accessToken: string; readonly fetcher: typeof fetch; readonly init: RequestInit; readonly url: string }): Promise<Response> {
  return options.fetcher(options.url, {
    ...options.init,
    headers: { authorization: `Bearer ${options.accessToken}`, 'content-type': 'application/json' },
    redirect: 'error',
  });
}

function httpsOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new GitHubRepositoryClientError('GitHub repository endpoint was invalid.');
  }
  return url.origin;
}
