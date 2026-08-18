type SessionStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
type StorageProvider = () => SessionStorage;

const browserStorage: StorageProvider = () => window.sessionStorage;
const tokenKey = (projectKey: string) => `mockmark.token.${projectKey}`;

export function readSessionToken(
  projectKey: string,
  storage: StorageProvider = browserStorage,
) {
  try {
    return storage().getItem(tokenKey(projectKey)) ?? "";
  } catch {
    return "";
  }
}

export function writeSessionToken(
  projectKey: string,
  token: string,
  storage: StorageProvider = browserStorage,
) {
  try {
    storage().setItem(tokenKey(projectKey), token);
  } catch {}
}

export function clearSessionToken(
  projectKey: string,
  storage: StorageProvider = browserStorage,
) {
  try {
    storage().removeItem(tokenKey(projectKey));
  } catch {}
}

export function pageIdentity(
  host: string,
  pathname: string,
  hostedIdentity?: string,
) {
  return (hostedIdentity || `${host}${pathname}`).slice(0, 240);
}
