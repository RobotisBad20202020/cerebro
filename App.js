// App.js
import React, { useState, useEffect } from 'react';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList } from '@react-navigation/drawer';
import { TouchableOpacity, View, ActivityIndicator, StyleSheet, Text, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { auth } from './firebaseConfig';
import { onAuthStateChanged } from 'firebase/auth';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';

// Screens
import HomeScreen from './screens/HomeScreen';
import FlashcardScreen from './screens/FlashcardScreen';
import DecksScreen from './screens/DecksScreen';
import DeckDetailScreen from './screens/DeckDetailScreen';
import SignInScreen from './screens/SignInScreen';
import AccountScreen from './screens/AccountScreen';
import CreateFlashcardScreen from './screens/CreateFlashcardScreen';
import ChatScreen from './screens/ChatScreen';
import StudyPlannerScreen from './screens/StudyPlannerScreen';
import PdfSummarizerScreen from './screens/PdfSummarizerScreen';
import NoteMakerScreen from './screens/NoteMakerScreen';
import ManualNoteTakerScreen from "./screens/ManualNoteTakerScreen"
import YtVideoSummarizerScreen from './screens/YtVideoSummarizerScreen';
import SavedSummariesScreen from './screens/SavedSummariesScreen';
import NotesMade from './screens/NotesMade';
import NoteDetailScreen from './screens/NoteDetailsScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const DecksStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();
const Drawer = createDrawerNavigator();
const NotesDetailStack = createNativeStackNavigator();


// --- Custom Header Component ---
const CustomHeader = ({ navigation, currentRoute }) => {
    const insets = useSafeAreaInsets();

    // Dynamically get the title from the current route's options or name
    // This logic correctly drills down into nested navigators
    const getDeepestRoute = (route) => {
        if (route.state && route.state.routes[route.state.index]) {
            return getDeepestRoute(route.state.routes[route.state.index]);
        }
        return route;
    };

    const deepestRoute = getDeepestRoute(currentRoute);
    const title = deepestRoute?.options?.title || deepestRoute?.name || 'App';
    const canGoBack = navigation.canGoBack();

    const HEADER_CONTENT_HEIGHT = 50;

    const headerStyles = StyleSheet.create({
        container: {
            backgroundColor: '#FFFFFF', // White header background
            borderBottomWidth: 1,
            borderBottomColor: '#E0E0E0', // Light gray border
            width: '100%',
            height: HEADER_CONTENT_HEIGHT + insets.top,
            paddingTop: insets.top,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 15,
        },
        leftContainer: {
            width: 40,
            justifyContent: 'center',
            alignItems: 'flex-start',
        },
        centerContainer: {
            flex: 1,
            alignItems: 'center',
        },
        rightContainer: {
            width: 40,
            justifyContent: 'center',
            alignItems: 'flex-end',
        },
        titleText: {
            fontSize: 18,
            fontWeight: 'bold',
            color: '#000000', // Black title text
            textAlign: 'center',
        },
        iconButton: {
            padding: 5,
        },
    });

    return (
        <View style={headerStyles.container}>
            <View style={headerStyles.leftContainer}>
                {canGoBack ? (
                    <TouchableOpacity
                        style={headerStyles.iconButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Ionicons name="arrow-back" size={28} color="#000000" /> {/* Black icon */}
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity
                        style={headerStyles.iconButton}
                        onPress={() => navigation.openDrawer()}
                    >
                        <Ionicons name="menu" size={28} color="#000000" /> {/* Black icon */}
                    </TouchableOpacity>
                )}
            </View>

            <View style={headerStyles.centerContainer}>
                <Text style={headerStyles.titleText} numberOfLines={1}>{title}</Text>
            </View>

            <View style={headerStyles.rightContainer}>
                {/* Placeholder for potential right-side icon */}
            </View>
        </View>
    );
};

// --- Stack Navigators ---
function HomeStackScreen() {
    return (
        <HomeStack.Navigator screenOptions={{ headerShown: false }}>
            <HomeStack.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: 'Dashboard' }}
            />
            <HomeStack.Screen
                name="Flashcards"
                component={FlashcardScreen}
                options={{ title: 'Generated Flashcards' }}
            />

        </HomeStack.Navigator>
    );
}

function DecksStackScreen() {
    return (
        <DecksStack.Navigator screenOptions={{ headerShown: false }}>
            <DecksStack.Screen
                name="DecksList"
                component={DecksScreen}
                options={{ title: 'Your Decks' }}
            />
            <DecksStack.Screen
                name="DeckDetail"
                component={DeckDetailScreen}
                options={{ title: 'Deck Details' }}
            />

        </DecksStack.Navigator>
    );
}

