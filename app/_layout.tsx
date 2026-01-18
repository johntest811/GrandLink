import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { Slot } from 'expo-router';
import { AppContextProvider } from '../context/AppContext';
import * as WebBrowser from 'expo-web-browser';

// Ignore specific warnings that cause rendering issues in LogBox
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Text strings must be rendered within a <Text> component',
]);

export default function RootLayout() {
  // Complete any pending auth sessions from WebBrowser (OAuth flows)
  WebBrowser.maybeCompleteAuthSession();
  return (
    <AppContextProvider>
      <Slot />
    </AppContextProvider>
  );
}
