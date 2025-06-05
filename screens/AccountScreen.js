// AccountScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getAuth, signOut, deleteUser } from 'firebase/auth';
import { app } from '../firebaseConfig';
import { useNavigation } from '@react-navigation/native';

const auth = getAuth(app);

export default function AccountScreen() {
  const [userEmail, setUserEmail] = useState('');
  const navigation = useNavigation();

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser) {
      setUserEmail(currentUser.email || 'No email available');
    }
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      // navigation.replace('SignIn'); // Navigation handled by Auth listener in App.js
    } catch (error) {
      Alert.alert('Logout Error', error.message);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action is irreversible.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const user = auth.currentUser;
              if (user) {
                await deleteUser(user);
                Alert.alert('Account Deleted', 'Your account has been successfully deleted.');
                // navigation.replace('SignIn'); // Navigation handled by Auth listener in App.js
              }
            } catch (error) {
              console.error('Error deleting account:', error);
              // Handle re-authentication requirement for recent logins
              if (error.code === 'auth/requires-recent-login') {
                Alert.alert(
                  'Re-authentication Required',
                  'Please sign in again to confirm your identity before deleting your account.'
                );
                // You might want to navigate to a re-authentication screen here
              } else {
                Alert.alert('Deletion Failed', error.message);
              }
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Account Information</Text>
      <View style={styles.infoCard}>
        <Text style={styles.label}>Logged in as:</Text>
        <Text style={styles.emailText}>{userEmail}</Text>
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutButtonText}>Sign Out</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteAccount}>
        <Text style={styles.deleteButtonText}>Delete Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F8F8F8', // Very light gray background
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#000000', // Pure black
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#FFFFFF', // White card background
    padding: 20,
    borderRadius: 10,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 30,
    borderWidth: 1, // Subtle border
    borderColor: '#E0E0E0', // Light gray border
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  label: {
    fontSize: 16,
    color: '#333333', // Dark gray text
    marginBottom: 8,
    fontWeight: '500',
  },
  emailText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000', // Pure black email
    textAlign: 'center',
  },
  logoutButton: {
    backgroundColor: '#000000', // Black button
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 8,
    width: '90%',
    maxWidth: 300,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  logoutButtonText: {
    color: '#FFFFFF', // White text
    fontSize: 16,
    fontWeight: 'bold',
  },
  deleteButton: {
    backgroundColor: '#FFFFFF', // White background for destructive action
    paddingVertical: 14,
    paddingHorizontal: 25,
    borderRadius: 8,
    width: '90%',
    maxWidth: 300,
    alignItems: 'center',
    borderWidth: 1, // Prominent border
    borderColor: '#CCCCCC', // Gray border for 'destructive' feel in B&W
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  deleteButtonText: {
    color: '#333333', // Darker gray for warning text
    fontSize: 16,
    fontWeight: 'bold',
  },
});