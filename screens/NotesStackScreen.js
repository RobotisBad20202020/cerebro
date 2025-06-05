import React, { useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import NoteMakerScreen from './screens/NoteMakerScreen';
import NotesMade from './screens/NotesMade';
import NoteDetailScreen from './screens/NoteDetailScreen';

const NotesStack = createNativeStackNavigator();

export default function NotesStackScreen() {
  const [notes, setNotes] = useState([]);

  // Function to add a new note
  const addNote = (note) => {
    setNotes((prev) => [note, ...prev]);
  };

  return (
    <NotesStack.Navigator screenOptions={{ headerShown: true }}>
      <NotesStack.Screen 
        name="NoteMaker" 
        options={{ title: 'Create Note' }}
      >
        {(props) => <NoteMakerScreen {...props} addNote={addNote} />}
      </NotesStack.Screen>

      <NotesStack.Screen 
        name="NotesMade" 
        options={{ title: 'Saved Notes' }}
      >
        {(props) => <NotesMade {...props} notes={notes} />}
      </NotesStack.Screen>

      <NotesStack.Screen 
        name="NoteDetail" 
        component={NoteDetailScreen} 
        options={{ title: 'Note Details' }} 
      />
    </NotesStack.Navigator>
  );
}
