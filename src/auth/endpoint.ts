export function endpointOriginPattern(value: string): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.pathname !== '/' || url.search !== '' || url.hash !== '') throw new Error('invalid-endpoint');
  return `${url.origin}/*`;
}
