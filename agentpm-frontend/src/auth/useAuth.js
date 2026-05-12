import { useMsal } from "@azure/msal-react";
import { apiRequest, graphRequest, loginRequest } from "./authConfig";

export function useAuth() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const getToken = async () => {
    if (!account) return null;
    try {
      const response = await instance.acquireTokenSilent({ ...apiRequest, account });
      return response.accessToken;
    } catch {
      return null;
    }
  };

  // Acquires a token scoped for Microsoft Graph (User.Read).
  // Silently returns null on any error — the app works fine without the photo.
  // AADSTS65001 (no consent yet) is resolved by logging out and back in:
  // User.Read is now included in loginRequest so consent is granted at next login.
  const getGraphToken = async () => {
    if (!account) return null;
    try {
      const response = await instance.acquireTokenSilent({
        ...graphRequest,
        account,
      });
      return response.accessToken;
    } catch {
      return null; // no consent yet — will work after next re-login
    }
  };

  const login = () => instance.loginRedirect(loginRequest);
  const logout = () => instance.logoutRedirect();

  return { account, getToken, getGraphToken, login, logout };
}