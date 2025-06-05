// CreateFlashcardScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
} from 'react-native';

import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  query,
  where,
  doc,
  updateDoc,
  arrayUnion,
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { app, db } from '../firebaseConfig';

const auth = getAuth(app);

export default function CreateFlashcardScreen({ navigation }) {
  const [currentQuestion, setCurrentQuestion] = useState('');
  const [currentAnswer, setCurrentAnswer] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [decks, setDecks] = useState([]);
  const [selectedDeckId, setSelectedDeckId] = useState('');
  const [newDeckName, setNewDeckName] = useState('');
  const [isCreatingNewDeck, setIsCreatingNewDeck] = useState(false);
  const [loadingDecks, setLoadingDecks] = useState(true);
  const [savingCards, setSavingCards] = useState(false); // New state for saving indicator

  useEffect(() => {
    const fetchDecks = async () => {
      setLoadingDecks(true);
      try {
        const user = auth.currentUser;
        if (user) {
          const decksRef = collection(db, 'decks');
          const q = query(decksRef, where('userId', '==', user.uid));
          const querySnapshot = await getDocs(q);
          const deckList = querySnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));
          setDecks(deckList);
          // Set a default selected deck if available
          if (deckList.length > 0) {
            setSelectedDeckId(deckList[0].id);
          }
        } else {
          setDecks([]);
          setSelectedDeckId('');
        }
      } catch (error) {
        console.error('Error fetching user decks:', error);
        Alert.alert('Error', 'Failed to load your decks.');
      } finally {
        setLoadingDecks(false);
      }
    };

    fetchDecks();
  }, []);

  const handleAddFlashcard = () => {
    if (!currentQuestion.trim() || !currentAnswer.trim()) {
      Alert.alert(
        'Warning',
        'Please enter both a question and an answer for the flashcard.'
      );
      return;
    }

    const newCard = {
      question: currentQuestion.trim(),
      answer: currentAnswer.trim(),
      // Initialize SRS data for new cards
      interval: 0,
      easeFactor: 2.5,
      repetitions: 0,
      lastReviewed: null,
      nextReviewDate: new Date(), // Use client-side date for initial creation
      uniqueId: Date.now() + Math.random().toString(36).substring(2, 9), // Simple unique ID
    };
    setFlashcards([...flashcards, newCard]);

    setCurrentQuestion('');
    setCurrentAnswer('');
  };

  const handleSaveAllFlashcards = async () => {
    if (flashcards.length === 0) {
      Alert.alert('No Flashcards', 'Please add some flashcards before saving.');
      return;
    }

    setSavingCards(true); // Start saving indicator
    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Authentication Required', 'You must be logged in to save flashcards.');
        return;
      }

      if (isCreatingNewDeck) {
        if (!newDeckName.trim()) {
          Alert.alert('Deck Name Required', 'Please enter a name for your new deck.');
          return;
        }
        // Create new deck
        const newDeckRef = await addDoc(collection(db, 'decks'), {
          userId: user.uid,
          name: newDeckName.trim(),
          flashcards: flashcards.map(card => ({
            question: card.question,
            answer: card.answer,
            interval: card.interval,
            easeFactor: card.easeFactor,
            repetitions: card.repetitions,
            lastReviewed: card.lastReviewed,
            nextReview: card.nextReviewDate, // Convert to Firestore Timestamp if needed elsewhere, here for initial saving
            uniqueId: card.uniqueId,
          })),
          createdAt: new Date(), // Use client-side date for simplicity here, serverTimestamp preferred for server-side
        });
        Alert.alert('Success', `New deck "${newDeckName}" created and flashcards saved!`);
      } else {
        if (!selectedDeckId) {
          Alert.alert('Select Deck', 'Please select a deck to save flashcards to.');
          return;
        }
        // Update existing deck
        const deckRef = doc(db, 'decks', selectedDeckId);
        // Use arrayUnion to safely add new flashcards without overwriting existing ones
        await updateDoc(deckRef, {
          flashcards: arrayUnion(...flashcards.map(card => ({
            question: card.question,
            answer: card.answer,
            interval: card.interval,
            easeFactor: card.easeFactor,
            repetitions: card.repetitions,
            lastReviewed: card.lastReviewed,
            nextReview: card.nextReviewDate,
            uniqueId: card.uniqueId,
          }))),
        });
        const selectedDeck = decks.find(d => d.id === selectedDeckId);
        Alert.alert('Success', `Flashcards added to deck "${selectedDeck?.name || 'Unknown Deck'}"!`);
      }

      setFlashcards([]); // Clear added flashcards after saving
      setCurrentQuestion('');
      setCurrentAnswer('');
      setNewDeckName('');
      setIsCreatingNewDeck(false);
      // Re-fetch decks to update the list and potentially the default selection
      const updatedDecks = await getDocs(query(collection(db, 'decks'), where('userId', '==', user.uid)));
      const updatedDeckList = updatedDecks.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDecks(updatedDeckList);
      if (updatedDeckList.length > 0) {
        setSelectedDeckId(updatedDeckList[0].id);
      }
      navigation.navigate('DecksTab'); // Navigate to decks screen
    } catch (error) {
      console.error('Error saving flashcards:', error);
      Alert.alert('Save Error', 'Failed to save flashcards. Please try again.');
    } finally {
      setSavingCards(false); // Stop saving indicator
    }
  };

  const renderFlashcardItem = ({ item, index }) => (
    <View style={styles.previewCard}>
      <Text style={styles.previewCardQuestion}>Q: {item.question}</Text>
      <Text style={styles.previewCardAnswer}>A: {item.answer}</Text>
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Create New Flashcards</Text>

      <View style={styles.inputSection}>
        <TextInput
          style={styles.input}
          placeholder="Enter question"
          placeholderTextColor="#666666"
          value={currentQuestion}
          onChangeText={setCurrentQuestion}
          multiline
        />
        <TextInput
          style={styles.input}
          placeholder="Enter answer"
          placeholderTextColor="#666666"
          value={currentAnswer}
          onChangeText={setCurrentAnswer}
          multiline
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddFlashcard}>
          <Text style={styles.addButtonText}>Add Flashcard to List</Text>
        </TouchableOpacity>
      </View>

      {flashcards.length > 0 && (
        <View style={styles.previewSection}>
          <Text style={styles.sectionTitle}>Flashcards to be Saved ({flashcards.length})</Text>
          {flashcards.map((item, index) => renderFlashcardItem({ item, index }))}
        </View>
      )}

      <View style={styles.saveSection}>
        <Text style={styles.sectionTitle}>Save to Deck</Text>
        {loadingDecks ? (
          <ActivityIndicator size="small" color="#000000" />
        ) : (
          <>
            <TouchableOpacity
              style={[
                styles.deckOptionButton,
                isCreatingNewDeck && styles.selectedDeckOption,
              ]}
              onPress={() => setIsCreatingNewDeck(true)}
            >
              <Text style={styles.deckOptionText}>Create New Deck</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.deckOptionButton,
                !isCreatingNewDeck && styles.selectedDeckOption,
                decks.length === 0 && styles.deckOptionButtonDisabled,
              ]}
              onPress={() => setIsCreatingNewDeck(false)}
              disabled={decks.length === 0}
            >
              <Text style={styles.deckOptionText}>Select Existing Deck</Text>
            </TouchableOpacity>

            {isCreatingNewDeck ? (
              <TextInput
                style={styles.input}
                placeholder="New Deck Name"
                placeholderTextColor="#666666"
                value={newDeckName}
                onChangeText={setNewDeckName}
              />
            ) : (
              decks.length > 0 ? (
                <View style={styles.pickerContainer}>
                  {/* Simple TouchableOpacity buttons for deck selection */}
                  {decks.map((deck) => (
                    <TouchableOpacity
                      key={deck.id}
                      style={[
                        styles.deckSelectionButton,
                        selectedDeckId === deck.id && styles.selectedDeckSelectionButton,
                      ]}
                      onPress={() => setSelectedDeckId(deck.id)}
                    >
                      <Text style={[
                          styles.deckSelectionButtonText,
                          selectedDeckId === deck.id && styles.selectedDeckSelectionButtonText,
                      ]}>
                        {deck.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text style={styles.noDecksText}>You don't have any decks. Please create a new one.</Text>
              )
            )}
          </>
        )}

        <TouchableOpacity
          style={[styles.saveButton, (flashcards.length === 0 || savingCards) && styles.saveButtonDisabled]}
          onPress={handleSaveAllFlashcards}
          disabled={flashcards.length === 0 || savingCards}
        >
          {savingCards ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>Save All Flashcards</Text>
          )}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#F8F8F8', // Light background
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 25,
    color: '#000000', // Black title
    textAlign: 'center',
  },
  inputSection: {
    backgroundColor: '#FFFFFF', // White card for input
    padding: 20,
    borderRadius: 12,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC', // Medium gray border
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 15,
    fontSize: 16,
    color: '#000000', // Black text
    marginBottom: 15,
    backgroundColor: '#F8F8F8', // Very light gray input background
  },
  addButton: {
    backgroundColor: '#000000', // Black button
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonText: {
    color: '#FFFFFF', // White text
    fontSize: 16,
    fontWeight: 'bold',
  },
  previewSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333', // Dark gray section title
    marginBottom: 15,
    textAlign: 'center',
  },
  previewCard: {
    backgroundColor: '#F8F8F8', // Lighter background for preview cards
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  previewCardQuestion: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 5,
  },
  previewCardAnswer: {
    fontSize: 15,
    color: '#333333',
  },
  saveSection: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 12,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  deckOptionButton: {
    backgroundColor: '#F0F0F0', // Light gray default
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    marginBottom: 10,
    alignItems: 'center',
  },
  selectedDeckOption: {
    backgroundColor: '#000000', // Black when selected
    borderColor: '#000000',
  },
  deckOptionButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#E8E8E8',
  },
  deckOptionText: {
    color: '#333333', // Dark gray for default
    fontSize: 16,
    fontWeight: '500',
  },
  // Ensure selected text color is white on black background
  selectedDeckOptionText: {
    color: '#FFFFFF',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    marginBottom: 15,
    overflow: 'hidden', // Ensures inner items respect border radius
  },
  deckSelectionButton: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    backgroundColor: '#FFFFFF', // White for individual deck options
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE', // Very light gray separator
  },
  selectedDeckSelectionButton: {
    backgroundColor: '#F0F0F0', // Slightly darker gray when selected
  },
  deckSelectionButtonText: {
    fontSize: 16,
    color: '#333333', // Dark gray text
  },
  selectedDeckSelectionButtonText: {
    fontWeight: 'bold',
  },
  noDecksText: {
    fontSize: 14,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  saveButton: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  saveButtonDisabled: {
    opacity: 0.6,
    backgroundColor: '#333333',
  },
});