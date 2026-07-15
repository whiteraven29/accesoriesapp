import { Platform } from 'react-native';

export function getAuthRedirectUrl(path = 'auth/login'): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/${path}`;
  }

  return `alexapp://${path}`;
}