function NotesDetailStackNavigator() {
    return (
        <NotesDetailStack.Navigator screenOptions={{ headerShown: false }}>
            <NotesDetailStack.Screen
                name="NoteDetail"
                component={NoteDetailScreen}
            />
        </NotesDetailStack.Navigator>
    );
}


// --- Bottom Tabs ---
function AppTabs() {
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                    let iconName;
                    if (route.name === 'HomeTab') iconName = focused ? 'home' : 'home-outline';
                    else if (route.name === 'CreateCardTab') iconName = focused ? 'add-circle' : 'add-circle-outline';
                    else if (route.name === 'DecksTab') iconName = focused ? 'library' : 'library-outline';
                    else if (route.name === 'AccountTab') iconName = focused ? 'person-circle' : 'person-circle-outline';
                    else if (route.name === 'ChatTab') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
                    return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: '#000000', // Active icon/label black
                tabBarInactiveTintColor: '#666666', // Inactive gray
                tabBarStyle: appStyles.tabBar,
                tabBarLabelStyle: appStyles.tabBarLabel,
                headerShown: false,
            })}
        >
            <Tab.Screen name="HomeTab" component={HomeStackScreen} options={{ title: 'Home' }} />
            <Tab.Screen
                name="CreateCardTab"
                component={CreateFlashcardScreen}
                options={{ title: 'Create Flashcards' }}
            />
            <Tab.Screen name="DecksTab" component={DecksStackScreen} options={{ title: 'Decks' }} />
            <Tab.Screen
                name="ChatTab"
                component={ChatScreen}
                options={{ title: 'Chat with AI' }}
            />
            <Tab.Screen
                name="AccountTab"
                component={AccountScreen}
                options={{ title: 'Account' }}
            />
        </Tab.Navigator>
    );
}

// --- Custom Drawer Content Component ---
function CustomDrawerContent(props) {
    return (
        <DrawerContentScrollView {...props}>
            <View style={drawerStyles.drawerHeader}>
                <Text style={drawerStyles.drawerHeaderText}>Memozise</Text> {/* App Name */}
            </View>
            <DrawerItemList {...props} />
        </DrawerContentScrollView>
    );
}

// --- Drawer Navigator ---
function AppDrawerNavigator() {
    return (
        <Drawer.Navigator
            initialRouteName="MainApp"
            drawerContent={(props) => <CustomDrawerContent {...props} />}
            screenOptions={({ navigation, route }) => ({
                drawerActiveTintColor: '#000000', // Active drawer item black
                drawerInactiveTintColor: '#666666', // Inactive drawer item gray
                drawerStyle: drawerStyles.drawerPanel,
                header: ({ options }) => {
                    const state = navigation.getState();
                    const mainRoute = state.routes[state.index];

                    let currentRouteToPass = mainRoute;
                    if (mainRoute.state) {
                        const nestedState = mainRoute.state;
                        currentRouteToPass = nestedState.routes[nestedState.index];
                        if (currentRouteToPass.state) {
                            const deeperNestedState = currentRouteToPass.state;
                            currentRouteToPass = deeperNestedState.routes[deeperNestedState.index];
                        }
                    }
                    return <CustomHeader navigation={navigation} currentRoute={currentRouteToPass} />;
                },
            })}
        >
            <Drawer.Screen
                name="MainApp"
                component={AppTabs}
                options={{
                    title: 'Dashboard',
                    drawerLabel: 'Dashboard & Main Features',
                    drawerItemStyle: drawerStyles.drawerItem,
                    drawerLabelStyle: drawerStyles.drawerLabel,
                }}
            />
            <Drawer.Screen
                name="StudyPlanner"
                component={StudyPlannerScreen}
                options={{
                    title: 'AI Study Planner',
                    drawerItemStyle: drawerStyles.drawerItem,
                    drawerLabelStyle: drawerStyles.drawerLabel,
                }}
            />
            <Drawer.Screen
                name="PdfSummarizer"
                component={PdfSummarizerScreen}
                options={{
                    title: 'PDF Summarizer',
                    drawerItemStyle: drawerStyles.drawerItem,
                    drawerLabelStyle: drawerStyles.drawerLabel,
                }}
            />
            <Drawer.Screen
                name="SavedSummaries"
                component={SavedSummariesScreen}
                options={{
                    title: 'Saved Summaries',
                    drawerLabel: 'Your Saved Summaries',
                    drawerItemStyle: drawerStyles.drawerItem,
                    drawerLabelStyle: drawerStyles.drawerLabel,
                }}
            />
            <Drawer.Screen
                name="NoteMaker"
                component={NoteMakerScreen}
                options={{
                    title: 'Create Note (from PDF)',
                    drawerLabel: 'Create Note (from PDF)',
                    drawerItemStyle: drawerStyles.drawerItem,
                    drawerLabelStyle: drawerStyles.drawerLabel,
                }}
            />
            <Drawer.Screen
                name="NotesMade"
                component={NotesMade}
                options={{
                    title: 'Saved Notes',
                    drawerLabel: 'Saved Notes',
                    drawerItemStyle: drawerStyles.drawerItem,
                    drawerLabelStyle: drawerStyles.drawerLabel,
                }}
            />
            <Drawer.Screen
                name="NotesDetailStack"
                component={NotesDetailStackNavigator}
                options={{
                    drawerItemStyle: { height: 0, overflow: 'hidden' },
                    title: 'Note Details (Hidden)',
                }}
            />
            <Drawer.Screen
                name="ManualNoteTaker"
                component={ManualNoteTakerScreen}
                options={{
                    title: 'Manual Notes',
                    drawerLabel: 'Manual Notes',
                    drawerItemStyle: drawerStyles.drawerItem,
                    drawerLabelStyle: drawerStyles.drawerLabel,
                }}
            />
            <Drawer.Screen
                name="YtVideoSummarizer"
                component={YtVideoSummarizerScreen}
                options={{
                    title: 'YouTube Summarizer',
                    drawerItemStyle: drawerStyles.drawerItem,
                    drawerLabelStyle: drawerStyles.drawerLabel,
                }}
            />
        </Drawer.Navigator>
    );
}

