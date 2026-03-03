// Alternative 2FA implementation using Supabase's built-in OTP
// This acts as a fallback if the web backend has CORS issues

import { supabase } from '../app/supabaseClient';

/**
 * Send OTP using Supabase's built-in functionality
 * This is a fallback for when the web backend has CORS issues
 */
export async function sendSupabaseOTP(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('Sending Supabase OTP to:', email);
    
    const { data, error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: false, // Don't create new users, only send OTP to existing ones
      },
    });

    if (error) {
      console.error('Supabase OTP error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log('Supabase OTP sent successfully');
    return {
      success: true,
      message: 'Verification code sent to your email',
    };
  } catch (error: any) {
    console.error('Error sending Supabase OTP:', error);
    return {
      success: false,
      error: 'Failed to send verification code',
    };
  }
}

/**
 * Verify OTP using Supabase's built-in functionality
 */
export async function verifySupabaseOTP(email: string, token: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('Verifying Supabase OTP for:', email);
    
    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: token.trim(),
      type: 'email',
    });

    if (error) {
      console.error('Supabase OTP verification error:', error);
      return {
        success: false,
        error: error.message,
      };
    }

    if (!data.user) {
      return {
        success: false,
        error: 'Invalid verification code',
      };
    }

    console.log('Supabase OTP verified successfully');
    return {
      success: true,
      message: 'Successfully authenticated',
    };
  } catch (error: any) {
    console.error('Error verifying Supabase OTP:', error);
    return {
      success: false,
      error: 'Failed to verify code',
    };
  }
}

/**
 * Hybrid 2FA flow - try web backend first, fallback to Supabase OTP ONLY on network errors
 * SECURITY: Never fallback on wrong credentials - only on network/CORS issues
 */
export async function hybridSendVerificationCode(email: string, password?: string): Promise<{ 
  success: boolean; 
  message?: string; 
  error?: string;
  method?: 'web' | 'supabase';
}> {
  
  // If we have a password, try the web backend first (password-based login)
  if (password) {
    try {
      // Import here to avoid circular dependencies
      const { sendVerificationCode } = await import('./TwoFactorAuthService');
      const webResult = await sendVerificationCode(email, password);
      
      if (webResult.success) {
        return { ...webResult, method: 'web' };
      }
      
      // Check if this is a credential error (should NOT fallback) or network error (should fallback)
      const errorMessage = webResult.error?.toLowerCase() || '';
      
      // These are credential/authentication errors - DO NOT fallback to Supabase
      const isCredentialError = errorMessage.includes('invalid') || 
                              errorMessage.includes('wrong') || 
                              errorMessage.includes('incorrect') ||
                              errorMessage.includes('email') ||
                              errorMessage.includes('password') ||
                              errorMessage.includes('credentials') ||
                              errorMessage.includes('unauthorized') ||
                              errorMessage.includes('forbidden');
      
      if (isCredentialError) {
        console.log('Web backend returned credential error - NOT falling back to Supabase:', webResult.error);
        return webResult; // Return the error as-is, don't fallback
      }
      
      console.log('Web backend failed with network error, trying Supabase fallback:', webResult.error);
    } catch (error: any) {
      console.log('Web backend had a network error, trying Supabase fallback:', error);
      
      // Only fallback on network errors, not on HTTP error responses
      if (error.name === 'TypeError' || error.message?.includes('network') || error.message?.includes('fetch')) {
        console.log('Confirmed network error, falling back to Supabase OTP');
      } else {
        return {
          success: false,
          error: 'Authentication failed. Please check your credentials.',
        };
      }
    }
  }
  
  // Fallback to Supabase OTP only for OAuth flow or confirmed network errors
  if (!password) {
    console.log('OAuth flow - using Supabase OTP');
  } else {
    console.log('Network error detected - falling back to Supabase OTP as backup');
  }
  
  const supabaseResult = await sendSupabaseOTP(email);
  return { ...supabaseResult, method: 'supabase' };
}

/**
 * Hybrid verification - handles both web backend and Supabase verification
 */
export async function hybridVerifyCode(email: string, code: string, method?: 'web' | 'supabase'): Promise<{ 
  success: boolean; 
  message?: string; 
  error?: string; 
}> {
  
  // If method is specified, use that approach
  if (method === 'supabase') {
    return await verifySupabaseOTP(email, code);
  }
  
  if (method === 'web') {
    const { verifyCode } = await import('./TwoFactorAuthService');
    return await verifyCode(email, code);
  }
  
  // If no method specified, try web first, then Supabase
  try {
    const { verifyCode } = await import('./TwoFactorAuthService');
    const webResult = await verifyCode(email, code);
    
    if (webResult.success) {
      return webResult;
    }
    
    console.log('Web verification failed, trying Supabase:', webResult.error);
  } catch (error) {
    console.log('Web verification had an error, trying Supabase:', error);
  }
  
  // Fallback to Supabase OTP
  return await verifySupabaseOTP(email, code);
}

export default {
  sendSupabaseOTP,
  verifySupabaseOTP,
  hybridSendVerificationCode,
  hybridVerifyCode,
};