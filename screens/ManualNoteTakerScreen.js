// ManualNoteTakerScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
// import { LinearGradient } from 'expo-linear-gradient'; // Remove LinearGradient

const { width, height } = Dimensions.get('window');

export default function ManualNoteTakerScreen() {
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const navigation = useNavigation();

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) {
      Alert.alert('Hold On!', 'A note needs a title. Please enter one.');
      return;
    }
    if (!noteContent.trim()) {
      Alert.alert('Just a little more!', 'Don\'t forget to add some content to your note.');
      return;
    }

    try {
      const newNote = {
        id: Date.now().toString(),
        title: noteTitle.trim(),
        content: noteContent.trim(),
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
      };

      const storedNotes = await AsyncStorage.getItem('notes');
      const notes = storedNotes ? JSON.parse(storedNotes) : [];
      const updatedNotes = [newNote, ...notes];

      await AsyncStorage.setItem('notes', JSON.stringify(updatedNotes));

      Alert.alert('Note Saved!', 'Your note has been successfully saved.', [
        { text: 'Okay', onPress: () => {
            setNoteTitle('');
            setNoteContent('');
            navigation.navigate('NotesMade');
          }
        }
      ]);
    } catch (error) {
      console.error('Error saving note:', error);
      Alert.alert('Uh Oh!', 'Something went wrong while saving your note. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F8F8" />
      {/* Replaced LinearGradient with a plain View and solid background */}
      <View
        style={styles.plainBackground}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
            <View style={styles.container}>
              <Text style={styles.title}>Capture Your Thoughts</Text>
              <Text style={styles.subtitle}>Jot down ideas, notes, or memories.</Text>

              <View style={styles.inputCard}>
                <TextInput
                  style={styles.titleInput}
                  placeholder="Note Title"
                  placeholderTextColor="#666666"
                  value={noteTitle}
                  onChangeText={setNoteTitle}
                />
                <TextInput
                  style={styles.contentInput}
                  placeholder="Start writing here..."
                  placeholderTextColor="#666666"
                  multiline
                  textAlignVertical="top"
                  value={noteContent}
                  onChangeText={setNoteContent}
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSaveNote}>
                <Text style={styles.saveButtonText}>Save Note</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  plainBackground: { // New style for the plain background
    flex: 1,
    paddingHorizontal: width * 0.05,
    backgroundColor: '#F8F8F8', // Light gray background
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: height * 0.03,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 20 : 0,
  },
  title: {
    fontSize: width * 0.075,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 10,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: width * 0.04,
    color: '#333333',
    marginBottom: height * 0.04,
    textAlign: 'center',
    paddingHorizontal: width * 0.05,
  },
  inputCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    width: '100%',
    padding: width * 0.05,
    marginBottom: 25,
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 5,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 1, // Added border
    borderColor: '#E0E0E0', // Light gray border
  },
  titleInput: {
    fontSize: width * 0.05,
    fontWeight: '600',
    color: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
    marginBottom: 15,
  },
  contentInput: {
    fontSize: width * 0.045,
    color: '#000000',
    minHeight: height * 0.3,
    paddingVertical: 12,
    paddingHorizontal: 5,
    lineHeight: 24,
    textAlignVertical: 'top',
  },
  saveButton: {
    backgroundColor: '#000000',
    paddingVertical: 18,
    paddingHorizontal: 35,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    shadowColor: '#000000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: width * 0.05,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});