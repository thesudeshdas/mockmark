export function shouldMountMockmark(
  hostname: string,
  search: string,
  hasSessionToken: boolean,
) {
  const params = new URLSearchParams(search);
  return (
    ["localhost", "127.0.0.1", "::1"].includes(hostname) ||
    params.has("mockmark") ||
    params.has("mockmark_token") ||
    hasSessionToken
  );
}
