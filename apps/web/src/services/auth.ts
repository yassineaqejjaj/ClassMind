import { UserManager, WebStorageStateStore } from "oidc-client-ts";

export const userManager = new UserManager({
  authority: import.meta.env.VITE_OIDC_AUTHORITY ?? "http://localhost:8080/auth/realms/classmind",
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? "classmind-web",
  redirect_uri: `${window.location.origin}/callback`,
  post_logout_redirect_uri: window.location.origin,
  response_type: "code", // flux Authorization Code + PKCE
  scope: "openid profile",
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
});

/**
 * Mode démo locale : uniquement avec `vite dev` ET VITE_DEV_AUTH=1 (jamais dans un build de production,
 * `import.meta.env.DEV` y vaut false). L'API correspondante est lancée par scripts/local_demo.py.
 */
const devAuth = import.meta.env.DEV && import.meta.env.VITE_DEV_AUTH === "1";

export interface SessionUser {
  expired?: boolean;
  access_token: string;
  profile: { name?: string; given_name?: string; preferred_username?: string };
}

export async function currentUser(): Promise<SessionUser | null> {
  if (devAuth) {
    return {
      expired: false,
      access_token: "dev",
      profile: { name: "Camille Martin", given_name: "Camille", preferred_username: "camille" },
    };
  }
  return userManager.getUser();
}

export async function getToken(): Promise<string | null> {
  const user = await currentUser();
  return user && !user.expired ? user.access_token : null;
}
