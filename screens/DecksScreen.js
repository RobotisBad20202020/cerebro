// DecksScreen.js
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from "react-native";
import { db } from "../firebaseConfig";
import { useFocusEffect } from "@react-navigation/native";
import { collection, getDocs, deleteDoc, doc, query, where, Timestamp } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { Feather } from "@expo/vector-icons"; // For icons
import * as Print from 'expo-print'; // For PDF generation
import * as Sharing from 'expo-sharing'; // For sharing/saving the PDF

// --- Utility to get review time in milliseconds ---
const getReviewTimeMillis = (reviewData) => {
  if (reviewData instanceof Timestamp) return reviewData.toMillis();
  if (reviewData instanceof Date) return reviewData.getTime();
  if (typeof reviewData === 'number') return reviewData;
  if (reviewData && typeof reviewData.seconds === 'number' && typeof reviewData.nanoseconds === 'number') {
    return reviewData.seconds * 1000 + reviewData.nanoseconds / 1000000;
  }
  return -Infinity;
};

export default function DecksScreen({ navigation }) {
  const [decks, setDecks] = useState([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      setLoading(true);

      const fetchDecks = async () => {
        try {
          const auth = getAuth();
          const user = auth.currentUser;

          if (!user) {
            console.log("User is not logged in.");
            if (isActive) {
              setLoading(false);
            }
            return;
          }

          const q = query(collection(db, "decks"), where("userId", "==", user.uid));
          const snapshot = await getDocs(q);

          const deckList = snapshot.docs.map((doc) => {
            const deckData = doc.data();
            const flashcards = deckData.flashcards || [];
            let dueCount = 0;
            const now = Date.now();

            flashcards.forEach(card => {
              let nextReviewTimeMillis = -Infinity;
              if (card.nextReview) {
                nextReviewTimeMillis = getReviewTimeMillis(card.nextReview);
              } else {
                dueCount++; // New cards are always due
                return;
              }

              if (nextReviewTimeMillis <= now) {
                dueCount++;
              }
            });

            return {
              id: doc.id,
              ...deckData,
              dueFlashcardsCount: dueCount,
            };
          });

          if (isActive) {
            setDecks(deckList);
          }
        } catch (error) {
          console.error("Error fetching decks:", error);
        } finally {
          if (isActive) {
            setLoading(false);
          }
        }
      };

      fetchDecks();

      return () => {
        isActive = false;
      };
    }, [])
  );

  const handleDeleteDeck = async (deckId) => {
    Alert.alert(
      "Delete Deck",
      "Are you sure you want to delete this deck? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const deckRef = doc(db, "decks", deckId);
              await deleteDoc(deckRef);
              setDecks((prevDecks) => prevDecks.filter((deck) => deck.id !== deckId));
              Alert.alert("Success", "Deck deleted successfully!");
            } catch (error) {
              console.error("Error deleting deck:", error);
              Alert.alert("Error", "Could not delete the deck. Please try again.");
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  const handleExportDeckToPdf = async (deck) => {
    if (!deck || !deck.flashcards || deck.flashcards.length === 0) {
      Alert.alert("Export Failed", "This deck has no flashcards to export.");
      return;
    }

    const deckName = deck.name || "Unnamed Deck";
    let flashcardsHtmlRows = "";
    deck.flashcards.forEach((card) => {
      const frontText = card.question || "N/A";
      const backText = card.answer || "N/A";

      flashcardsHtmlRows += `<tr><td>${frontText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td><td>${backText.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td></tr>`;
    });

    const htmlContent = `
      <html>
        <head>
          <style>
            body { font-family: Helvetica, Arial, sans-serif; margin: 20px; background-color: #FFFFFF; color: #000000; }
            h1 { font-size: 24px; margin-bottom: 20px; color: #000000; text-align: center;}
            table { width: 100%; border-collapse: collapse; margin-top: 20px;}
            th, td { border: 1px solid #BBBBBB; padding: 10px; text-align: left; font-size: 14px; word-break: break-word; }
            th { background-color: #DDDDDD; font-weight: bold; color: #000000; }
            tr:nth-child(even) { background-color: #F0F0F0; }
            tr:nth-child(odd) { background-color: #FFFFFF; }
          </style>
        </head>
        <body>
          <h1>${deckName.replace(/</g, "&lt;").replace(/>/g, "&gt;")} Flashcards</h1>
          <table>
            <thead>
              <tr>
                <th>Front (Question)</th> <th>Back (Answer)</th>
              </tr>
            </thead>
            <tbody>
              ${flashcardsHtmlRows}
            </tbody>
          </table>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({
        html: htmlContent,
        base64: false,
      });

      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert("Sharing not available", "Sharing functionality is not available on this device.");
        return;
      }

      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: `Share or Save ${deckName} PDF`,
        UTI: '.pdf',
      });
    } catch (error) {
      console.error("Error exporting PDF:", error);
      Alert.alert("Export Error", "Could not generate or share the PDF. Please try again.");
    }
  };


  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={styles.loadingText}>Loading Your Decks...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📚 Your Saved Decks</Text>
      {decks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={60} color="#AAAAAA" /> {/* Light gray icon */}
          <Text style={styles.emptyText}>No decks saved yet.</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => navigation.navigate("HomeTab")} // Navigate to where users create decks
          >
            <Text style={styles.createButtonText}>Create New Deck</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={decks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View style={styles.deckItem}>
              <TouchableOpacity
                style={styles.deckButton}
                onPress={() => navigation.navigate("DeckDetail", { deck: item })}
              >
                <Text style={styles.deckName}>{item.name}</Text>
                <Text style={styles.deckCount}>
                  {typeof item.dueFlashcardsCount === 'number'
                    ? `${item.dueFlashcardsCount} due`
                    : "0 due"}
                </Text>
              </TouchableOpacity>
              <View style={styles.actionButtonsContainer}>
                <TouchableOpacity
                  style={[styles.iconButton, styles.pdfButton]}
                  onPress={() => handleExportDeckToPdf(item)}
                >
                  <Feather name="file-text" size={20} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.iconButton, styles.deleteButton]}
                  onPress={() => handleDeleteDeck(item.id)}
                >
                  <Feather name="trash-2" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={[styles.listContentContainer, { paddingBottom: 60 }]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 20,
    paddingHorizontal: 15,
    backgroundColor: '#F8F8F8', // Light background
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: '#F8F8F8',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#333333', // Dark gray
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 30,
    color: '#000000', // Black title
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#888888', // Medium-light gray
    marginTop: 15,
    textAlign: "center",
  },
  createButton: {
    backgroundColor: '#000000', // Black button
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    marginTop: 20,
  },
  createButtonText: {
    color: '#FFFFFF', // White text
    fontWeight: "bold",
    fontSize: 16,
  },
  listContentContainer: {
    paddingBottom: 20,
  },
  deckItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: '#FFFFFF', // White item background
    padding: 15,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0', // Light gray border
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  deckButton: {
    flex: 1,
    marginRight: 10,
  },
  deckName: {
    fontSize: 18,
    fontWeight: "500",
    color: '#000000', // Black name
    marginBottom: 5,
  },
  deckCount: {
    fontSize: 14,
    color: '#666666', // Medium gray count
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    borderRadius: 8,
    padding: 10,
    marginLeft: 8,
  },
  pdfButton: {
    backgroundColor: '#666666', // Darker gray for PDF
  },
  deleteButton: {
    backgroundColor: '#333333', // Even darker gray for delete
  },
});