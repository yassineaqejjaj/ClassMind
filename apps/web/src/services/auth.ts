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

export async function getToken(): Promise<string | null> {
  const user = await userManager.getUser();
  return user && !user.expired ? user.access_token : null;
}
