// Services for 2-Factor Authentication functionality
// This connects the mobile app to the existing web backend 2FA system

const API_BASE_URL = 'https://grandlnik-website.vercel.app';

export interface TwoFactorAuthService {
  // Send verification code to email after password verification
  sendVerificationCode: (email: string, password: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  
  // Resend verification code
  resendVerificationCode: (email: string) => Promise<{ success: boolean; message?: string; error?: string }>;
  
  // Verify the 6-digit code
  verifyCode: (email: string, code: string) => Promise<{ success: boolean; message?: string; error?: string }>;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Send verification code after password verification
 * Uses the existing web backend endpoint /api/auth/request-magic-link
 */
export async function sendVerificationCode(email: string, password: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    console.log('Sending verification code for email:', email);
    console.log('API URL:', `${API_BASE_URL}/api/auth/request-magic-link`);
    
    const requestBody = {
      email: email.trim().toLowerCase(),
      password,
    };
    
    console.log('Request body:', { ...requestBody, password: '[HIDDEN]' });

    const response = await fetch(`${API_BASE_URL}/api/auth/request-magic-link`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    console.log('Send code response status:', response.status);

    let data;
    try {
      data = await response.json();
      console.log('Send code response data:', data);
    } catch (parseError) {
      console.error('Failed to parse send code response as JSON:', parseError);
      const textData = await response.text();
      console.log('Send code response as text:', textData);
      return {
        success: false,
        error: 'Server returned invalid response',
      };
    }

    if (!response.ok) {
      console.error('Send verification code failed:', response.status, 'Error:', data.error);
      return {
        success: false,
        error: data.error || 'Failed to send verification code',
      };
    }

    console.log('Verification code sent successfully');
    return {
      success: true,
      message: data.message || 'Verification code sent to your email',
    };
  } catch (error: any) {
    console.error('Error sending verification code:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
}

/**
 * Resend verification code  
 * Uses the existing web backend endpoint /api/auth/send-verification-code
 */
export async function resendVerificationCode(email: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/send-verification-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        resend: true,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error || 'Failed to resend verification code',
      };
    }

    return {
      success: true,
      message: data.message || 'Verification code resent to your email',
    };
  } catch (error: any) {
    console.error('Error resending verification code:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
}

/**
 * Verify the 6-digit code
 * Uses the existing web backend endpoint /api/auth/send-verification-code (PUT method)
 */
export async function verifyCode(email: string, code: string): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const normalizedEmail = email.trim().toLowerCase();
    const sanitizedCode = code.replace(/\D/g, '').slice(0, 6);

    if (sanitizedCode.length !== 6) {
      return {
        success: false,
        error: 'Please enter a valid 6-digit code.',
      };
    }

    console.log('Attempting to verify code for email:', normalizedEmail);
    console.log('Code length:', sanitizedCode.length);
    console.log('API URL:', `${API_BASE_URL}/api/auth/send-verification-code`);
    
    const requestBody = {
      email: normalizedEmail,
      code: sanitizedCode,
    };
    
    console.log('Request body:', requestBody);

    for (let attempt = 1; attempt <= 2; attempt++) {
      const response = await fetch(`${API_BASE_URL}/api/auth/send-verification-code`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      console.log(`Verification attempt ${attempt} status:`, response.status);

      let data: any;
      try {
        data = await response.json();
        console.log(`Verification attempt ${attempt} response:`, data);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        return {
          success: false,
          error: 'Server returned invalid response',
        };
      }

      if (response.ok) {
        return {
          success: true,
          message: data.message || 'Code verified successfully',
        };
      }

      const normalizedError = String(data?.error || '').toLowerCase();
      const noCodeFound =
        response.status === 404 &&
        (normalizedError.includes('no verification code found') || normalizedError.includes('verification code'));

      const shouldRetry =
        attempt === 1 &&
        noCodeFound;

      if (shouldRetry) {
        console.warn('Verification code not yet available on first attempt, retrying once...');
        await delay(900);
        continue;
      }

      if (noCodeFound) {
        // Recovery path: some backend flows invalidate the previous code after a failed verification.
        const resendResult = await resendVerificationCode(normalizedEmail);
        if (resendResult.success) {
          return {
            success: false,
            error: 'Your previous code is no longer valid. A new 6-digit code was sent to your email. Please enter the latest code.',
          };
        }

        return {
          success: false,
          error: 'No active verification code was found. Please tap Resend Code and try again.',
        };
      }

      console.error('Verification failed with status:', response.status, 'Error:', data?.error);
      return {
        success: false,
        error: data?.error || `Server error (${response.status})`,
      };
    }

    return {
      success: false,
      error: 'Verification failed. Please try again.',
    };
  } catch (error: any) {
    console.error('Network error during code verification:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
    return {
      success: false,
      error: 'Network error. Please check your connection.',
    };
  }
}

/**
 * Complete 2FA flow - verify code and sign in with Supabase
 * This combines the verification with the actual Supabase authentication
 */
export async function complete2FA(
  email: string, 
  password: string, 
  code: string,
  supabaseClient: any
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // First verify the code
    const verifyResult = await verifyCode(email, code);
    
    if (!verifyResult.success) {
      return verifyResult;
    }

    // Code is valid, now sign in with Supabase
    const { error: signInError } = await supabaseClient.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return {
        success: false,
        error: 'Authentication failed. Please try again.',
      };
    }

    return {
      success: true,
      message: 'Successfully authenticated',
    };
  } catch (error: any) {
    console.error('Error completing 2FA:', error);
    return {
      success: false,
      error: 'An error occurred during authentication.',
    };
  }
}

// Default export with all service functions
export const TwoFactorAuthAPI = {
  sendVerificationCode,
  resendVerificationCode,
  verifyCode,
  complete2FA,
};