// --- App Component (Authentication Flow) ---
function App() {
    const [user, setUser] = useState(null);
    const [loadingAuth, setLoadingAuth] = useState(true);
    const navigationRef = useNavigationContainerRef();
    const [currentRoute, setCurrentRoute] = useState(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoadingAuth(false);
        });
        return unsubscribe;
    }, []);

    if (loadingAuth) {
        return (
            <View style={appStyles.loadingContainer}>
                <ActivityIndicator size="large" color="#000000" /> {/* Black spinner */}
                <Text style={appStyles.loadingText}>Loading authentication...</Text>
            </View>
        );
    }

    return (
        <SafeAreaProvider>
            <NavigationContainer
                ref={navigationRef}
                onReady={() => {
                    setCurrentRoute(navigationRef.getCurrentRoute());
                }}
                onStateChange={async () => {
                    const previousRoute = currentRoute;
                    const newRoute = navigationRef.getCurrentRoute();

                    if (previousRoute?.name !== newRoute?.name || previousRoute?.key !== newRoute?.key) {
                        setCurrentRoute(newRoute);
                    }
                }}
            >
                {user ? (
                    <AppDrawerNavigator />
                ) : (
                    <RootStack.Navigator screenOptions={{ headerShown: false }}>
                        <RootStack.Screen name="SignIn" component={SignInScreen} />
                    </RootStack.Navigator>
                )}
            </NavigationContainer>
        </SafeAreaProvider>
    );
}

const appStyles = StyleSheet.create({
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F8F8F8', // Light background
    },
    loadingText: {
        marginTop: 10,
        fontSize: 16,
        color: '#333333', // Dark gray
    },
    tabBar: {
        height: Platform.OS === 'ios' ? 90 : 60,
        paddingBottom: Platform.OS === 'ios' ? 30 : 5,
        backgroundColor: '#FFFFFF', // White tab bar
        borderTopWidth: 1,
        borderTopColor: '#E0E0E0', // Light gray border
    },
    tabBarLabel: {
        fontSize: 12,
        fontWeight: '500',
    },
});

const drawerStyles = StyleSheet.create({
    drawerHeader: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#EEEEEE', // Very light gray border
        backgroundColor: '#F8F8F8', // Light background for header
    },
    drawerHeaderText: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#000000', // Black text
    },
    drawerPanel: {
        width: '80%',
        backgroundColor: '#FFFFFF', // White drawer background
    },
    drawerItem: {
        marginVertical: 5,
        marginHorizontal: 10,
        borderRadius: 8,
    },
    drawerLabel: {
        marginLeft: 0,
        fontSize: 15,
        fontWeight: '500',
    },
});

export default App;