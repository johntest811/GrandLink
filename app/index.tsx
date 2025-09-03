import { Redirect } from 'expo-router';
import React from 'react';

export default function Index() {
  // Redirect to the login page when the app starts
  return <Redirect href="/login" />;
}