// HomeScreen.js
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
  ScrollView,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";

const UPLOAD_API_ENDPOINT = "https://backendmemozise-production.up.railway.app/upload";

export default function HomeScreen({ navigation }) {
  const [step, setStep] = useState(1);

  const [deckName, setDeckName] = useState("");
  const [deckLocation, setDeckLocation] = useState("new");
  const [cardsPerChunkInput, setCardsPerChunkInput] = useState("15");
  const [questionType, setQuestionType] = useState("MCQ");

  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");

  const validateInput = () => {
    const num = parseInt(cardsPerChunkInput, 10);
    if (isNaN(num) || num < 1 || num > 250) {
      Alert.alert(
        "Invalid Number",
        "Please enter a number between 1 and 250 for flashcards count."
      );
      return false;
    }
    if (step === 2 && deckName.trim() === "") {
       Alert.alert("Deck Name Required", "Please enter a name for your deck.");
       return false;
    }
    return true;
  };

  const handleNextStep = (nextStep) => {
      if (!validateInput()) return;
      Keyboard.dismiss();
      setStep(nextStep);
  }

  const handlePreviousStep = () => {
      if (step > 1) {
          setStep(step - 1);
      }
  }

  const handlePDFUpload = async () => {
    if (!validateInput()) return;
    setLoadingMessage("Uploading PDF and extracting text...");
    setLoading(true);
    Keyboard.dismiss();

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        console.log("Document picking cancelled or no asset found.");
        setLoading(false);
        return;
      }

      const asset = result.assets[0];

      if (asset.mimeType && asset.mimeType !== 'application/pdf') {
         Alert.alert("Invalid File Type", "Please select a PDF file.");
         setLoading(false);
         return;
      }

      const formData = new FormData();
      formData.append("file", {
        uri: asset.uri,
        name: asset.name || `upload_${Date.now()}.pdf`,
        type: asset.mimeType || "application/pdf",
      });

      const response = await fetch(UPLOAD_API_ENDPOINT, {
        method: "POST",
        body: formData,
      });

      const responseBody = await response.text();

      if (!response.ok) {
         console.error("Extraction failed:", response.status, responseBody);
         let errorMsg = `Failed to extract text (Status: ${response.status}).`;
         try {
            const errorJson = JSON.parse(responseBody);
            errorMsg = errorJson.error || errorMsg;
         } catch (e) { /* Ignore parse error if body isn't JSON */ }
         throw new Error(errorMsg);
      }

       let data;
       try {
          data = JSON.parse(responseBody);
       } catch (e) {
          console.error("Failed to parse extraction response:", responseBody);
          throw new Error("Received invalid data from server after extraction.");
       }

      if (typeof data.text !== 'string' || data.text.length === 0) {
          console.error("Extracted text is missing or not a string in the server response:", data);
          throw new Error("Extracted text is empty or missing in the server response.");
      }

      navigation.navigate("Flashcards", {
        fullText: data.text,
        numFlashcardsPerPage: parseInt(cardsPerChunkInput, 10),
        deckName: deckName.trim() || "Untitled Deck",
        deckLocation,
        questionType,
      });

    } catch (e) {
        console.error("PDF Upload/Extraction Error:", e);
        Alert.alert("Error", e.message || "An unexpected error occurred during PDF processing.");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const renderNavButtons = (onNextPress, nextLabel = "Next", showPrevious = true) => (
     <View style={styles.navButtonContainer}>
       {showPrevious && (
          <TouchableOpacity
            style={[styles.navButton, styles.prevButton]}
            onPress={handlePreviousStep}
            disabled={loading}
          >
            <Text style={styles.navButtonText2}>Previous</Text>
          </TouchableOpacity>
       )}
       <TouchableOpacity
         style={[styles.navButton, styles.nextButton]}
         onPress={onNextPress}
         disabled={loading}
       >
         <Text style={styles.navButtonText}>{loading && step === 5 ? "Processing..." : nextLabel}</Text>
       </TouchableOpacity>
     </View>
  );

  return (
    <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
    >
      {step === 1 && (
        <>
          <Text style={styles.title}>Start Creating Flashcards</Text>
          <Text style={styles.subtitle}>Convert your PDF notes into flashcards easily.</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => handleNextStep(2)}
          >
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
        </>
      )}

      {step === 2 && (
        <>
          <Text style={styles.title}>Enter Deck Name</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g., Biology Chapter 5"
            placeholderTextColor="#666666"
            value={deckName}
            onChangeText={setDeckName}
            autoFocus={true}
          />
          {renderNavButtons(() => handleNextStep(3))}
        </>
      )}

      {step === 3 && (
        <>
          <Text style={styles.title}>Deck Location</Text>
          <TouchableOpacity
            style={[
              styles.option,
              deckLocation === "new" && styles.selectedOption,
            ]}
            onPress={() => setDeckLocation("new")}
          >
            <Text style={styles.optionText}>Create as new deck</Text>
          </TouchableOpacity>
          {renderNavButtons(() => handleNextStep(4))}
        </>
      )}

      {step === 4 && (
        <>
          <Text style={styles.title}>Number of Flashcards</Text>
          <Text style={styles.label}>How many flashcards to generate? (1-250)</Text>
          <TextInput
            style={styles.input}
            keyboardType="numeric"
            value={cardsPerChunkInput}
            onChangeText={setCardsPerChunkInput}
            placeholder="e.g., 20"
            placeholderTextColor="#666666"
            maxLength={3}
            autoFocus={true}
          />
          {renderNavButtons(() => handleNextStep(5))}
        </>
      )}

      {step === 5 && (
        <>
          <Text style={styles.title}>Select Question Type</Text>
          {["MCQ", "Objective", "Subjective", "Long"].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.option,
                questionType === type && styles.selectedOption,
              ]}
              onPress={() => setQuestionType(type)}
            >
              <Text style={styles.optionText}>{type}</Text>
            </TouchableOpacity>
          ))}
          {renderNavButtons(handlePDFUpload, "Select PDF & Generate")}
        </>
      )}

      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#000000" /> {/* Black spinner */}
          <Text style={styles.loadingText}>{loadingMessage || "Processing..."}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 40,
    paddingBottom: 60,
    paddingHorizontal: 20,
    backgroundColor: '#F8F8F8', // Light background
    flexGrow: 1,
    justifyContent: "center",
  },
  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 15,
    textAlign: "center",
    color: '#000000', // Black title
  },
   subtitle: {
     fontSize: 16,
     color: '#666666', // Medium gray subtitle
     textAlign: 'center',
     marginBottom: 30,
   },
   label: {
     fontSize: 14,
     color: '#333333', // Dark gray label
     marginBottom: 5,
     marginLeft: 2,
   },
  input: {
    borderWidth: 1,
    borderColor: '#CCCCCC', // Medium gray border
    backgroundColor: '#FFFFFF', // White input background
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    fontSize: 16,
    marginBottom: 20,
    color: '#000000', // Black text
  },
  button: {
    backgroundColor: '#000000', // Black button
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 10,
    minWidth: 150,
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF', // White text
    fontWeight: "bold",
    fontSize: 16,
  },
  option: {
    backgroundColor: '#FFFFFF', // White option background
    paddingVertical: 14,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#DDDDDD', // Light gray border
  },
  selectedOption: {
    backgroundColor: '#000000', // Black when selected
    borderColor: '#000000',
  },
   optionText: {
       fontSize: 16,
       color: '#000000', // Black text for options
       textAlign: 'center',
   },
   // Add selected option text style to ensure contrast
   selectedOptionText: {
       color: '#FFFFFF',
   },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.8)', // White semi-transparent overlay
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  loadingText: {
      marginTop: 10,
      fontSize: 16,
      color: '#333333', // Dark gray
      fontWeight: '500',
  },
  navButtonContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: 20,
  },
  navButton: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      borderRadius: 8,
      alignItems: 'center',
      flex: 1,
      marginHorizontal: 5,
      borderWidth: 1,
      textAlign: "center"
  },
  prevButton: {
      backgroundColor: '#000000', // Black for previous
      borderColor: '#000000',
  },
  nextButton: {
      backgroundColor: '#FFFFFF', // White for next
      borderColor: '#CCCCCC', // Light gray border
  },
  navButtonText: {
      color: '#000000', // Black text for next button
      fontWeight: 'bold',
      fontSize: 16,
  },
  navButtonText2: {
      color: '#FFFFFF', // White text for previous button
      fontWeight: 'bold',
      fontSize: 16,
  }
});