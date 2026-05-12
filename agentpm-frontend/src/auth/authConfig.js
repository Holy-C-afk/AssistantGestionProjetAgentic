export const msalConfig = {
  auth: {
    clientId  : "b4818c3b-46f3-4737-bec7-8f65927b97cd",  // ← nouveau
    authority : "https://login.microsoftonline.com/d6c5bbe2-0dd0-4148-a86c-ffe8f3e95c29",
    redirectUri: "http://localhost:5173",
  },
  cache: {
    cacheLocation: "sessionStorage",
    storeAuthStateInCookie: false,
  },
};

export const loginRequest = {
  scopes: [
    "openid",
    "profile",
    "email",
    "api://dbf4a5ac-a3e3-445c-b0fe-c44a997bb684/access_as_user",
  ],
};

export const apiRequest = {
  scopes: [
    "api://dbf4a5ac-a3e3-445c-b0fe-c44a997bb684/access_as_user"
  ],
};

// Microsoft Graph – used only to fetch the user's profile photo
export const graphRequest = {
  scopes: ["User.Read"],
};