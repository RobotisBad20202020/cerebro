// PdfSummarizerScreen.js
import React, { useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    SafeAreaView,
    TouchableOpacity,
    ActivityIndicator,
    ScrollView,
    Alert,
    TextInput,
    KeyboardAvoidingView,
    Platform,
    StatusBar,
    Dimensions,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// Replace with your actual backend URL if different
const BACKEND_BASE_URL = 'https://backendmemozise-production.up.railway.app';

export default function PdfSummarizerScreen({ navigation }) {
    const [selectedFileName, setSelectedFileName] = useState(null);
    const [extractedText, setExtractedText] = useState('');
    const [summary, setSummary] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [summaryLength, setSummaryLength] = useState('medium');
    const [newSummaryTitle, setNewSummaryTitle] = useState('');

    /**
     * Saves the current summary to AsyncStorage.
     * Prevents saving duplicate summaries based on title and content.
     * Navigates to 'SavedSummaries' screen after successful save.
     */
    const saveSummaryToAsyncStorage = async (newSummary) => {
        try {
            const storedSummaries = await AsyncStorage.getItem('savedSummaries');
            let summaries = storedSummaries ? JSON.parse(storedSummaries) : [];

            // Check for duplicates to avoid saving the exact same summary
            if (summaries.some(s => s.title === newSummary.title && s.text === newSummary.text)) {
                Alert.alert("Already Saved", "This summary (or one with the same title and content) has already been saved.");
                return;
            }

            summaries = [...summaries, newSummary];
            await AsyncStorage.setItem('savedSummaries', JSON.stringify(summaries));
            Alert.alert("Success!", `Summary "${newSummary.title}" has been saved.`);
            setNewSummaryTitle(''); // Clear the input field after saving

            // Navigate to SavedSummariesScreen and pass the new summary
            // This is crucial for the SavedSummariesScreen to update its list
            navigation.navigate('SavedSummaries', { newSummary: newSummary });
        } catch (error) {
            console.error('Failed to save summary to AsyncStorage:', error);
            Alert.alert('Error', 'Failed to save summary. Please try again.');
        }
    };

    /**
     * Handles the PDF picking process using expo-document-picker.
     * Resets state, validates file type, and then calls uploadPdf.
     */
    const pickPdf = async () => {
        setLoading(true); // Start loading immediately
        setError('');
        setSummary('');
        setExtractedText('');
        setSelectedFileName(null);
        setNewSummaryTitle(''); // Clear title on new PDF pick

        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });

            if (result.canceled) {
                setLoading(false); // Stop loading if user cancels
                return;
            }

            const fileAsset = result.assets?.[0]; // Access the first asset in the array
            if (!fileAsset) {
                setLoading(false);
                return;
            }

            // Basic file type validation (though DocumentPicker filters by type, this is a safeguard)
            if (fileAsset.mimeType !== 'application/pdf') {
                Alert.alert("Invalid File Type", "Please select a PDF file.");
                setLoading(false);
                return;
            }

            setSelectedFileName(fileAsset.name); // Store the selected file's name
            await uploadPdf(fileAsset); // Proceed to upload the PDF
        } catch (err) {
            console.error('DocumentPicker Error:', err);
            setError('Failed to pick PDF. Please ensure file permissions are granted and try again.');
            Alert.alert('Error', 'Failed to pick PDF: ' + (err.message || 'An unknown error occurred.'));
            setLoading(false);
        }
    };

    /**
     * Uploads the selected PDF file to the backend for text extraction.
     * On success, calls summarizeText with the extracted content.
     */
    const uploadPdf = async (fileAsset) => {
        setError('');
        setSummary(''); // Clear previous summary
        setExtractedText(''); // Clear previous extracted text

        const formData = new FormData();
        formData.append('file', {
            uri: fileAsset.uri,
            type: fileAsset.mimeType || 'application/pdf', // Ensure a type is set
            name: fileAsset.name || `upload_${Date.now()}.pdf`, // Ensure a name is set
        });

        try {
            console.log('Uploading PDF to backend...');
            const response = await axios.post(`${BACKEND_BASE_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                maxBodyLength: Infinity, // Important for large files
                maxContentLength: Infinity, // Important for large files
                timeout: 120000, // 2 minutes timeout for upload and extraction
            });

            const { text, extractionMethod } = response.data;
            console.log(`PDF upload successful. Extraction method: ${extractionMethod}. Text length: ${text.length}`);

            if (text && text.length > 0) {
                setExtractedText(text); // Store extracted text
                await summarizeText(text, summaryLength); // Summarize the extracted text
            } else {
                setError('No text could be extracted from this PDF. It might be an image-based PDF or corrupted.');
                setLoading(false);
            }
        } catch (err) {
            console.error('Upload/Extraction Error:', err.response?.data || err.message);
            const errorMessage = err.response?.data?.error || err.message || 'An unknown error occurred during extraction.';
            setError(`Failed to extract text: ${errorMessage}. Please try another PDF.`);
            Alert.alert('Extraction Error', `Failed to get text from PDF: ${errorMessage}`);
            setLoading(false);
        }
    };

    /**
     * Sends the extracted text to the backend for summarization.
     * Updates the UI with the generated summary or an error message.
     */
    const summarizeText = async (text, length) => {
        setLoading(true); // Ensure loading is true while summarizing
        setError('');
        setSummary(''); // Clear previous summary

        if (!text) {
            setError('No text available to summarize. Please upload a PDF first.');
            setLoading(false);
            return;
        }

        // Optional: Alert for very long texts that might cause long processing times or API limits
        if (text.length > 50000) { // Example limit, adjust based on your backend's capacity
            Alert.alert("Large Document", "The extracted text is very long. Summarization might take a while. Please be patient.");
        }

        try {
            console.log(`Sending extracted text to backend for summarization (length: ${length})...`);
            const response = await axios.post(`${BACKEND_BASE_URL}/summarise-pdf`, {
                text: text,
                summaryLength: length,
            }, {
                timeout: 90000, // 90 seconds timeout for summarization
            });

            if (response.data.summary) {
                setSummary(response.data.summary);
                console.log('Summary received successfully.');
            } else {
                setError('AI returned an empty summary. The text might be too short, too complex, or the service is busy.');
            }
        } catch (err) {
            console.error('Summarization Error:', err.response?.data || err.message);
            const errorMessage = err.response?.data?.error || err.message || 'An unknown error occurred during summarization.';
            setError(`Failed to get summary: ${errorMessage}`);
            Alert.alert('Summarization Error', `Failed to get summary: ${errorMessage}`);
        } finally {
            setLoading(false); // Stop loading regardless of success or failure
        }
    };

    /**
     * Handles changing the desired summary length and re-summarizes if text is already extracted.
     */
    const handleSummaryLengthChange = async (length) => {
        setSummaryLength(length);
        // Only re-summarize if there's extracted text and we're not currently loading
        if (extractedText && !loading) {
            await summarizeText(extractedText, length);
        } else if (!extractedText) {
            // If no text, clear summary and show a hint
            setSummary('');
            setError('Upload a PDF and extract text first to change summary length.');
        }
    };

    /**
     * Prepares the current summary data and calls the AsyncStorage save function.
     */
    const saveCurrentSummary = () => {
        if (!summary) {
            Alert.alert("No Summary", "There's no summary to save yet. Please upload a PDF and generate a summary first.");
            return;
        }

        // Generate a default title if the user hasn't provided one
        const defaultTitle = selectedFileName ? `Summary of ${selectedFileName.replace('.pdf', '')}` : 'Untitled Summary';
        const title = newSummaryTitle.trim() || defaultTitle; // Use user-provided title or default

        const newSummary = {
            id: Date.now(), // Unique ID for the summary (timestamp based)
            title: title,
            text: summary,
            date: new Date().toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }), // Add current date in a nice format
            originalFileName: selectedFileName || 'N/A' // Store original file name for context
        };

        saveSummaryToAsyncStorage(newSummary); // Call the AsyncStorage save function
    };

    return (
        <SafeAreaView style={styles.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor="#F5F5F5" />
            <LinearGradient
                colors={['#F5F5F5', '#E0E0E0']} // Subtle light gray gradient
                style={styles.gradientBackground}
            >
                <KeyboardAvoidingView
                    style={{ flex: 1 }}
                    behavior={Platform.OS === "ios" ? "padding" : "height"}
                    keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0} // Adjusted for header
                >
                    <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
                        <View style={styles.container}>
                            <Text style={styles.title}>Document Insights</Text>
                            <Text style={styles.subtitle}>Upload a PDF to get concise summaries.</Text>

                            {/* Pick File Button */}
                            <TouchableOpacity
                                style={[styles.pickFileButton, loading && styles.pickFileButtonDisabled]}
                                onPress={pickPdf}
                                disabled={loading}
                            >
                                <Ionicons name="document-attach-outline" size={width * 0.06} color="#000" />
                                <Text style={styles.buttonText}>
                                    {selectedFileName ? `Re-select PDF` : 'Select Document'}
                                </Text>
                            </TouchableOpacity>

                            {/* Display selected file name */}
                            {selectedFileName && (
                                <Text style={styles.fileNameText}>
                                    **{selectedFileName}** loaded.
                                </Text>
                            )}

                            {/* Summary Length Options */}
                            <View style={styles.lengthOptionsRow}> {/* Changed to lengthOptionsRow */}
                                <Text style={styles.optionLabel}>Length:</Text> {/* Shorter label */}
                                <View style={styles.lengthButtonsContainer}> {/* New container for buttons */}
                                    {['short', 'medium', 'long'].map((length) => (
                                        <TouchableOpacity
                                            key={length}
                                            style={[
                                                styles.lengthOptionButton,
                                                summaryLength === length && styles.selectedLengthOption,
                                                loading && styles.lengthOptionButtonDisabled
                                            ]}
                                            onPress={() => handleSummaryLengthChange(length)}
                                            disabled={loading}
                                        >
                                            <Text
                                                style={[
                                                    styles.lengthOptionText,
                                                    summaryLength === length && styles.selectedLengthOptionText,
                                                ]}
                                            >
                                                {length.charAt(0).toUpperCase() + length.slice(1)}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            </View>

                            {/* Loading Indicator */}
                            {loading && (
                                <View style={styles.loadingContainer}>
                                    <ActivityIndicator size="large" color="#000" />
                                    <Text style={styles.loadingText}>
                                        {extractedText ? 'Generating summary...' : 'Extracting text...'}
                                    </Text>
                                </View>
                            )}

                            {/* Error Message Display */}
                            {error ? (
                                <View style={styles.errorContainer}>
                                    <Ionicons name="alert-circle-outline" size={width * 0.05} color="#D8000C" />
                                    <Text style={styles.errorText}>{error}</Text>
                                </View>
                            ) : null}

                            {/* Display Summary or Placeholder */}
                            {summary ? (
                                <View style={styles.summaryContainer}>
                                    <View style={styles.summaryHeader}>
                                        <Text style={styles.summaryLabel}>Summary:</Text>
                                        <TouchableOpacity onPress={saveCurrentSummary} style={styles.saveButton}>
                                            <Ionicons name="bookmark-outline" size={width * 0.06} color="#333" />
                                            <Text style={styles.saveButtonText}>Save</Text>
                                        </TouchableOpacity>
                                    </View>
                                    <ScrollView style={styles.summaryScrollView}>
                                        <Text style={styles.summaryText}>{summary}</Text>
                                    </ScrollView>
                                    <TextInput
                                        style={styles.titleInput}
                                        placeholder="Give this summary a title (optional)"
                                        placeholderTextColor="#666"
                                        value={newSummaryTitle}
                                        onChangeText={setNewSummaryTitle}
                                        returnKeyType="done"
                                    />
                                </View>
                            ) : (
                                // Initial placeholder when nothing is selected
                                !loading && !error && !selectedFileName && (
                                    <View style={styles.placeholderContainer}>
                                        <Ionicons name="cloud-upload-outline" size={width * 0.15} color="#AAAAAA" />
                                        <Text style={styles.placeholderText}>
                                            Upload a PDF to get started!
                                        </Text>
                                    </View>
                                )
                            )}
                            {/* Placeholder specifically for after PDF selected, before summary arrives */}
                             {!loading && !error && selectedFileName && !summary && (
                                <View style={styles.placeholderContainer}>
                                    <Ionicons name="hourglass-outline" size={width * 0.15} color="#AAAAAA" />
                                    <Text style={styles.placeholderText}>
                                        Processing your document...
                                    </Text>
                                    <Text style={styles.placeholderTextSmall}>
                                        (This may take a moment for large files)
                                    </Text>
                                </View>
                            )}
                        </View>
                    </ScrollView>
                </KeyboardAvoidingView>
            </LinearGradient>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF', // Fallback to pure white
    },
    gradientBackground: {
        flex: 1,
        paddingHorizontal: width * 0.05, // Responsive horizontal padding
    },
    scrollContainer: {
        flexGrow: 1,
        justifyContent: 'flex-start', // Align to start (top)
        paddingVertical: height * 0.03,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        width: '100%',
        maxWidth: 700, // Max width for larger screens (tablets)
        alignSelf: 'center', // Center the container horizontally
        paddingBottom: Platform.OS === 'ios' ? 20 : 0,
    },
    title: {
        fontSize: width * 0.08, // Slightly larger, responsive title
        fontWeight: '800',
        color: '#000000', // Pure black
        marginBottom: 10,
        letterSpacing: -0.8, // Tighter
    },
    subtitle: {
        fontSize: width * 0.045,
        color: '#333333', // Dark gray
        marginBottom: height * 0.04,
        textAlign: 'center',
        paddingHorizontal: width * 0.03,
    },
    pickFileButton: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF', // White button
        paddingVertical: 16,
        paddingHorizontal: 30,
        borderRadius: 12, // More rounded
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 25,
        width: '100%',
        borderWidth: 1,
        borderColor: '#E0E0E0', // Light gray border
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 }, // Deeper shadow
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 8,
    },
    pickFileButtonDisabled: {
        backgroundColor: '#F8F8F8', // Lighter gray when disabled
        borderColor: '#EAEAEA',
        shadowOpacity: 0.05, // Less pronounced shadow
        elevation: 4,
    },
    buttonText: {
        color: '#000000', // Black text on button
        fontSize: width * 0.045,
        fontWeight: '600',
        marginLeft: 10,
    },
    fileNameText: {
        fontSize: width * 0.04,
        color: '#333333', // Dark gray for file name
        marginBottom: 25,
        fontStyle: 'italic',
        textAlign: 'center',
    },
    lengthOptionsRow: { // NEW STYLE: for the row containing label and buttons
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        padding: width * 0.03,
        marginBottom: 30,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 6,
        borderWidth: 1,
        borderColor: '#E8E8E8',
        width: '100%', // Take full width
        // Removed `justifyContent: 'space-around'` from this parent row
        // as `lengthButtonsContainer` will handle button distribution.
    },
    optionLabel: {
        fontSize: width * 0.04,
        fontWeight: '600',
        color: '#1A1A1A',
        marginRight: width * 0.03, // Space between label and buttons
    },
    lengthButtonsContainer: { // NEW STYLE: Container for just the buttons
        flexDirection: 'row',
        flexWrap: 'wrap', // ALLOW BUTTONS TO WRAP!
        flex: 1, // Allow this container to take available space
        justifyContent: 'space-around', // Distribute buttons evenly within this container
        alignItems: 'center',
    },
    lengthOptionButton: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: '#BBBBBB',
        margin: width * 0.008, // Smaller margin to allow wrapping tightly
        backgroundColor: '#F0F0F0',
    },
    lengthOptionButtonDisabled: {
        opacity: 0.6,
        backgroundColor: '#DDDDDD',
    },
    selectedLengthOption: {
        backgroundColor: '#000000',
        borderColor: '#000000',
    },
    lengthOptionText: {
        fontSize: width * 0.038,
        color: '#444444',
        fontWeight: '500',
    },
    selectedLengthOptionText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    loadingContainer: {
        marginVertical: height * 0.05,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: width * 0.05,
        borderRadius: 15,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 8,
        width: '85%',
    },
    loadingText: {
        marginTop: 15,
        fontSize: width * 0.045,
        color: '#333333',
        fontWeight: '500',
        textAlign: 'center',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEE', // Retain red for error visibility
        padding: 15,
        borderRadius: 10,
        marginVertical: 20,
        width: '100%',
        borderLeftWidth: 5,
        borderLeftColor: '#D8000C',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 5,
    },
    errorIcon: {
        marginRight: 10,
    },
    errorText: {
        color: '#D8000C',
        fontSize: width * 0.04,
        fontWeight: '600',
        flexShrink: 1,
    },
    summaryContainer: {
        backgroundColor: '#FFFFFF',
        padding: width * 0.06,
        borderRadius: 18,
        width: '100%',
        marginBottom: 20,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 20,
        elevation: 15,
        borderWidth: 1,
        borderColor: '#EAEAEA',
    },
    summaryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE',
    },
    summaryLabel: {
        fontWeight: '700',
        fontSize: width * 0.06,
        color: '#000000',
    },
    summaryScrollView: {
        maxHeight: height * 0.4,
        marginBottom: 15,
        paddingRight: 5,
    },
    summaryText: {
        fontSize: width * 0.04,
        color: '#333333',
        lineHeight: 26,
        textAlign: 'justify',
    },
    placeholderContainer: {
        marginTop: height * 0.05,
        alignItems: 'center',
        justifyContent: 'center',
        padding: width * 0.05,
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 6,
        width: '90%',
    },
    placeholderText: {
        fontSize: width * 0.045,
        color: '#666666',
        fontStyle: 'italic',
        marginTop: 15,
        textAlign: 'center',
        fontWeight: '500',
    },
    placeholderTextSmall: {
        fontSize: width * 0.035,
        color: '#888888',
        marginTop: 5,
        textAlign: 'center',
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEEEEE',
        paddingVertical: 10,
        paddingHorizontal: 15,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#DDDDDD',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 3,
    },
    saveButtonText: {
        marginLeft: 8,
        color: '#333333',
        fontWeight: '600',
        fontSize: width * 0.04,
    },
    titleInput: {
        backgroundColor: '#F8F8F8',
        color: '#000000',
        padding: 15,
        borderRadius: 10,
        fontSize: width * 0.042,
        marginTop: 15,
        borderWidth: 1,
        borderColor: '#E0E0E0',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 5,
        elevation: 4,
    },
});