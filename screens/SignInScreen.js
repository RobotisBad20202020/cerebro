// SignInScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  SafeAreaView,
} from 'react-native';

import { auth } from '../firebaseConfig';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';


export default function SignInScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigation.replace('MainTabs');
      } else {
        console.log('User is currently signed out.');
      }
    });

    return () => unsubscribe();
  }, [navigation]);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User signed in successfully:', user.email);
    } catch (error) {
      console.error('Sign-in error:', error.message);
      Alert.alert('Sign-in Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      console.log('User signed up successfully:', user.email);
      Alert.alert('Success', 'Account created! Please sign in.');
      setEmail('');
      setPassword('');
    } catch (error) {
      console.error('Sign-up error:', error.message);
      Alert.alert('Sign-up Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Memozise</Text> {/* App Name */}
        <Text style={styles.subtitle}>Sign In or Sign Up</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666666" // Dark gray placeholder
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666666" // Dark gray placeholder
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {loading ? (
          <ActivityIndicator size="large" color="#000000" style={styles.loadingIndicator} /> 
        ) : (
          <>
            <TouchableOpacity style={styles.button} onPress={handleSignIn}>
              <Text style={styles.buttonText}>Sign In</Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.button, styles.secondaryButton]} onPress={handleSignUp}>
              <Text style={styles.secondaryButtonText}>Sign Up</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F8F8', // Light background
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 36, // Slightly larger title
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000', // Black title
  },
  subtitle: {
    fontSize: 18,
    color: '#666666', // Medium gray subtitle
    marginBottom: 40,
  },
  input: {
    width: '100%',
    height: 50,
    backgroundColor: '#FFFFFF', // White input background
    borderRadius: 8,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#000000', // Black text input
    borderColor: '#CCCCCC', // Medium gray border
    borderWidth: 1,
    marginBottom: 15,
  },
  button: {
    width: '100%',
    height: 50,
    backgroundColor: '#000000', // Black button
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF', // White text
    fontSize: 18,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    marginTop: 15,
    borderColor: '#000000', // Black border
    borderWidth: 2,
    shadowColor: 'transparent', // Remove shadow for secondary
    elevation: 0,
  },
  secondaryButtonText: {
    color: '#000000', // Black text
    fontSize: 18,
    fontWeight: 'bold',
  },
  loadingIndicator: {
    marginTop: 20,
  },
});