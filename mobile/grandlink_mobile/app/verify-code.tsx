import React, { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  Alert, 
  ImageBackground, 
  ScrollView,
  ActivityIndicator,
  BackHandler
} from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Image } from 'expo-image';
import { supabase } from './supabaseClient';
import { resendVerificationCode } from '@/services/TwoFactorAuthService';
import { hybridVerifyCode, sendSupabaseOTP } from '@/services/SupabaseTwoFactorService';
import SecurityService from '@/services/SecurityService';

export default function VerifyCodeScreen() {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOAuth, setIsOAuth] = useState(false);
  const [method, setMethod] = useState<'web' | 'supabase'>('web');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const params = useLocalSearchParams();

  useEffect(() => {
    // Get email, password, OAuth flag, and method from params
    if (params.email) {
      setEmail(params.email as string);
    }
    if (params.password) {
      setPassword(params.password as string);
    }
    if (params.isOAuth === 'true') {
      setIsOAuth(true);
    }
    if (params.method) {
      setMethod(params.method as 'web' | 'supabase');
    }
  }, [params]);

  useFocusEffect(
    React.useCallback(() => {
      // On Android hardware back, force users back to login from verify screen.
      const onBackPress = () => {
        router.replace('/login');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [])
  );

  const handleChange = (index: number, value: string) => {
    const newCode = [...code];
    newCode[index] = value.replace(/[^0-9]/g, ''); // Only allow numbers
    setCode(newCode);
    setError('');

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    // Handle backspace: focus previous input
    if (key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (pastedText: string) => {
    const pastedData = pastedText.replace(/\D/g, '').slice(0, 6);
    const newCode = [...code];
    
    for (let i = 0; i < pastedData.length; i++) {
      newCode[i] = pastedData[i];
    }
    
    setCode(newCode);
    setError('');
    
    // Focus last filled input or next empty
    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };

  const handleVerify = async () => {
    const verificationCode = code.join('');
    
    if (verificationCode.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('Verifying code with method:', method, 'isOAuth:', isOAuth);
      
      // Use hybrid verification which tries multiple approaches
      const result = await hybridVerifyCode(email, verificationCode, method);
      
      if (!result.success) {
        setError(result.error || 'Invalid verification code');
        setLoading(false);
        return;
      }

      console.log('Code verified successfully');

      // Clear any failed login attempts for this user
      await SecurityService.clearFailedAttempts(email);

      // If this is not OAuth flow and we're using web method, we need to sign in with Supabase
      if (!isOAuth && method === 'web' && password) {
        console.log('Completing Supabase sign-in for verified user');
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          console.error('Supabase sign-in error after verification:', signInError);
          setError('Authentication completed but login failed. Please try again.');
          setLoading(false);
          return;
        }
      }

      // Record successful login
      await SecurityService.recordLoginAttempt(email, true, SecurityService.getDeviceInfo());

      // Success - navigate to homepage
      router.replace('/(tabs)/homepage');
    } catch (err: any) {
      console.error('Verification error:', err);
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError('');

    try {
      console.log('Resending code with method:', method, 'isOAuth:', isOAuth);

      let result: { success: boolean; message?: string; error?: string; method?: 'web' | 'supabase' };

      if (method === 'web' && !isOAuth) {
        // Force resend to use verification-code endpoint only (never magic-link request flow).
        result = await resendVerificationCode(email);
      } else {
        // OAuth/Supabase path still sends a one-time code via Supabase OTP.
        result = await sendSupabaseOTP(email);
        if (result.success) {
          result.method = 'supabase';
        }
      }
      
      if (!result.success) {
        setError(result.error || 'Failed to resend code');
      } else {
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        
        // Update method if it changed during resend
        if (result.method && result.method !== method) {
          setMethod(result.method);
        }
        
        Alert.alert('Success', result.message || 'Verification code sent to your email!');
      }
    } catch (err: any) {
      console.error('Resend error:', err);
      setError('Failed to resend code');
    } finally {
      setResending(false);
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
          <View style={styles.container}>
            <View style={styles.card}>
              {/* Logo */}
              <View style={styles.logoContainer}>
                <Image
                  source={require('@/assets/images/GRANDEASTLOGO.png')}
                  style={styles.logo}
                  contentFit="contain"
                />
                <Text style={styles.logoText}>GRAND EAST</Text>
                <Text style={styles.logoSubtext}>GLASS AND ALUMINIUM</Text>
              </View>

              <Text style={styles.title}>Enter Verification Code</Text>
              
              <Text style={styles.subtitle}>
                We sent a 6-digit code to
              </Text>
              <Text style={styles.email}>{email}</Text>
              
              {isOAuth && (
                <Text style={styles.oauthNote}>
                  Complete your Google sign-in by verifying your email
                </Text>
              )}
              
              {__DEV__ && (
                <Text style={styles.debugText}>
                  Method: {method} {isOAuth ? '(OAuth)' : '(Password)'}
                </Text>
              )}

              {/* Error message */}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              {/* Code input */}
              <View style={styles.codeContainer}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(ref) => {
                      inputRefs.current[index] = ref;
                    }}
                    style={[
                      styles.codeInput,
                      digit ? styles.codeInputFilled : null,
                      error ? styles.codeInputError : null,
                    ]}
                    value={digit}
                    onChangeText={(value) => handleChange(index, value)}
                    onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    textAlign="center"
                    selectTextOnFocus
                    onPaste={(event) => {
                      const pastedText = event.nativeEvent.items?.[0]?.data || '';
                      handlePaste(pastedText);
                    }}
                  />
                ))}
              </View>

              {/* Verify button */}
              <TouchableOpacity
                style={[styles.verifyButton, loading && styles.buttonDisabled]}
                onPress={handleVerify}
                disabled={loading}
              >
                {loading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator color="white" size="small" />
                    <Text style={styles.buttonText}>Verifying...</Text>
                  </View>
                ) : (
                  <Text style={styles.buttonText}>Verify & Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Resend code */}
              <View style={styles.resendContainer}>
                <Text style={styles.resendText}>Didn&apos;t receive the code?</Text>
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resending}
                  style={styles.resendButton}
                >
                  <Text style={styles.resendButtonText}>
                    {resending ? 'Sending...' : 'Resend Code'}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Back to login */}
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => router.replace('/login')}
              >
                <Text style={styles.backButtonText}>← Back to Login</Text>
              </TouchableOpacity>

              {/* Security note */}
              <Text style={styles.securityText}>
                🔒 Your code will expire in 10 minutes
              </Text>
            </View>
          </View>
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
    backgroundColor: 'transparent',
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 10,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    alignItems: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  logo: {
    width: 60,
    height: 60,
    marginBottom: 10,
  },
  logoText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#803838ff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  logoSubtext: {
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: '#050505ff',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#8B0000',
    marginBottom: 10,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 5,
  },
  email: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#8B1C1C',
    textAlign: 'center',
    marginBottom: 20,
  },
  oauthNote: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 15,
  },
  debugText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  errorText: {
    color: '#dc2626',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
    gap: 8,
  },
  codeInput: {
    width: 45,
    height: 55,
    borderWidth: 2,
    borderColor: '#d1d5db',
    borderRadius: 8,
    fontSize: 24,
    fontWeight: 'bold',
    backgroundColor: 'white',
  },
  codeInputFilled: {
    borderColor: '#8B1C1C',
    backgroundColor: '#f9f9f9',
  },
  codeInputError: {
    borderColor: '#dc2626',
  },
  verifyButton: {
    backgroundColor: '#000000ff',
    borderRadius: 8,
    paddingVertical: 15,
    paddingHorizontal: 30,
    alignItems: 'center',
    marginBottom: 20,
    width: '100%',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  resendText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 5,
  },
  resendButton: {
    padding: 5,
  },
  resendButtonText: {
    fontSize: 14,
    color: '#8B1C1C',
    fontWeight: '600',
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  securityText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});