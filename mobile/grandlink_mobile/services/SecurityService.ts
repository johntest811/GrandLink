import AsyncStorage from '@react-native-async-storage/async-storage';

// Types for security tracking
export interface LoginAttempt {
  email: string;
  attempted_at: string;
  device_info?: string;
  success: boolean;
}

export interface SecurityLockout {
  email: string;
  failed_attempts: number;
  locked_until: string | null;
  last_attempt_at: string;
  total_lockouts: number;
}

// Constants
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION_MINUTES = 1;
const STORAGE_PREFIX = 'security_';

/**
 * Simplified security service using local storage and existing web backend
 */
export class SecurityService {
  
  /**
   * Check if account is currently locked out
   */
  static async isAccountLocked(email: string): Promise<{
    isLocked: boolean;
    remainingMinutes?: number;
    lockoutInfo?: SecurityLockout;
  }> {
    try {
      const lockoutData = await AsyncStorage.getItem(`${STORAGE_PREFIX}lockout_${email.toLowerCase()}`);
      
      if (lockoutData) {
        const lockout: SecurityLockout = JSON.parse(lockoutData);
        
        if (lockout.locked_until && new Date(lockout.locked_until) > new Date()) {
          const remainingMs = new Date(lockout.locked_until).getTime() - new Date().getTime();
          return {
            isLocked: true,
            remainingMinutes: Math.ceil(remainingMs / 60000),
            lockoutInfo: lockout
          };
        } else {
          // Lockout expired, remove it
          await AsyncStorage.removeItem(`${STORAGE_PREFIX}lockout_${email.toLowerCase()}`);
        }
      }

      return { isLocked: false };
    } catch (error) {
      console.warn('Error checking account lockout:', error);
      return { isLocked: false };
    }
  }

  /**
   * Record a login attempt locally
   */
  static async recordLoginAttempt(
    email: string, 
    success: boolean,
    deviceInfo?: string
  ): Promise<void> {
    try {
      const attempt: LoginAttempt = {
        email: email.toLowerCase(),
        attempted_at: new Date().toISOString(),
        device_info: deviceInfo || 'Mobile Device',
        success
      };

      // Store locally
      const localAttempts = await AsyncStorage.getItem(`${STORAGE_PREFIX}attempts_${email.toLowerCase()}`) || '[]';
      const attempts = JSON.parse(localAttempts);
      attempts.push(attempt);
      
      // Keep only last 10 attempts locally
      const recentAttempts = attempts.slice(-10);
      await AsyncStorage.setItem(`${STORAGE_PREFIX}attempts_${email.toLowerCase()}`, JSON.stringify(recentAttempts));
      
    } catch (error) {
      console.warn('Error recording login attempt:', error);
    }
  }

  /**
   * Handle failed login attempt and check for lockout
   */
  static async handleFailedLogin(
    email: string,
    deviceInfo?: string
  ): Promise<{
    shouldLockout: boolean;
    failedAttempts: number;
    lockoutMinutes?: number;
  }> {
    try {
      const normalizedEmail = email.toLowerCase();
      
      // Record the failed attempt
      await this.recordLoginAttempt(normalizedEmail, false, deviceInfo);

      // Get recent failed attempts from local storage
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const localAttempts = await AsyncStorage.getItem(`${STORAGE_PREFIX}attempts_${normalizedEmail}`) || '[]';
      const attempts = JSON.parse(localAttempts);
      
      const recentFailedAttempts = attempts.filter(
        (attempt: LoginAttempt) => 
          !attempt.success && 
          new Date(attempt.attempted_at) > new Date(fiveMinutesAgo)
      ).length;

      // Check if we should lockout
      if (recentFailedAttempts >= MAX_LOGIN_ATTEMPTS) {
        await this.lockoutAccount(normalizedEmail, recentFailedAttempts, deviceInfo);
        return {
          shouldLockout: true,
          failedAttempts: recentFailedAttempts,
          lockoutMinutes: LOCKOUT_DURATION_MINUTES
        };
      }

      return {
        shouldLockout: false,
        failedAttempts: recentFailedAttempts
      };
      
    } catch (error) {
      console.warn('Error handling failed login:', error);
      return {
        shouldLockout: false,
        failedAttempts: 1
      };
    }
  }

