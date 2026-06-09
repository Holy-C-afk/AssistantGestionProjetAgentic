import { PublicClientApplication } from '@azure/msal-browser';
import { msalConfig } from './authConfig';

// Singleton MSAL instance shared across the app and emailApi
export const msalInstance = new PublicClientApplication(msalConfig);
