// FlashcardScreen.js
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  SafeAreaView,
  TouchableOpacity,
  Modal,
} from "react-native";
import { db } from "../firebaseConfig";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const GENERATE_FLASHCARDS_API_ENDPOINT = "https://backendmemozise-production.up.railway.app/generate-flashcards";

export default function FlashcardsScreen({ route, navigation }) {
  const { fullText, numFlashcardsPerPage: totalCountForBackend, questionType, deckName } = route.params;
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generationSuccessful, setGenerationSuccessful] = useState(false);
  const [savingModalVisible, setSavingModalVisible] = useState(false);

  useEffect(() => {
    if (fullText && totalCountForBackend > 0 && questionType) {
      console.log("Attempting to generate flashcards with params:", {
        textLength: fullText.length,
        totalCount: totalCountForBackend,
        questionType: questionType,
        deckName: deckName
      });
      callGenerateFlashcards();
    } else {
      console.error("Missing required data to generate flashcards:", {
        textExists: !!fullText,
        totalCount: totalCountForBackend,
        questionTypeExists: !!questionType
      });
      Alert.alert("Error", "Missing required data (text, count, or type) to generate flashcards.");
      setLoading(false);
      setTimeout(() => navigation.goBack(), 1500);
    }
  }, [fullText, totalCountForBackend, questionType, navigation]);


  const callGenerateFlashcards = async () => {
    setLoading(true);
    setGenerationSuccessful(false);

    await new Promise(resolve => setTimeout(resolve, 500));

    try {
      console.log("Calling backend API:", GENERATE_FLASHCARDS_API_ENDPOINT);
      const response = await fetch(GENERATE_FLASHCARDS_API_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: fullText,
          totalCount: totalCountForBackend,
          questionType: questionType
        }),
      });

      const responseBody = await response.text();
      console.log("Raw Backend Response:", responseBody);

      let data;
      try {
        data = JSON.parse(responseBody);
        console.log("Parsed Backend Response:", data);
      } catch (e) {
        console.error("Failed to parse flashcard generation response body as JSON:", responseBody, e);
        throw new Error("Received invalid JSON data from server during flashcard generation.");
      }

      if (!response.ok) {
        const errorMsg = data.error || `Failed to generate flashcards (Status: ${response.status})`;
        console.error("Flashcard Generation API returned an error status:", response.status, errorMsg, data);
        throw new Error(errorMsg);
      }

      const flashcardsArray = data.flashcards;

      if (!Array.isArray(flashcardsArray)) {
        console.error("Flashcard Generation API Error: Expected 'flashcards' property to be an array, but got:", data);
        throw new Error("Failed to generate flashcards: Backend did not return an array in the expected format.");
      }

      console.log(`Received ${flashcardsArray.length} flashcards of type: ${questionType}`);

      const flashcardsWithReviewData = flashcardsArray.map(card => ({
        ...card,
        nextReviewDate: new Date(),
        interval: 0,
        easeFactor: 2.5,
        repetitions: 0,
        lastReviewed: null,
        createdAt: new Date(),
        uniqueId: Date.now() + Math.random().toString(36).substring(2, 9), // Simple unique ID
      }));

      setFlashcards(flashcardsWithReviewData);
      setGenerationSuccessful(true);

    } catch (err) {
      console.error("Error during flashcard generation API call:", err);
      Alert.alert("Generation Error", err.message || "An unexpected error occurred while generating flashcards.");
      setGenerationSuccessful(false);
    } finally {
      setLoading(false);
      console.log("Flashcard generation process finished.");
    }
  };

  const handleSave = async () => {
    if (flashcards.length === 0) {
      Alert.alert("Nothing to Save", "No flashcards were generated or are available to save.");
      return;
    }
    setSavingModalVisible(true);
    console.log(`Attempting to save ${flashcards.length} flashcards for deck: "${deckName || "Untitled Deck"}"`);
    try {
      const authInstance = getAuth();
      const user = authInstance.currentUser;
      if (!user) {
        console.warn("Save attempt failed: User not authenticated.");
        Alert.alert("Authentication Required", "You need to be logged in to save decks.");
        setSavingModalVisible(false);
        return;
      }
      console.log("User authenticated, proceeding with save.");
      const docRef = await addDoc(collection(db, "decks"), {
        userId: user.uid,
        name: deckName || "Untitled Deck",
        questionType: questionType,
        createdAt: serverTimestamp(),
        flashcards: flashcards,
      });
      console.log("Deck saved successfully with ID:", docRef.id);
      Alert.alert("Success", `Deck "${deckName || "Untitled Deck"}" saved successfully!`);
      setTimeout(() => navigation.navigate('DecksTab'), 1500); // Navigate to DecksTab
    } catch (error) {
      console.error("Error saving deck to Firestore:", error);
      Alert.alert("Save Error", "Could not save the deck. " + (error.message || "Please try again."));
    } finally {
      setSavingModalVisible(false);
      console.log("Deck saving process finished.");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#000000" /> {/* Black spinner */}
        <Text style={styles.loadingText}>Generating Flashcards...</Text>
        <Text style={styles.loadingSubText}>This may take a few moments.</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {generationSuccessful && flashcards.length > 0 ? (
          <View style={styles.contentContainer}>
            <View style={styles.successCard}>
              <Text style={styles.successText}>
                {flashcards.length} Flashcard{flashcards.length === 1 ? '' : 's'} Generated!
              </Text>
              <Text style={styles.deckInfoText}>Deck: {deckName || "Untitled Deck"}</Text>
              <Text style={styles.deckInfoText}>Type: {questionType}</Text>
            </View>

            {flashcards[0] && (
                <View style={styles.firstCardPreview}>
                   <Text style={styles.previewTitle}>Preview of First Card:</Text>
                   <Text style={styles.firstCardQuestion} numberOfLines={3}>{`Q: ${flashcards[0].question || 'N/A'}`}</Text>
                   <Text style={styles.firstCardAnswer} numberOfLines={3}>{`A: ${flashcards[0].answer || (flashcards[0].options ? 'MCQ Options provided' : 'N/A')}`}</Text>
                </View>
             )}


            <TouchableOpacity
                style={[styles.saveButton, savingModalVisible || flashcards.length === 0 ? styles.saveButtonDisabled : {}]}
                onPress={handleSave}
                disabled={savingModalVisible || flashcards.length === 0}
            >
                {savingModalVisible ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                <Text style={styles.saveButtonText}>Save Deck to My Account</Text>
                )}
            </TouchableOpacity>

             <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                 <Text style={styles.backButtonText}>Discard & Go Back</Text>
             </TouchableOpacity>

          </View>
        ) : (
          <View style={styles.contentContainer}>
             <Text style={styles.emptyStateText}>
               {generationSuccessful === false && !loading ?
                 "Flashcard generation failed. Please try again." :
                 (flashcards.length === 0 && generationSuccessful === true ?
                   "No flashcards were generated from the document content." :
                   "Generating Flashcards..."
                 )
               }
             </Text>
             {!loading && (
               <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
                 <Text style={styles.buttonText}>Go Back</Text>
               </TouchableOpacity>
             )}
          </View>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={savingModalVisible}
        onRequestClose={() => {}}
      >
        <View style={styles.modalOverlay}>
           <ActivityIndicator size="large" color="#FFFFFF" />
           <Text style={styles.modalText}>Saving Deck...</Text>
        </View>
      </Modal>
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
  },
  contentContainer: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    paddingTop: 50,
  },
  successCard: {
    backgroundColor: '#FFFFFF', // White card
    borderColor: '#000000', // Black border
    borderWidth: 1,
    borderRadius: 10,
    padding: 20,
    marginBottom: 25,
    alignItems: 'center',
    width: '95%',
    maxWidth: 400,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  successText: {
    color: '#000000', // Black text
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  deckInfoText: {
    color: '#333333', // Dark gray text
    fontSize: 15,
    marginBottom: 5,
  },
  firstCardPreview: {
    backgroundColor: '#FFFFFF', // White preview card
    borderRadius: 10,
    padding: 20,
    marginBottom: 30,
    borderWidth: 1,
    borderColor: '#E0E0E0', // Light gray border
    width: '95%',
    maxWidth: 400,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 3,
  },
  previewTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#333333', // Dark gray title
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE', // Very light gray separator
    paddingBottom: 6,
  },
  firstCardQuestion: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 10,
    color: '#000000', // Black text
  },
  firstCardAnswer: {
    fontSize: 16,
    color: '#333333', // Dark gray text
  },
  saveButton: {
    backgroundColor: '#000000', // Black button
    paddingVertical: 16,
    paddingHorizontal: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: 'center',
    minWidth: '90%',
    maxWidth: 350,
    elevation: 5,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  saveButtonText: {
    color: '#FFFFFF', // White text
    fontWeight: "bold",
    fontSize: 17,
  },
  saveButtonDisabled: {
    backgroundColor: '#666666', // Darker gray when disabled
  },
  backButton: {
      marginTop: 15,
      paddingVertical: 12,
      paddingHorizontal: 25,
      borderRadius: 8,
      alignItems: "center",
  },
  backButtonText: {
      color: '#666666', // Muted gray text
      fontSize: 15,
      fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#F8F8F8',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 18,
    color: '#333333', // Dark gray
    fontWeight: '500',
  },
  loadingSubText: {
    marginTop: 5,
    fontSize: 14,
    color: '#666666', // Medium gray
    textAlign: 'center',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.8)', // Darker overlay
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalText: {
    marginTop: 15,
    color: '#FFFFFF', // White text
    fontSize: 18,
    fontWeight: '500',
  },
  emptyStateText: {
      fontSize: 18,
      color: '#666666',
      textAlign: 'center',
      marginBottom: 20,
      paddingHorizontal: 20,
  },
  button: {
    backgroundColor: '#000000', // Black button
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: '#FFFFFF', // White text
    fontWeight: "bold",
    fontSize: 16,
  },
});