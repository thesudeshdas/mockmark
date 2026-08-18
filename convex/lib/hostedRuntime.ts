export function hostedPageIdentity(path: string) {
  return `hosted:${path}`.slice(0, 240);
}

export function hostedPageMatchesPath(pageKey: string, path: string) {
  return pageKey === hostedPageIdentity(path)
    || (pageKey.startsWith("hosted:mmb_") && pageKey.endsWith(`:${path}`));
}

export function hostedBootstrap(
  token: string,
  deploymentKey: string,
  path: string,
  baseHref: string,
) {
  const pageKey = hostedPageIdentity(path);
  return `<base href="${baseHref}"><script>window.__MOCKMARK_HOSTED_TOKEN__=${scriptJson(token)};window.__MOCKMARK_HOSTED_PAGE_KEY__=${scriptJson(pageKey)};</script>`;
}

export function hostedSecurityHeaders(contentType: string) {
  return {
    "content-type": contentType,
    "cache-control": "private, no-store",
    "referrer-policy": "no-referrer",
    "x-content-type-options": "nosniff",
    "access-control-allow-origin": "*",
    "content-security-policy": "sandbox allow-scripts allow-forms allow-modals allow-popups allow-downloads allow-top-navigation-by-user-activation; frame-ancestors https://mockmark.vercel.app",
  };
}

function scriptJson(value: string) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
