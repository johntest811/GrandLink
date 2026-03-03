import 'dotenv/config';

export default {
  expo: {
    name: "Grand East",
    slug: "grandlink_mobile",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/GLLogo.png",
    scheme: "grandlinkmobile",
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.grandlink.mobile"
    },
    android: {
      package: "com.grandlink.mobile",
      adaptiveIcon: {
        foregroundImage: "./assets/images/GLLogo.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-router",
      "expo-asset",
      [
        "expo-splash-screen",
        {
          image: "./assets/images/GLLogo.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#ffffff"
        }
      ],
      [
        "expo-camera",
        {
          cameraPermission: "Allow $(PRODUCT_NAME) to access your camera for AR measurements."
        }
      ]
    ],
    // Remove autolinking exclude for expo-camera if present
    experiments: {
      typedRoutes: true
    },
    extra: {
      eas: {
        projectId: "eb4d21ae-6b10-44c4-b553-c1b39eb94446",
      },
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      googleWebClientId: process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      googleAndroidClientIdDebug: process.env.NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_DEBUG,
      googleAndroidClientIdRelease: process.env.NEXT_PUBLIC_GOOGLE_ANDROID_CLIENT_ID_RELEASE,
      // Payments (Note: secrets here will be embedded in the app build. Prefer a backend for production.)
      paymongoSecretKey: process.env.PAYMONGO_SECRET_KEY,
      paymongoPublicKey: process.env.PAYMONGO_PUBLIC_KEY,
      paypalClientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID,
      paypalClientSecret: process.env.PAYPAL_CLIENT_SECRET,
      paypalEnvironment: process.env.PAYPAL_ENVIRONMENT || 'sandbox',
      baseUrl: process.env.NEXT_PUBLIC_BASE_URL,
    }
  }
};
