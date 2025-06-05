// NoteDetailsScreen.js
import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

export default function NoteDetail({ route }) {
  const { note } = route.params;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{note.title}</Text>
      <Text style={styles.content}>{note.content}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#F8F8F8', // Light background
    flexGrow: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000000', // Black title
    marginBottom: 20,
  },
  content: {
    fontSize: 16,
    color: '#333333', // Dark gray content
    lineHeight: 24,
  },
});