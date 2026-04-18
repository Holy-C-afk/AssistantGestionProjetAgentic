import { useMsal } from "@azure/msal-react";
import { apiRequest, loginRequest } from "./authConfig";

export function useAuth() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];

  const getToken = async () => {
    if (!account) return null;
    const response = await instance.acquireTokenSilent({
      ...apiRequest,
      account,
    });
    return response.accessToken;
  };

  const login = () => instance.loginRedirect(loginRequest);
  const logout = () => instance.logoutRedirect();

  return { account, getToken, login, logout };
}