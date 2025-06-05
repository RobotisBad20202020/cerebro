import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';

const BACKEND_URL = 'https://backendmemozise-production.up.railway.app';

export default function GoogleLoginScreen({ onLoginSuccess }) {
  const [loading, setLoading] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const pollingRef = useRef(null);

  // Poll backend every 3 seconds to check if user is authenticated
  const startPollingAuthStatus = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const authCheck = await fetch(`${BACKEND_URL}/check-auth`, {
          credentials: 'include', // important if backend uses cookies
        });
        const authStatus = await authCheck.json();
        if (authStatus.authenticated) {
          setAuthenticated(true);
          clearInterval(pollingRef.current);
          Alert.alert('Login successful!', 'You are now logged in.');
          if (onLoginSuccess) onLoginSuccess();
        }
      } catch (err) {
        console.warn('Auth polling error:', err);
      }
    }, 3000);
  };

  const handleLogin = async () => {
    try {
      setLoading(true);
      await Linking.openURL(`${BACKEND_URL}/auth/google`);
      Alert.alert(
        'Complete Login',
        'Please complete Google login in the browser, then return to the app.'
      );
      startPollingAuthStatus();
    } catch (err) {
      Alert.alert('Error', 'Failed to open login page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return (
    <View style={styles.container}>
      {!authenticated ? (
        <TouchableOpacity
          style={styles.loginButton}
          onPress={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.loginButtonText}>Login with Google</Text>
          )}
        </TouchableOpacity>
      ) : (
        <Text style={styles.successText}>You are logged in!</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loginButton: {
    backgroundColor: '#4285F4',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 6,
  },
  loginButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  successText: {
    fontSize: 18,
    color: 'green',
    fontWeight: 'bold',
  },
});
