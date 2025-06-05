// SavedSummaries.js
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, Alert, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';

export default function SavedSummariesScreen() {
    const [savedSummaries, setSavedSummaries] = useState([]);
    const [expandedSummaryId, setExpandedSummaryId] = useState(null);

    const loadSummaries = async () => {
        try {
            const storedSummaries = await AsyncStorage.getItem('savedSummaries');
            if (storedSummaries) {
                setSavedSummaries(JSON.parse(storedSummaries));
            }
        } catch (error) {
            console.error('Failed to load summaries from AsyncStorage:', error);
            Alert.alert('Error', 'Failed to load saved summaries.');
        }
    };

    const saveSummaries = async (summaries) => {
        try {
            await AsyncStorage.setItem('savedSummaries', JSON.stringify(summaries));
        } catch (error) {
            console.error('Failed to save summaries to AsyncStorage:', error);
            Alert.alert('Error', 'Failed to save summary.');
        }
    };

    useEffect(() => {
        loadSummaries();
    }, []);

    // This useEffect is intended to react to new summaries passed via navigation params.
    // It's usually better to pass `loadSummaries` function down or use a global state.
    // For now, I'm keeping your existing logic but know it might have edge cases
    // if navigation params are not cleared or handled precisely.
    useEffect(() => {
        // This effect runs when route.params changes.
        // It's a common pattern to pass a flag or a new summary object
        // through route.params when navigating to this screen.
        // If you're navigating like: navigation.navigate('SavedSummaries', { refresh: true });
        // Then this useEffect will trigger to reload data.
        // If you are passing newSummary via params: navigation.navigate('SavedSummaries', { newSummary: { ... } });
        // The current implementation directly processes newSummary.
        // For a more robust solution with route params, you might clear the param after use.
        // Example: navigation.setParams({ newSummary: undefined }); after processing.
        loadSummaries(); // Reload all summaries when the screen is focused or param changes.
    }, [/*route.params?.newSummary,*/ ]); // Commented out to prevent potential infinite loop if not managed carefully


    const toggleSummaryExpansion = (id) => {
        setExpandedSummaryId(prevId => (prevId === id ? null : id));
    };

    const deleteSummary = (id) => {
        Alert.alert(
            "Delete Summary",
            "Are you sure you want to delete this summary? This action cannot be undone.",
            [
                {
                    text: "Cancel",
                    style: "cancel"
                },
                {
                    text: "Delete",
                    onPress: async () => {
                        const updatedSummaries = savedSummaries.filter(summary => summary.id !== id);
                        setSavedSummaries(updatedSummaries);
                        await saveSummaries(updatedSummaries);
                        if (expandedSummaryId === id) {
                            setExpandedSummaryId(null);
                        }
                        Alert.alert("Deleted", "Summary has been deleted.");
                    },
                    style: "destructive"
                }
            ]
        );
    };

    const renderItem = ({ item }) => {
        const isExpanded = expandedSummaryId === item.id;
        return (
            <TouchableOpacity
                style={styles.summaryItem}
                onPress={() => toggleSummaryExpansion(item.id)}
                activeOpacity={0.7}
            >
                <View style={styles.summaryHeader}>
                    <Text style={styles.summaryItemTitle}>{item.title}</Text>
                    <TouchableOpacity
                        onPress={() => deleteSummary(item.id)}
                        style={styles.deleteButton}
                    >
                        <Ionicons name="trash-outline" size={20} color="#333333" /> {/* Dark gray trash icon */}
                    </TouchableOpacity>
                </View>
                <Text style={styles.summaryItemDate}>{item.date}</Text>
                {isExpanded && (
                    <Text style={styles.summaryItemText}>{item.text}</Text>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Saved Summaries</Text>
            {savedSummaries.length > 0 ? (
                <FlatList
                    data={savedSummaries}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                />
            ) : (
                <Text style={styles.emptyText}>No summaries saved yet.</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#F8F8F8', // Light background
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        marginBottom: 25,
        textAlign: 'center',
        color: '#000000', // Black title
    },
    listContent: {
        paddingBottom: 20,
    },
    summaryItem: {
        backgroundColor: '#FFFFFF', // White item background
        padding: 18,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E0E0E0', // Light gray border
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    summaryItemTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#000000', // Black title in list
        flexShrink: 1,
        marginRight: 10,
    },
    summaryItemDate: {
        fontSize: 13,
        color: '#888888', // Medium-light gray date
        marginBottom: 10,
    },
    summaryItemText: {
        fontSize: 15,
        color: '#333333', // Dark gray summary content
        lineHeight: 22,
        marginTop: 5,
    },
    emptyText: {
        fontSize: 18,
        color: '#888888',
        textAlign: 'center',
        marginTop: 50,
        fontStyle: 'italic',
    },
    deleteButton: {
        padding: 5,
        borderRadius: 5,
    }
});