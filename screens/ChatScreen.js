import React, { useState, useEffect, useCallback } from "react";
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    Alert,
    Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getAuth } from "firebase/auth";
import { app } from "../firebaseConfig";
import * as Crypto from "expo-crypto";
import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { marked } from 'marked'; // Import marked library


// IMPORTANT: Replace with your actual API key
// For production apps, manage API keys securely (e.g., environment variables)
const API_KEY = "AIzaSyDUZOcnJQnv1f1f1FbHSiXmlwXBKfaeAaY"; // Replace with your actual API key

const API_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
const auth = getAuth(app);

const HEADER_HEIGHT_ESTIMATE = 15 * 2 + 24 + 10; // Estimated header height if you add one

const ChatScreen = () => {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const [loading, setLoading] = useState(false); // For AI response generation
    const [pdfLoading, setPdfLoading] = useState(false); // For PDF generation/saving
    const [user, setUser] = useState(auth.currentUser);
    const insets = useSafeAreaInsets();

    // Listen for authentication state changes
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
        });
        return unsubscribe;
    }, []);

    // Generates a UUID for message IDs
    const generateUUID = () => {
        return Platform.OS === "web"
            ? crypto.randomUUID()
            : Crypto.randomUUID();
    };

    // Sends a message to the AI model
    const sendMessage = useCallback(async () => {
        if (!input.trim() || loading || pdfLoading) return;

        const userMessage = {
            id: generateUUID(),
            text: input,
            sender: "user",
            timestamp: new Date().toISOString(), // Add timestamp
        };

        setMessages((prev) => [...prev, userMessage]);
        const currentInput = input; // Capture input before clearing
        setInput("");
        setLoading(true); // Start loading for AI response

        const requestBody = {
            contents: [
                {
                    role: "user",
                    parts: [{ text: currentInput }], // Use captured input
                },
            ],
        };

        const attemptRequest = async (retryCount = 0) => {
            try {
                const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(requestBody),
                });

                if (response.status === 429) {
                    const retryAfter = response.headers.get('Retry-After') || Math.pow(2, retryCount) * 1000;
                    console.log(`Rate limit exceeded. Retrying after ${retryAfter / 1000} seconds...`);
                    await new Promise(resolve => setTimeout(resolve, retryAfter));
                    return attemptRequest(retryCount + 1);
                }

                if (!response.ok) {
                    let errorText = "An error occurred while fetching response.";
                    try {
                        const errorData = await response.json();
                        errorText = errorData.error?.message || errorText;
                    } catch (parseError) {
                        console.error("Error parsing error response:", parseError);
                    }
                    throw new Error(`HTTP ${response.status}: ${errorText}`);
                }

                const data = await response.json();
                const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I didn't understand that.";

                const botMessage = {
                    id: generateUUID(),
                    text: aiText,
                    sender: "ai",
                    timestamp: new Date().toISOString(), // Add timestamp
                };

                setMessages((prev) => [...prev, botMessage]);

            } catch (error) {
                console.error("Gemini Error:", error);
                Alert.alert("Error", `Error: ${error.message}. Please try again later.`);
                setMessages((prev) => [
                    ...prev,
                    {
                        id: generateUUID(),
                        text: "Sorry, I couldn't respond due to an error.",
                        sender: "ai",
                        timestamp: new Date().toISOString(),
                    },
                ]);
            } finally {
                setLoading(false); // End loading for AI response
            }
        };

        attemptRequest();

    }, [input, loading, pdfLoading]);

    // --- PDF Generation Logic (Updated with Reversed B&W aesthetic in HTML) ---

    // Creates HTML content for a single message
    const createHtmlContentForMessage = (message) => {
        // Use marked to convert Markdown text to HTML.
        const htmlFromMarkdown = marked.parse(message.text);

        // Apply Reversed B&W styling to the HTML
        return `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>AI Response</title>
            <style>
                body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #000; margin: 40px; background-color: #FFF; line-height: 1.6; }
                .container { background-color: #FFF; padding: 30px; border-radius: 10px; border: 1px solid #333; box-shadow: 0 8px 16px rgba(0,0,0,0.1); }
                h1 { color: #000; text-align: center; margin-bottom: 25px; padding-bottom: 10px; border-bottom: 2px solid #000; font-size: 2em; font-weight: 600; }
                .response-section { margin-bottom: 20px; }
                .response-label { color: #555; font-size: 0.9em; margin-bottom: 8px; display: block; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; }
                .response-text { font-size: 1.1em; color: #000; padding: 15px; background-color: #F8F8F8; border-radius: 6px; border-left: 4px solid #000; white-space: pre-wrap; word-wrap: break-word; }
                /* Styling for tables generated from Markdown */
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-top: 15px;
                  margin-bottom: 15px;
                }
                th, td {
                  border: 1px solid #ddd;
                  padding: 8px;
                  text-align: left;
                }
                th {
                  background-color: #e0e0e0; /* Light gray header */
                  font-weight: bold;
                  color: #000;
                }
                tr:nth-child(even) {
                  background-color: #f2f2f2; /* Very light gray stripe */
                }
                /* Styling for code blocks within Markdown */
                pre {
                  background-color: #EFEFEF;
                  padding: 10px;
                  border-radius: 5px;
                  overflow-x: auto;
                }
                code {
                  font-family: Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace;
                  font-size: 0.95em;
                  color: #333;
                }
                pre code {
                  display: block;
                  padding: 0;
                }
                .metadata { text-align: right; font-size: 0.85em; color: #555; font-style: italic; margin-top: 25px; }
                .timestamp { margin-top: 5px; }
                @media print {
                  body { background-color: #fff; margin: 20px; }
                  .container { border: 1px solid #ccc; box-shadow: none; background-color: #fff; }
                  th { background-color: #d0d0d0; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>AI Response</h1>
                <div class="response-section">
                    <span class="response-label">Generated Response:</span>
                    <div class="response-text">${htmlFromMarkdown}</div>
                </div>
                <div class="metadata">
                    Powered by Gemini AI
                    <div class="timestamp">Generated on: ${new Date(message.timestamp || Date.now()).toLocaleString()}</div>
                </div>
            </div>
        </body>
        </html>
        `;
    };

    // Generates a PDF for a given AI message
    const generatePdfForMessage = async (messageToExport) => {
        console.log("Attempting to generate PDF for message:", messageToExport.id);
        if (!messageToExport || messageToExport.sender !== 'ai') {
            Alert.alert("Invalid Message", "Cannot generate PDF for this message type.");
            setPdfLoading(false);
            return;
        }
        if (!messageToExport.text) {
            Alert.alert("Empty Message", "Cannot generate PDF for an empty message.");
            setPdfLoading(false);
            return;
        }

        setPdfLoading(true);
        const htmlContent = createHtmlContentForMessage(messageToExport);

        try {
            console.log("Attempting to print to file...");
            const { uri } = await Print.printToFileAsync({
                html: htmlContent,
                width: 612, // Standard PDF width (8.5 inches at 72 dpi)
                height: 792, // Standard PDF height (11 inches at 72 dpi)
            });
            console.log("Print.printToFileAsync successful. URI:", uri);

            setPdfLoading(false);

            Alert.prompt(
                "Save or Share PDF",
                "What would you like to do with the generated PDF?",
                [
                    { text: "Save to Device", onPress: () => savePdfLocal(uri, messageToExport.id) },
                    { text: "Share", onPress: () => sharePdfFile(uri) },
                    { text: "Cancel", style: "cancel" },
                ],
                'default'
            );

        } catch (error) {
            console.error("Error generating PDF for message:", error);
            Alert.alert("PDF Error", `Failed to generate PDF: ${error.message}`);
            setPdfLoading(false);
        }
    };

    // Saves the generated PDF file locally
    const savePdfLocal = async (uri, messageId) => {
        setPdfLoading(true);
        try {
            const now = new Date();
            const formattedDate = `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}`;
            const formattedTime = `${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}${now.getSeconds().toString().padStart(2, '0')}`;
            const simpleId = messageId.substring(0, 8); // Use a portion of the ID for a simpler file name
            const fileName = `GeminiResponse_${simpleId}_${formattedDate}_${formattedTime}.pdf`;
            const destPath = `${FileSystem.documentDirectory}${fileName}`;

            console.log("Attempting to save PDF...");
            console.log("Source URI:", uri);
            console.log("Destination Path:", destPath);
            console.log("FileSystem.documentDirectory:", FileSystem.documentDirectory);

            const sourceExists = await FileSystem.getInfoAsync(uri);
            console.log("Source URI exists:", sourceExists.exists);

            if (!sourceExists.exists) {
                 throw new Error(`Source file does not exist at URI: ${uri}`);
            }

            await FileSystem.copyAsync({ from: uri, to: destPath });
            console.log("FileSystem.copyAsync successful.");

            // Provide guidance on where the file is saved, as documentDirectory is app-specific
            const locationMessage = `Your PDF is saved to your app's private document directory.\n\nFile Name: ${fileName}\nFull Path: ${destPath}\n\nOn iOS, you can usually find this in the "Files" app under "On My iPhone/iPad" > "YourAppFolder".\nOn Android, this is typically in "Internal Storage/Android/data/com.yourbundleid/files/Documents" but is generally best accessed via sharing.\n\nTo save to your device's public "Downloads" folder or share with other apps, please use the "Share" option.`;


            Alert.alert("Success", locationMessage);

        } catch (error) {
            console.error("Error saving PDF:", error);
            Alert.alert("Save Error", `Failed to save PDF: ${error.message}`);
        } finally {
            setPdfLoading(false);
        }
    };

    // Shares the generated PDF file
    const sharePdfFile = async (uri) => {
        setPdfLoading(true);
        try {
            console.log("Attempting to share PDF. URI:", uri);
            // UTI (Uniform Type Identifier) for PDF is 'com.adobe.pdf' on iOS, but '.pdf' works broadly
            // mimeType is standard
            await shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            console.log("shareAsync successful.");
        } catch (error) {
            console.error("Error sharing PDF:", error);
             if (error.message.includes("Operation not supported")) {
                 Alert.alert("Share Error", "Sharing may not be supported on this simulator/emulator or platform configuration.");
             } else {
                Alert.alert("Share Error", `Failed to share PDF: ${error.message}`);
             }
        } finally {
            setPdfLoading(false);
        }
    };

    // Renders individual chat messages in the FlatList
    const renderMessage = ({ item }) => {
        const isUser = item.sender === "user";
        return (
            // Potential source of the "Text strings must be rendered within a <Text> component" error
            // Ensure no direct text nodes exist outside of <Text> components here.
            <View style={[styles.messageRowWrapper, isUser ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }]}>
                <View
                    style={[
                        styles.messageContainer,
                        isUser ? styles.userMessage : styles.aiMessage,
                    ]}
                >
                    <Text style={[
                        styles.messageTextBase,
                        isUser ? styles.userMessageText : styles.aiMessageText
                    ]}>
                        {item.text}
                    </Text>

                    {/* Ensure PDF icon is only for AI messages and there is text */}
                    {!isUser && item.text && (
                        <TouchableOpacity
                            style={styles.pdfIconBubble}
                            onPress={() => {
                                console.log("PDF download icon pressed for message:", item.id);
                                generatePdfForMessage(item);
                            }}
                            disabled={pdfLoading} // Disable icon if PDF generation is in progress
                        >
                            <Ionicons
                                name="download-outline"
                                size={20}
                                // Icon color: Black on AI bubble, dark gray when loading
                                color={pdfLoading ? '#888' : '#000'}
                            />
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + HEADER_HEIGHT_ESTIMATE : 0}
        >
            {/* White and Black Gradient (Reversed) */}
            <LinearGradient colors={['#FFFFFF', '#CCCCCC']} style={styles.gradientBackground}>
                <View style={[styles.contentContainer, { paddingTop: insets.top }]}>
                    <FlatList
                        data={[...messages].reverse()} // Display latest messages at the bottom
                        renderItem={renderMessage}
                        keyExtractor={(item) => item.id}
                        inverted // Render list upside down to show new messages at the bottom
                        contentContainerStyle={styles.flatListContent}
                        style={styles.flatList}
                        showsVerticalScrollIndicator={false}
                    />

                    {/* Light Input Container */}
                    <View style={[styles.inputContainer, { paddingBottom: insets.bottom || 10 }]}>
                        {/* Dark Input Field */}
                        <TextInput
                            style={styles.input}
                            placeholder="Type your message here..."
                            placeholderTextColor="#444444" // Dark gray placeholder
                            value={input}
                            onChangeText={setInput}
                            // onSubmitEditing={sendMessage} // Using send button instead for multiline support
                            returnKeyType="send"
                            editable={!loading && !pdfLoading}
                            multiline
                        />
                        {/* White Send Button */}
                        <TouchableOpacity
                            style={[styles.sendButton, (loading || !input.trim() || pdfLoading) && styles.sendButtonDisabled]}
                            onPress={sendMessage}
                            disabled={loading || !input.trim() || pdfLoading}
                        >
                            {loading ? (
                                <ActivityIndicator size="small" color="#000000" /> // Black loading indicator
                            ) : (
                                <Ionicons name="send" size={24} color="#000000" /> // Black send icon
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </LinearGradient>

            {/* PDF Loading Overlay (Light) */}
            {pdfLoading && (
                <View style={styles.loadingOverlay}>
                    <ActivityIndicator size="large" color="#000000" /> {/* Black loading indicator */}
                    <Text style={styles.loadingText}>Generating and saving PDF...</Text>
                </View>
            )}

        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFF', // Fallback background
    },
    gradientBackground: {
        flex: 1,
    },
    contentContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    flatList: {
        flexGrow: 1,
    },
    flatListContent: {
        paddingHorizontal: 10,
        paddingBottom: 10,
    },
    messageRowWrapper: {
        marginVertical: 4,
        width: '100%',
        // alignItems is set inline based on sender
    },
    messageContainer: {
        paddingVertical: 12,
        paddingHorizontal: 15,
        borderRadius: 18,
        maxWidth: "85%",
        elevation: 2,
        shadowColor: '#000', // Shadows are still dark
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
    },
    userMessage: {
        backgroundColor: "#000000", // Black background for user bubble
        alignSelf: "flex-end",
        borderBottomRightRadius: 4,
        marginRight: 5,
    },
    aiMessage: {
        backgroundColor: "#FFFFFF", // White background for AI bubble (stays white)
        alignSelf: "flex-start",
        borderBottomLeftRadius: 4,
        marginLeft: 5,
        flexDirection: 'column', // Use column to stack text and icon
    },
    messageTextBase: {
        fontSize: 16,
        lineHeight: 22,
    },
    userMessageText: {
        color: "#FFFFFF", // White text on black bubble (stays white)
    },
    aiMessageText: {
        color: "#000000", // Black text on white bubble (stays black)
    },
    pdfIconBubble: {
        alignSelf: 'flex-end', // Align icon to the right within the AI bubble
        marginTop: 8, // Space between text and icon
        padding: 4,
        // Add padding around the icon for easier tapping
        paddingHorizontal: 8,
        paddingVertical: 6,
    },
    inputContainer: {
        flexDirection: "row",
        backgroundColor: "#FFFFFF", // White background for input area
        paddingHorizontal: 15,
        paddingTop: 12,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderTopWidth: 1,
        borderColor: '#CCCCCC', // Light gray border top
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -5 },
        shadowOpacity: 0.1, // Softer shadow
        shadowRadius: 8,
        alignItems: 'flex-end', // Align items to the bottom
    },
    input: {
        flex: 1,
        maxHeight: 100, // Limit input height
        borderWidth: 1,
        borderColor: '#CCCCCC', // Light gray border
        borderRadius: 20,
        paddingHorizontal: 18,
        paddingVertical: Platform.OS === 'ios' ? 12 : 10, // Adjust padding for platforms
        marginRight: 10,
        backgroundColor: '#E0E0E0', // Light gray input field
        fontSize: 16,
        color: '#000000', // Black text
        lineHeight: 20,
        borderCurve: 'circular', // Nicer rounded corners on supported platforms
    },
    sendButton: {
        width: 48,
        height: 48,
        backgroundColor: "#eaeaea", // Light gray background for the button itself
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.4,
        shadowRadius: 5,
        marginBottom: Platform.OS === 'ios' ? 0 : 2, // Adjust alignment for platforms
    },
    sendButtonDisabled: {
        backgroundColor: "#AAAAAA", // Lighter gray when disabled
        shadowOpacity: 0.1,
        elevation: 1,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(255, 255, 255, 0.7)', // Light translucent overlay
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000, // Ensure it's on top
    },
    loadingText: {
        marginTop: 10,
        fontSize: 18,
        color: '#000000', // Black text on light overlay
        fontWeight: '500',
    },
    // Removed unused styles: header, title
});

export default ChatScreen;