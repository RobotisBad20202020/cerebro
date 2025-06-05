// NoteMakerScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export default function NoteMakerScreen() {
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [noteLength, setNoteLength] = React.useState('300');
  const [title, setTitle] = React.useState('');
  const navigation = useNavigation();

  const BACKEND_URL = 'https://backendmemozise-production.up.railway.app';

  const formatChemicals = (text) => {
    const subNumbers = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
    const superNumbers = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];
    const superSigns = { '+': '⁺', '-': '⁻' };

    const parts = [];
    let lastIndex = 0;
    const regex = /([A-Z][a-z]*)(\d*)(\^?[-+]?\d*[+-]?)/g;

    let match;
    while ((match = regex.exec(text)) !== null) {
      const [full, element, subscript, charge] = match;

      if (match.index > lastIndex) {
        parts.push(<Text key={lastIndex}>{text.slice(lastIndex, match.index)}</Text>);
      }

      parts.push(<Text key={match.index}>{element}</Text>);

      if (subscript) {
        parts.push(
          <Text key={match.index + '-sub'} style={{ fontSize: 12, lineHeight: 20 }}>
            {subscript.split('').map((char) => subNumbers[parseInt(char)] || char).join('')}
          </Text>
        );
      }

      if (charge && charge !== '') {
        const formattedCharge = charge.replace(/\^?([-+]?\d*)([+-]?)/g, (_, num, sign) => {
          return (
            (sign ? (superSigns[sign] || sign) : '') +
            num.split('').map((c) => superNumbers[parseInt(c)] || c).join('')
          );
        });

        parts.push(
          <Text key={match.index + '-charge'} style={{ fontSize: 12, lineHeight: 20 }}>
            {formattedCharge}
          </Text>
        );
      }

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(<Text key={lastIndex + '-end'}>{text.slice(lastIndex)}</Text>);
    }

    return parts;
  };

  const handleUpload = async () => {
    const desiredLength = parseInt(noteLength, 10);
    if (isNaN(desiredLength) || desiredLength <= 0 || desiredLength > 5000) {
      Alert.alert('Invalid Length', 'Please enter a number between 1 and 5000.');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        Alert.alert('No file selected.');
        return;
      }

      setLoading(true);
      setNotes('');

      const file = result.assets[0];
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: 'application/pdf',
      });

      const uploadRes = await fetch(`${BACKEND_URL}/upload`, {
        method: 'POST',
        body: formData,
      });

      const uploadText = await uploadRes.text();
      if (!uploadRes.ok) throw new Error(uploadText);

      const uploadData = JSON.parse(uploadText);
      if (!uploadData.text) throw new Error(uploadData.error || 'No text extracted.');

      const notesRes = await fetch(`${BACKEND_URL}/generate-notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: uploadData.text, length: desiredLength }),
      });

      const notesText = await notesRes.text();
      if (!notesRes.ok) throw new Error(notesText);

      const notesData = JSON.parse(notesText);
      if (notesData.error) throw new Error(notesData.error);

      setNotes(notesData.notes || 'No notes returned.');
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const saveNote = async () => {
    if (!title.trim()) {
      Alert.alert('Title required', 'Please enter a note title.');
      return;
    }

    if (!notes.trim()) {
      Alert.alert('Nothing to save', 'Generate notes first.');
      return;
    }

    try {
      const stored = await AsyncStorage.getItem('notes');
      const parsed = stored ? JSON.parse(stored) : [];
      parsed.push({ id: Date.now().toString(), title: title.trim(), content: notes });

      await AsyncStorage.setItem('notes', JSON.stringify(parsed));

      Alert.alert('Saved!', 'Note saved successfully.');
      setTitle('');
      setNotes('');
      navigation.navigate('NotesMade');
    } catch (e) {
      Alert.alert('Error saving note', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContainer}>
          <View style={styles.container}>
            <Text style={styles.title}>Memozise Note Generator</Text>

            <Text style={styles.label}>Note Length (in words)</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              onChangeText={setNoteLength}
              value={noteLength}
              placeholder="e.g. 300"
              placeholderTextColor="#666" // Darker gray for placeholder
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleUpload}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? 'Working...' : 'Upload PDF & Summarize'}
              </Text>
            </TouchableOpacity>

            {loading && <ActivityIndicator size="large" color="#000000" style={styles.loader} />}

            {notes !== '' && !loading && (
              <View style={styles.notesContainer}>
                <ScrollView>
                  <Text style={styles.notesText}>{formatChemicals(notes)}</Text>
                </ScrollView>
              </View>
            )}

            <Text style={styles.label}>Note Title</Text>
            <TextInput
              style={styles.input}
              onChangeText={setTitle}
              value={title}
              placeholder="Enter note title"
              placeholderTextColor="#666" // Darker gray for placeholder
              editable={!loading}
            />

            <TouchableOpacity
              style={[styles.button, (!notes || !title) && styles.buttonDisabled]}
              onPress={saveNote}
              disabled={!notes || !title || loading}
            >
              <Text style={styles.buttonText}>Save Note</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF', // White background
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F8F8F8', // Light background for content area
  },
  container: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '600',
    color: '#000000', // Black title
    marginBottom: 30,
    textAlign: 'center',
    letterSpacing: 1,
  },
  label: {
    fontSize: 16,
    color: '#000000', // Black label
    alignSelf: 'flex-start',
    marginBottom: 6,
    fontWeight: '500',
  },
  input: {
    borderBottomWidth: 1.5,
    borderBottomColor: '#000000', // Black underline
    width: '100%',
    fontSize: 16,
    paddingVertical: 8,
    marginBottom: 20,
    color: '#000000', // Black text input
    backgroundColor: '#FFFFFF', // White input field
    borderRadius: 5, // Slightly rounded corners
    paddingHorizontal: 5,
  },
  button: {
    width: '100%',
    borderWidth: 2,
    borderColor: '#000000', // Black border
    backgroundColor: '#000000', // Black button
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 1, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  buttonText: {
    color: '#FFFFFF', // White text
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
    backgroundColor: '#666666', // Dark gray when disabled
    borderColor: '#666666',
  },
  loader: {
    marginVertical: 20,
  },
  notesContainer: {
    marginTop: 20,
    width: '100%',
    maxHeight: 400,
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#FFFFFF', // White container for notes
    borderColor: '#000000', // Black border
    borderWidth: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 2,
    marginBottom: 20, // Added margin bottom
  },
  notesText: {
    fontSize: 16,
    color: '#000000', // Black notes text
    lineHeight: 24,
  },
});