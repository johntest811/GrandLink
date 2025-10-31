import { Redirect } from 'expo-router';
import React from 'react';

export default function Index() {
  // Redirect to the homepage when the app starts
  // Users can browse without logging in
  return <Redirect href="/(tabs)/homepage" />;
}