  /**
   * Lockout account and send security alert email
   */
  static async lockoutAccount(
    email: string,
    failedAttempts: number,
    deviceInfo?: string
  ): Promise<void> {
    try {
      const normalizedEmail = email.toLowerCase();
      const lockedUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      
      const lockoutData: SecurityLockout = {
        email: normalizedEmail,
        failed_attempts: failedAttempts,
        locked_until: lockedUntil.toISOString(),
        last_attempt_at: new Date().toISOString(),
        total_lockouts: 1
      };

      // Get existing lockout data to increment total count and check if email already sent
      const existingLockout = await AsyncStorage.getItem(`${STORAGE_PREFIX}lockout_${normalizedEmail}`);
      let shouldSendEmail = true;
      
      if (existingLockout) {
        const existing = JSON.parse(existingLockout);
        lockoutData.total_lockouts = (existing.total_lockouts || 0) + 1;
        
        // Check if account is still locked from previous attempt (don't send duplicate emails)
        if (existing.locked_until && new Date(existing.locked_until) > new Date()) {
          shouldSendEmail = false;
          console.log('Account still locked from previous attempt, skipping duplicate email');
        }
      }

      // Store lockout in local storage
      await AsyncStorage.setItem(
        `${STORAGE_PREFIX}lockout_${normalizedEmail}`,
        JSON.stringify(lockoutData)
      );

      // Only send security alert email if this is a new lockout
      if (shouldSendEmail) {
        await this.sendSecurityAlert(normalizedEmail, failedAttempts, deviceInfo);
      }
      
      console.log(`Account ${normalizedEmail} locked for ${LOCKOUT_DURATION_MINUTES} minutes after ${failedAttempts} failed attempts`);
      
    } catch (error) {
      console.error('Error locking out account:', error);
    }
  }

  /**
   * Send security alert email using existing web backend
   */
  static async sendSecurityAlert(
    email: string,
    failedAttempts: number,
    deviceInfo?: string
  ): Promise<void> {
    try {
      console.log('Sending security alert email to:', email);
      
      // Use existing web backend security alert system
      const alertData = {
        toEmail: email,
        attempts: failedAttempts,
        ip: 'Mobile Device',
        userAgent: 'Grand Link Mobile App',
        deviceInfo: deviceInfo || 'Mobile Device',
        lockedMinutes: LOCKOUT_DURATION_MINUTES
      };

      try {
        const response = await fetch('https://grandlnik-website.vercel.app/api/auth/security-alert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(alertData),
        });

        if (response.ok) {
          console.log('Security alert email sent successfully');
        } else {
          console.warn('Failed to send security alert email:', response.status);
        }
      } catch (error) {
        console.warn('Could not send security alert email:', error);
      }

    } catch (error) {
      console.error('Error sending security alert:', error);
    }
  }

  /**
   * Clear failed attempts after successful login
   */
  static async clearFailedAttempts(email: string): Promise<void> {
    try {
      const normalizedEmail = email.toLowerCase();
      
      // Clear from local storage
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}lockout_${normalizedEmail}`);
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}attempts_${normalizedEmail}`);
      
      console.log('Cleared failed attempts for:', normalizedEmail);
    } catch (error) {
      console.warn('Error clearing failed attempts:', error);
    }
  }

  /**
   * Get device info for security tracking
   */
  static getDeviceInfo(): string {
    try {
      const info = {
        platform: 'Mobile App',
        timestamp: new Date().toISOString(),
        app: 'Grand Link Mobile'
      };
      return JSON.stringify(info);
    } catch (error) {
      return 'Grand Link Mobile Device';
    }
  }
}

export default SecurityService;