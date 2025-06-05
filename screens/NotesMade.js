// NotesMade.js
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, SafeAreaView, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';

export default function NotesMade() {
  const [notes, setNotes] = useState([]);
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  useEffect(() => {
    const loadNotes = async () => {
      const storedNotes = await AsyncStorage.getItem('notes');
      setNotes(storedNotes ? JSON.parse(storedNotes) : []);
    };
    if (isFocused) loadNotes();
  }, [isFocused]);

  const saveNotes = async (updatedNotes) => {
    try {
      await AsyncStorage.setItem('notes', JSON.stringify(updatedNotes));
    } catch (error) {
      console.error('Failed to save notes to AsyncStorage:', error);
      Alert.alert('Error', 'Failed to save notes.');
    }
  };

  const deleteNote = (id) => {
    Alert.alert(
      "Delete Note",
      "Are you sure you want to delete this note? This action cannot be undone.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Delete",
          onPress: async () => {
            const updatedNotes = notes.filter(note => note.id !== id);
            setNotes(updatedNotes);
            await saveNotes(updatedNotes);
            Alert.alert("Deleted", "Note has been deleted.");
          },
          style: "destructive"
        }
      ]
    );
  };


  const renderItem = ({ item }) => {
    return (
      <TouchableOpacity
        style={styles.summaryItem}
        onPress={() => navigation.navigate('NotesDetailStack', { screen: 'NoteDetail', params: { note: item } })}
        activeOpacity={0.7}
      >
        <View style={styles.summaryHeader}>
            <Text style={styles.summaryItemTitle}>{item.title}</Text>
            <TouchableOpacity
                onPress={() => deleteNote(item.id)}
                style={styles.deleteButton}
            >
                <Ionicons name="trash-outline" size={20} color="#333333" /> {/* Dark gray trash icon */}
            </TouchableOpacity>
        </View>
        <Text numberOfLines={2} style={styles.summaryItemText}>{item.content}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Saved Notes</Text>
      <FlatList
        data={notes}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderItem}
        ListEmptyComponent={<Text style={styles.emptyText}>No notes saved yet.</Text>}
        contentContainerStyle={notes.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </SafeAreaView>
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
  summaryItemDate: { // This style exists but isn't used as per your code
    fontSize: 13,
    color: '#888888',
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
    color: '#888888', // Medium-light gray empty text
    textAlign: 'center',
    marginTop: 50,
    fontStyle: 'italic',
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  deleteButton: {
    padding: 5,
    borderRadius: 5,
  }
});