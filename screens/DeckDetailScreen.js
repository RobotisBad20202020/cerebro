import React, { useEffect, useState, useCallback } from "react";
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Pressable,
    Alert,
    ScrollView,
    SafeAreaView,
    AppState // Import AppState
} from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { db } from "../firebaseConfig";
import { doc, getDoc, updateDoc, Timestamp } from "firebase/firestore";
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Constants for SRS Algorithm ---
const DEFAULT_EASE_FACTOR = 250;
const MIN_EASE_FACTOR = 130;
const AGAIN_INTERVAL = 1 * 60 * 1000; // 1 minute
const HARD_INTERVAL_MULTIPLIER = 1.2;
const GOOD_INTERVAL_FIRST_TIME = 10 * 60 * 1000; // 10 minutes
const GRADUATING_INTERVAL = 1 * 24 * 60 * 60 * 1000; // 1 day
const EASY_INTERVAL = 4 * 24 * 60 * 60 * 1000; // 4 days
const EASY_BONUS = 1.3;

// --- AsyncStorage Key ---
const PENDING_SRS_UPDATES_STORAGE_KEY = '@allPendingSrsUpdates';

// --- Async Storage Helper Functions ---
const loadAllPendingUpdates = async () => {
    try {
        const jsonValue = await AsyncStorage.getItem(PENDING_SRS_UPDATES_STORAGE_KEY);
        return jsonValue != null ? JSON.parse(jsonValue) : {};
    } catch (e) {
        console.error("AsyncStorage: Error loading pending updates", e);
        return {};
    }
};

const saveAllPendingUpdates = async (updates) => {
    try {
        const jsonValue = JSON.stringify(updates);
        await AsyncStorage.setItem(PENDING_SRS_UPDATES_STORAGE_KEY, jsonValue);
    } catch (e) {
        console.error("AsyncStorage: Error saving pending updates", e);
    }
};

const setPendingUpdate = async (deckId, cardUniqueId, srsData) => {
    const allUpdates = await loadAllPendingUpdates();
    if (!allUpdates[deckId]) {
        allUpdates[deckId] = {};
    }
    // Ensure nextReview is stored as millis for serialization
    const serializableSrsData = {
        ...srsData,
        nextReview: srsData.nextReview instanceof Timestamp
            ? srsData.nextReview.toMillis()
            : srsData.nextReview // Should already be millis if coming from calculated data
    };
    allUpdates[deckId][cardUniqueId] = serializableSrsData;
    await saveAllPendingUpdates(allUpdates);
};

const clearPendingUpdates = async (deckId) => {
    const allUpdates = await loadAllPendingUpdates();
    if (allUpdates[deckId]) {
        delete allUpdates[deckId];
        await saveAllPendingUpdates(allUpdates);
    }
};

// --- SRS Calculation Function ---
const calculateSrsUpdate = (card, difficulty) => {
    let { interval, easeFactor, uniqueId } = card;
    easeFactor = Math.max(MIN_EASE_FACTOR, easeFactor || DEFAULT_EASE_FACTOR);
    const now = Date.now();
    let nextInterval;
    let nextEaseFactor = easeFactor;
    // A card is considered "first review" if its interval is 1 or not set
    const isFirstReview = card.interval === 1 || !card.interval;

    switch (difficulty) {
        case 'again':
            nextInterval = AGAIN_INTERVAL;
            nextEaseFactor = easeFactor - 20;
            break;
        case 'hard':
            nextInterval = isFirstReview ? GOOD_INTERVAL_FIRST_TIME : Math.round(interval * HARD_INTERVAL_MULTIPLIER);
            nextEaseFactor = easeFactor - 15;
            break;
        case 'good':
            nextInterval = isFirstReview ? GRADUATING_INTERVAL : Math.round(interval * (easeFactor / 100));
            break;
        case 'easy':
            nextInterval = isFirstReview ? EASY_INTERVAL : Math.round(interval * (easeFactor / 100) * EASY_BONUS);
            nextEaseFactor = easeFactor + 15;
            break;
        default:
            console.warn(`calculateSrsUpdate: Unknown difficulty: ${difficulty} for card ${uniqueId}`);
            nextInterval = interval; // Keep current interval if difficulty is unknown
    }
    nextEaseFactor = Math.max(MIN_EASE_FACTOR, nextEaseFactor);
    nextInterval = Math.max(AGAIN_INTERVAL, Math.round(nextInterval));
    const nextReview = new Date(now + nextInterval);

    return {
        uniqueId: uniqueId, // Ensure uniqueId is always present in the returned object
        interval: nextInterval,
        easeFactor: nextEaseFactor,
        nextReview: Timestamp.fromDate(nextReview), // Store as Firestore Timestamp
    };
};

