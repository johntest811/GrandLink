// Ensure polyfills are loaded
import '../utils/polyfills';
import React, { useState, useEffect } from 'react';
import { Image } from 'expo-image';
import { StyleSheet, TextInput, TouchableOpacity, View, ScrollView, ImageBackground, Alert } from 'react-native';
import { Link, Stack, useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Ionicons } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { supabase } from './supabaseClient';
import { resendVerificationCode } from '@/services/TwoFactorAuthService';
import { hybridSendVerificationCode } from '@/services/SupabaseTwoFactorService';
import SecurityService from '@/services/SecurityService';

// Constants
const MAX_LOGIN_ATTEMPTS = 3;
// Ensure any pending web-based auth session completes
WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [lockdownTimer, setLockdownTimer] = useState<number | null>(null);
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const params = useLocalSearchParams();
  
  // FORCE mobile redirect URI - ignore any environment variables that might point to website
  const redirectTo = 'grandlinkmobile://auth/callback';

  // Log redirect URI once on component mount
  useEffect(() => {
    console.log('🚨 MOBILE REDIRECT URI (hardcoded):', redirectTo);
    console.log('📱 App should NEVER redirect to:', process.env.NEXT_PUBLIC_BASE_URL);
  }, []);

  // Check for OAuth errors from callback
  useEffect(() => {
    if (params.error) {
      Alert.alert('Authentication Error', decodeURIComponent(params.error as string));
    }
  }, [params.error]);

  // Check for initial session on app startup and lockdown status
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check if email is locked on component mount
        if (email.trim()) {
          const lockoutCheck = await SecurityService.isAccountLocked(email.trim().toLowerCase());
          if (lockoutCheck.isLocked && lockoutCheck.remainingMinutes) {
            setLockdownTimer(lockoutCheck.remainingMinutes);
          }
        }
      } catch (error) {
        console.warn('Could not check lockdown status:', error);
      }
    };

    initializeApp();

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth event:', event, 'Session:', !!session);
      
      // Only handle initial session check - don't auto-redirect on new sign-ins
      // as they now go through 2FA verification
      if (event === 'INITIAL_SESSION') {
        if (session?.user) {
          // User already authenticated, go to homepage
          router.replace('/(tabs)/homepage');
        }
      }
    });
    
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Lockdown timer effect - only depend on lockdownTimer, not email
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    
    if (lockdownTimer && lockdownTimer > 0) {
      interval = setInterval(async () => {
        if (email.trim()) {
          const lockoutCheck = await SecurityService.isAccountLocked(email.trim().toLowerCase());
          if (lockoutCheck.isLocked && lockoutCheck.remainingMinutes) {
            setLockdownTimer(lockoutCheck.remainingMinutes);
          } else {
            setLockdownTimer(null);
          }
        } else {
          setLockdownTimer(null);
        }
      }, 1000); // Update every second
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [lockdownTimer]); // Remove email dependency to prevent triggering on every keystroke

  // Email validation function
  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email.trim());
  };

  const handleLogin = async () => {
    setLoading(true);
    
    try {
      // Validate inputs
      if (!email.trim() || !password) {
        Alert.alert('Login Failed', 'Please enter both email and password');
        setLoading(false);
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      
      // Validate email format FIRST before any API calls
      if (!isValidEmail(normalizedEmail)) {
        Alert.alert(
          'Invalid Email Format',
          'Please enter a valid email address (e.g., user@example.com)',
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      const deviceInfo = SecurityService.getDeviceInfo();

      console.log('Starting login flow for email:', normalizedEmail);

      // Check if account is currently locked
      const lockoutCheck = await SecurityService.isAccountLocked(normalizedEmail);
      if (lockoutCheck.isLocked) {
        setLockdownTimer(lockoutCheck.remainingMinutes || 1);
        Alert.alert(
          '🔒 Account Temporarily Locked',
          `Your account has been temporarily locked due to multiple failed login attempts.\n\nTry again in ${lockoutCheck.remainingMinutes} minute(s).\n\nA security alert has been sent to your email.`,
          [{ text: 'OK' }]
        );
        setLoading(false);
        return;
      }

      console.log('Starting 2FA login flow for email:', normalizedEmail);

      // Use hybrid approach - tries web backend first, falls back to Supabase OTP
      const result = await hybridSendVerificationCode(normalizedEmail, password);
      
      if (!result.success) {
        console.log('Login failed:', result.error);
        console.log('Full result object:', JSON.stringify(result, null, 2));
        
        // Check the type of error to determine if lockdown should be triggered
        const errorMessage = result.error?.toLowerCase() || '';
        console.log('Normalized error message:', errorMessage);
        
        // These errors indicate the email doesn't exist or is invalid - NO LOCKDOWN
        // Be very specific about what constitutes "email not found" vs authentication failure
        const isEmailInvalidError = errorMessage.includes('user not found') || 
                                   errorMessage.includes('email not found') || 
                                   errorMessage.includes('user does not exist') ||
                                   errorMessage.includes('email does not exist') ||
                                   errorMessage.includes('no user found') ||
                                   errorMessage.includes('account not found') ||
                                   errorMessage.includes('unrecognized') ||
                                   errorMessage.includes('unknown user') ||
                                   errorMessage.includes('user not registered') ||
                                   errorMessage.includes('no account') ||
                                   errorMessage.includes('signup required');
        
        // NOTE: "Invalid email or password" should NOT be treated as email not found
        // It's an authentication failure that should trigger lockdown
        
        // These errors indicate network/system issues - NO LOCKDOWN  
        const isNetworkError = errorMessage.includes('network') ||
                              errorMessage.includes('connection') ||
                              errorMessage.includes('timeout') ||
                              errorMessage.includes('server error') ||
                              errorMessage.includes('service unavailable') ||
                              errorMessage.includes('cors') ||
                              errorMessage.includes('fetch');
        
        console.log('Error classification:', {
          isEmailInvalidError,
          isNetworkError,
          errorMessage
        });
        
        if (isEmailInvalidError) {
          // Email doesn't exist or invalid format - show error but NO lockdown
          Alert.alert(
            'Login Failed',
            'No account found with this email address. Please check your email or create a new account.',
            [{ text: 'OK' }]
          );
        } else if (isNetworkError) {
          // Network error - show error but NO lockdown
          Alert.alert(
            'Connection Error',
            'Unable to connect to the server. Please check your internet connection and try again.',
            [{ text: 'OK' }]
          );
        } else {
          // For all other errors (including wrong password), trigger lockdown logic
          // This includes password errors and any other authentication failures
          console.log('Treating as password/authentication error, triggering security logic');
          const failureResult = await SecurityService.handleFailedLogin(
            normalizedEmail, 
            deviceInfo
          );

          if (failureResult.shouldLockout) {
            setLockdownTimer(failureResult.lockoutMinutes || 1);
            Alert.alert(
              '🔒 Account Locked',
              `Too many failed attempts. Your account has been locked for ${failureResult.lockoutMinutes} minute(s).\n\nA security alert has been sent to your email.`,
              [{ text: 'OK' }]
            );
          } else {
            const remainingAttempts = MAX_LOGIN_ATTEMPTS - failureResult.failedAttempts;
            Alert.alert(
              'Login Failed',
              `${result.error}\n\n⚠️ Warning: ${remainingAttempts} attempt(s) remaining before account lockout.`
            );
          }
        }
        
        setLoading(false);
        return;
      }

      // Success - record successful login attempt
      await SecurityService.recordLoginAttempt(normalizedEmail, true, deviceInfo);
      await SecurityService.clearFailedAttempts(normalizedEmail);

      console.log('Verification code sent via:', result.method);

      // Success - navigate to verification screen with email, password, and method
      router.push({
        pathname: '/verify-code',
        params: {
          email: normalizedEmail,
          password: password,
          method: result.method || 'web',
        },
      });
    } catch (err: any) {
      console.error('Login error:', err);
      Alert.alert('Login Failed', 'An unexpected error occurred. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      
      // Clear any existing session first
      await supabase.auth.signOut();

      console.log('Starting Google OAuth with redirect:', redirectTo);

      // Get the OAuth URL but let the dedicated callback handle the redirect
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          skipBrowserRedirect: true, // Critical: We handle the browser flow manually
          queryParams: {
            access_type: 'offline',
            prompt: 'select_account',
          },
        },
      });

      if (error || !data?.url) {
        console.error('OAuth setup error:', error);
        Alert.alert('Google Login Failed', error?.message ?? 'Missing OAuth URL');
        return;
      }

      console.log('Opening auth session with URL:', data.url);

      // Use WebBrowser to handle the OAuth flow - it will redirect to our callback
      const result = await WebBrowser.openAuthSessionAsync(
        data.url, 
        redirectTo,
        {
          showInRecents: false,
          preferEphemeralWebSession: true,
        }
      );
      
      console.log('Auth session result:', result);
      
      if (result.type === 'cancel') {
        console.log('User cancelled OAuth');
        return;
      }
      
      if (result.type !== 'success' || !result.url) {
        console.log('OAuth failed or no URL returned:', result);
        Alert.alert('Google Login Failed', 'Authentication was not completed');
        return;
      }

      console.log('OAuth redirect URL received:', result.url);

      // Parse callback URL for implicit tokens first, then PKCE code as fallback
      let authCode: string | null = null;
      let accessToken: string | null = null;
      let refreshToken: string | null = null;
      try {
        const callbackUrl = new URL(result.url);
        authCode = callbackUrl.searchParams.get('code');
        accessToken = callbackUrl.searchParams.get('access_token');
        refreshToken = callbackUrl.searchParams.get('refresh_token');

        // Fallback: some providers place values in hash fragment
        if ((!authCode || !accessToken) && callbackUrl.hash) {
          const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''));
          authCode = hashParams.get('code');
          accessToken = accessToken || hashParams.get('access_token');
          refreshToken = refreshToken || hashParams.get('refresh_token');
        }
      } catch (parseError) {
        console.error('Failed to parse OAuth callback URL:', parseError);
      }

      let userEmail: string | undefined;

      if (accessToken && refreshToken) {
        console.log('Setting OAuth session from callback tokens...');
        const { data: sessionData, error: setSessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (setSessionError || !sessionData?.session?.user) {
          console.error('Set session error:', setSessionError);
          Alert.alert('Google Login Failed', setSessionError?.message ?? 'Failed to create user session');
          return;
        }

        userEmail = sessionData.session.user.email;
      } else if (authCode) {
        console.log('Exchanging OAuth code for session...');
        const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);

        if (exchangeError || !sessionData?.session?.user) {
          console.error('Session exchange error:', exchangeError);
          Alert.alert('Google Login Failed', exchangeError?.message ?? 'Failed to create user session');
          return;
        }

        userEmail = sessionData.session.user.email;
      } else {
        Alert.alert('Google Login Failed', 'No authentication details found in callback URL');
        return;
      }

      if (!userEmail) {
        Alert.alert('Google Login Failed', 'Google account has no email address');
        return;
      }

      console.log('OAuth successful, sending 2FA verification code...');
      const verificationResult = await resendVerificationCode(userEmail);

      if (!verificationResult.success) {
        console.error('Failed to send 2FA code for OAuth user:', verificationResult.error);
        // Keep backward compatibility in case email service is temporarily down
        router.replace('/(tabs)/homepage');
        return;
      }

      router.replace({
        pathname: '/verify-code',
        params: {
          email: userEmail,
          password: '',
          isOAuth: 'true',
        },
      });
    } catch (err: any) {
      console.error('Google login error:', err);
      Alert.alert('Google Login Failed', err?.message ?? 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ImageBackground
        source={require('@/assets/images/loginbg.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <ThemedView style={styles.container}>

            {/* Login Card */}
            <View style={styles.card}>
              {/* Logo at the top */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('@/assets/images/grandeast_transparent.png')}
                  style={styles.logo}
                  contentFit="contain"
                />
                <ThemedText type="title" style={styles.logoText}>GRAND EAST</ThemedText>
                <ThemedText style={styles.logoSubtext}>GLASS AND ALUMINIUM</ThemedText>
              </View>
              <ThemedText type="title" style={styles.loginTitle}>Login</ThemedText>

              {/* Email Input */}
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Email</ThemedText>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Please Enter your Email Address"
                    placeholderTextColor="#696969ff"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputContainer}>
                <ThemedText style={styles.inputLabel}>Password</ThemedText>
                <View style={styles.inputWrapper}>
                  <TextInput
                    style={styles.input}
                    placeholder="Please Enter your password"
                    placeholderTextColor="#696969ff"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPressIn={() => setShowPassword(true)}
                    onPressOut={() => setShowPassword(false)}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name={showPassword ? "eye" : "eye-off"} 
                      size={20} 
                      color="#666" 
                    />
                  </TouchableOpacity>
                </View>                
                {/* Lockdown Timer */}
                {lockdownTimer && lockdownTimer > 0 && (
                  <View style={styles.lockdownContainer}>
                    <Ionicons name="time-outline" size={16} color="#dc2626" />
                    <ThemedText style={styles.lockdownText}>
                      Account locked - Try again in {lockdownTimer}m
                    </ThemedText>
                  </View>
                )}
                                <TouchableOpacity style={styles.forgotPasswordContainer} onPress={() => router.push('/forgot-password')}>
                  <ThemedText style={[styles.forgotPassword]}>Forgot Password</ThemedText>
                </TouchableOpacity>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                style={[styles.loginButton, { backgroundColor: '#000000ff' }]}
                onPress={handleLogin}
                disabled={loading}
              >
                <ThemedText style={styles.loginButtonText}>
                  {loading ? 'Logging in...' : 'LOGIN'}
                </ThemedText>
              </TouchableOpacity>

              {/* Google Sign In */}
              <TouchableOpacity style={styles.googleButton} onPress={handleGoogleLogin}>
                <Image
                  source={{ uri: 'https://developers.google.com/identity/images/g-logo.png' }}
                  style={styles.googleIcon}
                  contentFit="contain"
                />
                <ThemedText style={styles.googleButtonText}>Sign in with Google</ThemedText>
              </TouchableOpacity>

              {/* Sign Up Link */}
              <View style={styles.signupContainer}>
                <ThemedText style={[styles.signupText]}>Don’t have an account yet?</ThemedText>
                <Link href="/register">
                  <ThemedText style={[styles.signupLink]}>Sign Up</ThemedText>
                </Link>
              </View>
            </View>
          </ThemedView>
        </ScrollView>
      </ImageBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'transparent', // Make container transparent
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 0,
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: -10,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#803838ff', // White text for better contrast on background
    textShadowColor: 'rgba(0, 0, 0, 0.75)', // Add text shadow for readability
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  logoSubtext: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#050505ff', // White text
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.95)', // Slightly transparent white
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  loginTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B0000',
    marginBottom: 20,
    textAlign: 'center',
  },
  inputContainer: {
    marginBottom: 15,
  },
  inputLabel: {
    marginBottom: 5,
    fontWeight: '600',
    color: '#080808ff',
  },
  inputWrapper: {
    borderWidth: 1,
    borderColor: '#323232ff',
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 15,
    fontSize: 13,
    color: '#000000', // Make text black instead of white
  },
  eyeIcon: {
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginTop: 5,
  },
  forgotPassword: {
    fontSize: 14,
    color: '#000000ff',
    textDecorationLine: 'underline',
  },
  loginButton: {
    backgroundColor: '#271414ff',
    borderRadius: 5,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 15,
  },
  loginButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButtonPress: {
    marginBottom: 10,
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#000000ff',
    borderRadius: 5,
    paddingVertical: 10,
    marginBottom: 20,

  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleButtonText: {
    fontSize: 16,
    color: '#000000ff',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    color: '#000000ff',
  },
  signupLink: {
    fontWeight: 'bold',
    color: '#8f4545ff',
  },
  signupText: {
    fontSize: 14,
    color: '#000000ff',
    marginRight: 8,
  },
  lockdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  lockdownText: {
    fontSize: 12,
    color: '#dc2626',
    marginLeft: 6,
    fontWeight: '500',
  },
});