// YtVideoSummarizerScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Linking,
} from 'react-native';

const BACKEND_URL = 'https://ytsummariser-production.up.railway.app/';

export default function YtVideoSummarizerScreen({ navigation }) {
  const [videoUrl, setVideoUrl] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSummarizeVideo = async () => {
    setError('');
    setSummary('');
    if (!videoUrl) {
      setError('Please enter a YouTube video URL.');
      return;
    }

    setLoading(true);
    try {
      const authCheckResponse = await fetch(`${BACKEND_URL}/check-auth`);
      if (!authCheckResponse.ok) {
          let errorMsg = 'Authentication check failed.';
          try {
              const errData = await authCheckResponse.json();
              errorMsg = errData.error || `Auth check failed with status ${authCheckResponse.status}`;
          } catch (parseErr) {
          }
          throw new Error(errorMsg);
      }
      const authStatus = await authCheckResponse.json();

      if (!authStatus.authenticated) {
        setLoading(false);
        Alert.alert(
          'Authentication Required',
          'You need to authenticate with Google to use this feature. After completing the login in your browser, please return to the app and press "Summarize Video" again.',
          [
            {
              text: 'Cancel',
              style: 'cancel',
            },
            {
              text: 'Proceed to Login',
              onPress: async () => {
                try {
                    await Linking.openURL(`${BACKEND_URL}/auth/google`);
                } catch (linkErr) {
                    setError('Could not open authentication link. Please check your internet connection or browser.');
                    console.error("Linking error: ", linkErr);
                }
              },
            },
          ]
        );
        return;
      }

      const response = await fetch(`${BACKEND_URL}/youtube-backend/summarize-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ videoUrl }),
      });

      const data = await response.json();

      if (response.ok) {
        setSummary(data.summary);
      } else {
        setError(data.error || 'Failed to summarize video.');
        if (data.error && (data.error.includes("client is not ready") || data.error.includes("client not initialized"))) {
            setError(data.error + " Please try authenticating again by pressing 'Summarize Video' and choosing 'Proceed to Login'.");
        }
      }
    } catch (err) {
      console.error('Error summarizing video:', err);
      setError(`An unexpected error occurred: ${err.message}. Please ensure you are connected and try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.container}>
          <Text style={styles.title}>YouTube Video Summarizer</Text>

          <TextInput
            style={styles.input}
            placeholder="Enter YouTube Video URL"
            placeholderTextColor="#666666" // Dark gray placeholder
            value={videoUrl}
            onChangeText={setVideoUrl}
            keyboardType="url"
            autoCapitalize="none"
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleSummarizeVideo}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>Summarize Video</Text>
            )}
          </TouchableOpacity>

          {error ? (
            <Text style={styles.errorText}>{error}</Text>
          ) : null}

          {summary ? (
            <View style={styles.summaryContainer}>
              <Text style={styles.summaryTitle}>Summary:</Text>
              <Text style={styles.summaryText}>{summary}</Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F8F8F8', // Light background
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#000000', // Black title
  },
  input: {
    width: '100%',
    height: 50,
    borderColor: '#CCCCCC', // Medium gray border
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    marginBottom: 20,
    fontSize: 16,
    backgroundColor: '#FFFFFF', // White input background
    color: '#000000', // Black text input
  },
  button: {
    backgroundColor: '#000000', // Black button
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF', // White text
    fontSize: 18,
    fontWeight: 'bold',
  },
  errorText: {
    color: '#000000', // Black for error
    marginTop: 10,
    textAlign: 'center',
    fontSize: 14,
  },
  summaryContainer: {
    backgroundColor: '#FFFFFF', // White summary container
    padding: 20,
    borderRadius: 10,
    marginTop: 30,
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 3,
    borderWidth: 1, // Added border
    borderColor: '#E0E0E0', // Light gray border
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#000000', // Black summary title
  },
  summaryText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333333', // Dark gray summary text
  },
});