// --- Filtering and Sorting Due Cards ---
const filterAndSortDueCards = (allCardsList) => {
    const now = Date.now();
    const getReviewTimeMillis = (reviewData) => {
        if (reviewData instanceof Timestamp) return reviewData.toMillis();
        if (reviewData instanceof Date) return reviewData.getTime();
        if (typeof reviewData === 'number') return reviewData; // Assuming it's already millis
        if (reviewData && typeof reviewData.seconds === 'number' && typeof reviewData.nanoseconds === 'number') {
            return reviewData.seconds * 1000 + reviewData.nanoseconds / 1000000;
        }
        return -Infinity; // Treat unparseable/missing as "most due" (review now)
    };

    const dueCards = allCardsList.filter(card => {
        // Cards without nextReview are new and always due.
        // Cards with nextReview in the past are also due.
        if (card.nextReview === null || typeof card.nextReview === 'undefined') {
            // console.log(`Filter Debug: Card ${card.uniqueId} - NEW CARD (null/undefined nextReview), is DUE.`);
            return true;
        }
        let reviewTimeMillis = getReviewTimeMillis(card.nextReview);
        // console.log(`Filter Debug: Card ${card.uniqueId} - NextReview: ${new Date(reviewTimeMillis).toLocaleString()}, Now: ${new Date(now).toLocaleString()}, isDue: ${reviewTimeMillis <= now}`);
        return reviewTimeMillis <= now;
    });

    // Sort due cards: earlier review times first.
    // Cards with no nextReview (new cards) should come first.
    const sortedDueCards = dueCards.sort((a, b) => {
        const timeA = (a.nextReview === null || typeof a.nextReview === 'undefined') ? -Infinity : getReviewTimeMillis(a.nextReview);
        const timeB = (b.nextReview === null || typeof b.nextReview === 'undefined') ? -Infinity : getReviewTimeMillis(b.nextReview);
        return timeA - timeB;
    });
    // console.log(`Filter and Sort: Found ${sortedDueCards.length} due cards.`);
    return sortedDueCards;
};

// --- Utility to Remove Undefined Values (important for Firestore serialization) ---
const removeUndefinedValues = (obj) => {
    if (Array.isArray(obj)) {
        return obj.map(removeUndefinedValues).filter(val => val !== undefined);
    } else if (obj !== null && typeof obj === 'object') {
        if (obj instanceof Timestamp) return obj; // Keep Timestamp objects as is
        const newObj = {};
        for (const key in obj) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = removeUndefinedValues(obj[key]);
                if (val !== undefined) {
                    newObj[key] = val;
                }
            }
        }
        return newObj;
    }
    return obj;
};

