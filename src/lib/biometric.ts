/**
 * Biometric authentication helper.
 * Uses @capgo/capacitor-native-biometric to store and retrieve
 * credentials securely in the device keystore.
 */
import { NativeBiometric, BiometryType } from '@capgo/capacitor-native-biometric';
import { isNativePlatform } from './platform';
import { logger } from './logger';

const SERVER = 'streamvault-auth';

export interface BiometricStatus {
  available: boolean;
  biometryType: 'fingerprint' | 'face' | 'iris' | 'none';
  hasCredentials: boolean;
}

export async function getBiometricStatus(): Promise<BiometricStatus> {
  if (!isNativePlatform()) {
    return { available: false, biometryType: 'none', hasCredentials: false };
  }

  try {
    const result = await NativeBiometric.isAvailable();
    const typeMap: Record<number, BiometricStatus['biometryType']> = {
      [BiometryType.FINGERPRINT]: 'fingerprint',
      [BiometryType.FACE_AUTHENTICATION]: 'face',
      [BiometryType.FACE_ID]: 'face',
      [BiometryType.TOUCH_ID]: 'fingerprint',
    };
    const biometryType = typeMap[result.biometryType] || 'fingerprint';

    let hasCredentials = false;
    try {
      await NativeBiometric.getCredentials({ server: SERVER });
      hasCredentials = true;
    } catch {
      hasCredentials = false;
    }

    logger.info('Biometric', `Available: ${result.isAvailable}, type: ${biometryType}, creds: ${hasCredentials}`);
    return { available: result.isAvailable, biometryType, hasCredentials };
  } catch (e: any) {
    logger.warn('Biometric', `Check failed: ${e?.message}`);
    return { available: false, biometryType: 'none', hasCredentials: false };
  }
}

export async function saveCredentials(email: string, password: string): Promise<void> {
  await NativeBiometric.setCredentials({
    username: email,
    password,
    server: SERVER,
  });
  logger.info('Biometric', 'Credentials saved to keystore');
}

export async function biometricLogin(): Promise<{ email: string; password: string }> {
  // Prompt biometric verification
  await NativeBiometric.verifyIdentity({
    reason: 'Authenticate to sign in',
    title: 'Sign In',
    subtitle: 'Use biometrics to access your account',
    useFallback: true,
  });

  // If verification passed, retrieve stored credentials
  const creds = await NativeBiometric.getCredentials({ server: SERVER });
  logger.info('Biometric', 'Biometric verification passed, credentials retrieved');
  return { email: creds.username, password: creds.password };
}

export async function deleteCredentials(): Promise<void> {
  try {
    await NativeBiometric.deleteCredentials({ server: SERVER });
    logger.info('Biometric', 'Credentials deleted from keystore');
  } catch {
    // ignore if nothing stored
  }
}
