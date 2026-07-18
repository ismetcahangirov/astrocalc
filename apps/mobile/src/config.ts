import Constants from 'expo-constants';

interface AppExtra {
  apiBaseUrl: string;
  googleWebClientId: string;
  googleIosClientId: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Partial<AppExtra>;

export const config = {
  apiBaseUrl: extra.apiBaseUrl ?? 'http://localhost:4000',
  googleWebClientId: extra.googleWebClientId ?? '',
  googleIosClientId: extra.googleIosClientId ?? '',
};