// --- Main Component ---
export default function DeckDetailScreen() {
    const route = useRoute();
    const navigation = useNavigation();
    const deckId = route?.params?.deck?.id;
    const deckName = route?.params?.deck?.name;

    const [allCards, setAllCards] = useState([]);
    const [dueCards, setDueCards] = useState([]);
    const [currentCardIndex, setCurrentCardIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showAnswer, setShowAnswer] = useState(false);
    const [reviewStatus, setReviewStatus] = useState(null);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);


    // Fetch cards on initial load or when deckId changes
    useEffect(() => {
        if (!deckId) {
            Alert.alert("Error", "Deck ID is missing!");
            setLoading(false);
            return;
        }
        let isMounted = true;
        const fetchAndPrepareCards = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, "decks", deckId);
                const docSnap = await getDoc(docRef);

                if (!docSnap.exists()) {
                    if (isMounted) Alert.alert("Error", `Deck with ID ${deckId} not found!`);
                    if (isMounted) setLoading(false);
                    return;
                }

                const data = docSnap.data();
                let processedCards = (data.flashcards || []).map((card, index) => {
                    // Ensure uniqueId exists for each card. If not, create one.
                    // Ideally, uniqueId should be generated when card is created.
                    const uniqueId = card.uniqueId || `${deckId}-${index}-${Date.now()}`;
                    let nextReview = card.nextReview;

                    // Standardize nextReview to Firestore Timestamp or null
                    if (nextReview && typeof nextReview.seconds === 'number' && typeof nextReview.nanoseconds === 'number') {
                        nextReview = new Timestamp(nextReview.seconds, nextReview.nanoseconds);
                    } else if (nextReview instanceof Date) {
                        nextReview = Timestamp.fromDate(nextReview);
                    } else if (typeof nextReview === 'number') { // Assuming millis
                        nextReview = Timestamp.fromMillis(nextReview);
                    } else {
                        // If nextReview is not a valid Timestamp/Date/number from Firestore,
                        // treat it as a new card (due immediately).
                        nextReview = null;
                    }

                    // console.log(`Workspaceed Card ${uniqueId}: Question: ${card.question.substring(0,20)}..., Raw NextReview: ${card.nextReview}, Processed NextReview: ${nextReview?.toDate() || 'NULL'}`);

                    return {
                        ...card, // Spread original card properties
                        uniqueId,
                        question: card.question || "Question missing",
                        answer: card.answer || "Answer missing",
                        options: Array.isArray(card.options) ? card.options : [],
                        nextReview: nextReview,
                        interval: card.interval || 1, // Default interval for new cards
                        easeFactor: card.easeFactor || DEFAULT_EASE_FACTOR,
                    };
                });

                const allPending = await loadAllPendingUpdates();
                const deckPendingUpdates = allPending[deckId] || {};
                const mergedCards = processedCards.map(card => {
                    const pending = deckPendingUpdates[card.uniqueId];
                    if (pending) {
                        // console.log(`Merging pending update for card ${card.uniqueId}: Old NR: ${card.nextReview?.toDate() || 'NULL'}, New NR: ${new Date(pending.nextReview).toLocaleString()}`);
                        return {
                            ...card,
                            ...pending, // Spread pending updates
                            nextReview: Timestamp.fromMillis(pending.nextReview), // Ensure it's a Timestamp
                        };
                    }
                    return card;
                });

                if (isMounted) {
                    setAllCards(mergedCards);
                    const initialDue = filterAndSortDueCards(mergedCards);
                    setDueCards(initialDue);
                    setCurrentCardIndex(0);
                    setShowAnswer(false);
                    setHasUnsavedChanges(false); // Reset on initial load
                    // console.log(`Initial load complete for Deck ${deckId}. Total cards: ${mergedCards.length}, Due cards: ${initialDue.length}`);
                }
            } catch (error) {
                if (isMounted) {
                    console.error("useEffect: Error loading flashcards:", error);
                    Alert.alert("Error", "Could not load flashcards. " + error.message);
                }
            } finally {
                if (isMounted) setLoading(false);
            }
        };
        fetchAndPrepareCards();
        return () => { isMounted = false; };
    }, [deckId]);


    // Auto-save logic (simplified for this context)
    const triggerAutoSave = useCallback(async () => {
        if (saving || !hasUnsavedChanges || !deckId || allCards.length === 0) {
            // console.log("Auto-save skipped:", { saving, hasUnsavedChanges, deckId, cardCount: allCards.length });
            return false; // Indicate save was skipped
        }
        setSaving(true);
        // console.log("Auto-save: Starting automatic save to Firestore for deck:", deckId);
        // console.log("Auto-save: All cards before Firestore update (sample of 5):", allCards.slice(0,5).map(c => ({ uniqueId: c.uniqueId, nextReview: c.nextReview?.toDate() })));
        try {
            const firestoreFlashcards = allCards.map(card => {
                const { uniqueId, ...rest } = card; // uniqueId is used for internal tracking, not stored as part of array element
                return removeUndefinedValues(rest);
            });
            const deckRef = doc(db, "decks", deckId);
            await updateDoc(deckRef, { flashcards: firestoreFlashcards });
            await clearPendingUpdates(deckId);
            setHasUnsavedChanges(false); // Reset flag after successful save

            // Navigate back to the DecksScreen after successful auto-save
            navigation.navigate("Decks");

            // console.log("Auto-save: Progress automatically saved to Firestore for deck:", deckId);
            return true; // Indicate save was successful
        } catch (error) {
            console.error("Auto-save: Error automatically saving progress to Firestore:", error);
            // Don't alert user for background save failure, but log it.
            return false; // Indicate save failed
        } finally {
            setSaving(false);
        }
    }, [saving, hasUnsavedChanges, deckId, allCards, navigation]); // Added navigation to dependencies

    // Listen for screen blur or app state changes to auto-save
    useEffect(() => {
        const unsubscribeBlur = navigation.addListener('blur', () => {
            // console.log('DeckDetailScreen blurred, attempting auto-save.');
            triggerAutoSave();
        });

        // Also save when app goes to background
        const appStateSubscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState.match(/inactive|background/)) {
                // console.log('App state changed to inactive/background, attempting auto-save.');
                triggerAutoSave();
            }
        });

        return () => {
            unsubscribeBlur();
            appStateSubscription.remove();
            // Final attempt to save if there are still unsaved changes when component fully unmounts
            // This might be redundant if 'blur' always fires before 'unmount' in typical navigation
            // Note: this check relies on the state _at the time of cleanup_, which might be stale.
            // The blur listener is more reliable.
            // if (hasUnsavedChanges) {
            //    console.log('DeckDetailScreen unmounting with unsaved changes, attempting final auto-save.');
            //    triggerAutoSave(); // This might operate on stale state due to closure
            // }
        };
    }, [navigation, triggerAutoSave]); // Dependencies adjusted for useCallback

    const handleNavigationBack = useCallback(() => {
        navigation.goBack();
    }, [navigation]);

    const handleReview = useCallback(async (difficulty) => {
        if (currentCardIndex >= dueCards.length || saving) return;
        const currentCardToReview = dueCards[currentCardIndex];
        if (!currentCardToReview || !currentCardToReview.uniqueId) {
            Alert.alert("Error", "Cannot review card: card data or unique ID is missing.");
            setCurrentCardIndex(idx => idx + 1); // Skip this card if data is bad
            return;
        }

        const updatedSrsData = calculateSrsUpdate(currentCardToReview, difficulty);
        const cardIndexInAll = allCards.findIndex(card => card.uniqueId === currentCardToReview.uniqueId);

        if (cardIndexInAll === -1) {
            Alert.alert("Error", "Could not find card in the master list to update.");
            setCurrentCardIndex(idx => idx + 1); // Skip this card if not found
            return;
        }

        const newAllCards = [...allCards];
        newAllCards[cardIndexInAll] = {
            ...newAllCards[cardIndexInAll],
            ...updatedSrsData, // Spread updated SRS data
        };
        setAllCards(newAllCards);
        await setPendingUpdate(deckId, currentCardToReview.uniqueId, updatedSrsData);
        setHasUnsavedChanges(true); // Mark that there are unsaved changes

        setShowAnswer(false);
        setReviewStatus(difficulty);
        setTimeout(() => {
            setReviewStatus(null);
            setCurrentCardIndex(idx => idx + 1);
        }, 300);
    }, [currentCardIndex, dueCards, allCards, deckId, saving]);


    const handleCompleteDeck = useCallback(async (isAutoSave = false) => {
        if (saving) return;
        // Use hasUnsavedChanges as the primary check. The loadAllPendingUpdates()... was problematic
        if (!isAutoSave && !hasUnsavedChanges) {
            Alert.alert("No Changes", "No new progress to save for this session.");
            handleNavigationBack();
            return;
        }

        setSaving(true);
        if (!isAutoSave) console.log("handleCompleteDeck: Starting explicit save to Firestore.");

        try {
            const firestoreFlashcards = allCards.map(card => {
                const { uniqueId, ...rest } = card; // uniqueId is for client-side tracking, not Firestore field
                return removeUndefinedValues(rest);
            });

            const deckRef = doc(db, "decks", deckId);
            await updateDoc(deckRef, { flashcards: firestoreFlashcards });
            // console.log(`handleCompleteDeck: Firestore update successful for deck ID ${deckId}.`);
            await clearPendingUpdates(deckId);
            setHasUnsavedChanges(false); // Reset flag after successful save

            if (!isAutoSave) {
                Alert.alert(
                    "Review Complete",
                    "Your progress has been saved!",
                    [{ text: "OK", onPress: handleNavigationBack }],
                    { cancelable: false }
                );
            }
        } catch (error) {
            console.error(`handleCompleteDeck: Error updating Firestore for deck ID ${deckId}:`, error);
            if (!isAutoSave) {
                Alert.alert("Sync Error", `Failed to save your progress. Please check your connection. Your changes are stored locally. ${error.message}`);
            }
        } finally {
            setSaving(false); // Always reset saving state
        }
    }, [allCards, deckId, handleNavigationBack, saving, hasUnsavedChanges]);

    const getDueDateDisplay = (nextReview) => {
        if (!nextReview) return "New card";
        let reviewDate;
        if (nextReview instanceof Timestamp) reviewDate = nextReview.toDate();
        else if (nextReview instanceof Date) reviewDate = nextReview;
        else if (typeof nextReview === 'number') reviewDate = new Date(nextReview); // Assuming millis
        else return "Invalid date";

        const now = new Date();
        const diff = reviewDate.getTime() - now.getTime();

        if (diff <= 0) return "Due now";
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return `Due in <1m`;
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `Due in ${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `Due in ${hours}h`;
        const days = Math.floor(hours / 24);
        if (days < 365) return `Due in ${days}d`;
        const years = Math.floor(days / 365);
        return `Due in ${years}y`;
    };

    const sessionFinished = currentCardIndex >= dueCards.length;
    const currentCard = !loading && !sessionFinished && dueCards[currentCardIndex] ? dueCards[currentCardIndex] : null;


    if (loading && allCards.length === 0) {
        return (
            <SafeAreaView style={styles.centered}>
                <ActivityIndicator size="large" color="#ff6f00" />
                <Text style={styles.loadingText}>Loading Deck...</Text>
            </SafeAreaView>
        );
    }

    if (!deckId) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.message}>Error: Deck information is missing.</Text>
                <TouchableOpacity style={styles.finishButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.finishButtonText}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Display message when no cards are due initially, and no changes have been made
    // This handles the "no cards to review" scenario as described.
    if (!loading && dueCards.length === 0 && !hasUnsavedChanges) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.deckTitleEmpty}>{deckName || "Deck"}</Text>
                <Text style={styles.message}>No cards to review right now!</Text>
                <TouchableOpacity style={styles.finishButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.finishButtonText}>Go Back to Decks</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // Display message when session is finished (all due cards reviewed for this session)
    // Or when the deck loaded with no due cards but there ARE unsaved changes (meaning user reviewed some before leaving)
    if (sessionFinished && !loading) {
        return (
            <SafeAreaView style={styles.centered}>
                <Text style={styles.deckTitleEmpty}>{deckName || "Deck"}</Text>
                <Text style={styles.message}>You've finished this review session!</Text>
                <TouchableOpacity
                    style={[styles.finishButton, { backgroundColor: '#007bff' }]}
                    onPress={() => handleCompleteDeck(false)} // Explicit complete
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Text style={styles.finishButtonText}>Save & Finish Review</Text>}
                </TouchableOpacity>
                {!saving && ( // Only show discard if not currently saving
                    <TouchableOpacity
                        style={[styles.finishButton, { backgroundColor: '#6c757d', marginTop: 10 }]}
                        onPress={() => {
                            if (hasUnsavedChanges) {
                                Alert.alert(
                                    "Discard Changes?",
                                    "Are you sure you want to discard the progress from this session? It won't be saved to the cloud.",
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        {
                                            text: "Discard", style: "destructive", onPress: async () => {
                                                await clearPendingUpdates(deckId); // Clear from AsyncStorage
                                                setHasUnsavedChanges(false);      // Reset flag
                                                handleNavigationBack();           // Navigate back
                                            }
                                        }
                                    ]
                                );
                            } else {
                                handleNavigationBack(); // No changes, just navigate back
                            }
                        }}
                    >
                        <Text style={styles.finishButtonText}>Go Back to Decks</Text>
                    </TouchableOpacity>
                )}
            </SafeAreaView>
        );
    }

    // Fallback if currentCard is null but session not technically finished (e.g. loading next card)
    if (!currentCard && !loading) {
        return (
            <SafeAreaView style={styles.centered}>
                <ActivityIndicator size="large" color="#ff6f00" />
                <Text style={styles.loadingText}>Loading card...</Text>
                <TouchableOpacity style={styles.finishButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.finishButtonText}>Go Back to Decks</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }


    return (
        <SafeAreaView style={styles.container}>
            {(saving || (loading && allCards.length > 0)) && // Show indicator if saving OR loading but cards are present
                <ActivityIndicator style={styles.savingIndicator} size="small" color={saving ? "#007bff" : "#ff6f00"} />
            }
            <Text style={styles.deckTitle}>{deckName}</Text>
            <Text style={styles.progressText}>
                {`Card ${dueCards.length > 0 ? Math.min(currentCardIndex + 1, dueCards.length) : 0} of ${dueCards.length} due`}
            </Text>
            {currentCard && ( // Only show due date if currentCard exists
                <Text style={styles.dueDateText}>
                    {`Card due: ${getDueDateDisplay(currentCard.nextReview)}`}
                </Text>
            )}

            {currentCard ? (
                <Pressable
                    style={styles.cardContainer}
                    onPress={() => !saving && setShowAnswer((prev) => !prev)}
                    disabled={saving}
                >
                    <ScrollView contentContainerStyle={styles.cardContent}>
                        <Text style={styles.question}>{currentCard.question}</Text>
                        {currentCard.options && Array.isArray(currentCard.options) && currentCard.options.some(opt => opt?.trim()) && (
                            <View style={styles.optionsContainer}>
                                {currentCard.options.map((option, optionIndex) => (
                                    option?.trim() ? (
                                        <Text key={optionIndex} style={styles.optionText}>
                                            {`${String.fromCharCode(65 + optionIndex)}. ${option.trim()}`}
                                        </Text>
                                    ) : null
                                ))}
                            </View>
                        )}
                        {showAnswer && <Text style={styles.answer}>{currentCard.answer}</Text>}
                    </ScrollView>
                </Pressable>
            ) : (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#ff6f00" />
                    <Text style={styles.loadingText}>Loading card...</Text>
                </View>
            )}

            {showAnswer && currentCard && ( // Ensure currentCard exists before showing review buttons
                <View style={styles.buttonsRow}>
                    <TouchableOpacity disabled={saving} style={[styles.button, styles.againButton]} onPress={() => handleReview("again")}>
                        <Text style={styles.buttonText}>Again</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={saving} style={[styles.button, styles.hardButton]} onPress={() => handleReview("hard")}>
                        <Text style={styles.buttonText}>Hard</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={saving} style={[styles.button, styles.goodButton]} onPress={() => handleReview("good")}>
                        <Text style={styles.buttonText}>Good</Text>
                    </TouchableOpacity>
                    <TouchableOpacity disabled={saving} style={[styles.button, styles.easyButton]} onPress={() => handleReview("easy")}>
                        <Text style={styles.buttonText}>Easy</Text>
                    </TouchableOpacity>
                </View>
            )}
            {/* Button to explicitly save progress if needed, can be removed if auto-save is sufficient */}
            {hasUnsavedChanges && !sessionFinished && (
                <TouchableOpacity
                    style={[styles.finishButton, { backgroundColor: '#ffc107', marginTop: 15 }]}
                    onPress={
                       triggerAutoSave
                    }
                    disabled={saving}>
                    {saving ? <ActivityIndicator size="small" color="#000000" /> : <Text style={[styles.finishButtonText, { color: '#000000' }]}>Save Current Progress</Text>}
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

// --- Styles ---
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f7f8fc",
    alignItems: "center",
    justifyContent: "flex-start", // Changed to flex-start
    paddingHorizontal: 20,
    paddingTop: 20, // Adjusted paddingTop assuming SafeAreaView handles top
    paddingBottom: 100
  },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#f8f9fa",
  },
  savingIndicator: {
    position: 'absolute',
    top: 15, // Adjusted top slightly down, can fine-tune
    right: 20,
    zIndex: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 15,
    padding: 8,
  },
  loadingText: {
    marginTop: 15,
    fontSize: 18,
    color: "#495057",
    fontWeight: '500',
  },
  loadingSubText: { // Kept this style if used elsewhere
    marginTop: 5,
    fontSize: 14,
    color: '#6c757d',
  },
  message: {
    fontSize: 18,
    color: "#6c757d",
    textAlign: "center",
    marginTop: 10, // Reduced default top margin
  },
  progressText: {
    fontSize: 16,
    color: "#777",
    marginBottom: 5,
  },
  dueDateText: {
    fontSize: 14, // Slightly smaller
    color: "#777",
    marginBottom: 15, // Reduced margin
    fontStyle: 'italic',
  },
  deckTitle: {
    fontSize: 28, // Slightly smaller
    fontWeight: "bold",
    color: "#333",
    marginBottom: 10,
    textAlign: 'center',
  },
  deckTitleEmpty: { // Used when deck is empty or session finished
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    marginBottom: 20,
    textAlign: "center",
  },
  cardContainer: {
    width: "100%",
    minHeight: 200, // Ensure a minimum height for the card
    padding: 25,
    borderRadius: 18,
    backgroundColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
    justifyContent: 'center', // Center content vertically if it's short
  },
  cardContent: {
    flexGrow: 1,
    justifyContent: 'center', // Vertically center question/answer
    alignItems: 'center', // Horizontally center question/answer
  },
  question: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#333",
    textAlign: "center",
    marginBottom: 15,
  },
  answer: {
    fontSize: 18,
    color: "#555",
    textAlign: "center",
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  optionsContainer: {
    marginTop: 15,
    alignSelf: 'stretch', // Allow options to take full width
  },
  optionText: {
    fontSize: 16,
    color: "#444",
    marginBottom: 8,
    paddingVertical: 10, // Increased padding
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    textAlign: 'left', // Align option text to the left
  },
  buttonsRow: {
    flexDirection: "row",
    justifyContent: "space-around", // Changed to space-around
    width: "100%",
    paddingHorizontal: 0, // Removed padding, handled by button margin
    marginBottom: 20,
  },
  button: {
    flex: 1,
    paddingVertical: 14, // Increased padding
    borderRadius: 10,
    marginHorizontal: 5, // Reduced margin for tighter packing
    alignItems: "center",
    justifyContent: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    minHeight: 48, // Ensure buttons have a good tap target size
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
    textAlign: 'center',
  },
  againButton: { backgroundColor: "#e74c3c" }, // Red
  hardButton: { backgroundColor: "#f39c12" }, // Orange
  goodButton: { backgroundColor: "#28a745" }, // Green
  easyButton: { backgroundColor: "#17a2b8" }, // Blue
  finishButton: {
    backgroundColor: '#dc3545', // Red for finish/discard
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 10,
    marginTop: 20,
    minWidth: '80%',
    alignItems: 'center',
  },
  finishButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});