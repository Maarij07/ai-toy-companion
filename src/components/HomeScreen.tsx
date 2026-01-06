import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Animated,
  RefreshControl,
  Dimensions,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { SafeAreaView } from 'react-native-safe-area-context';

// Import other screens for tab navigation
import MarketplaceScreen from './MarketplaceScreen';
import CartScreen from './CartScreen';
import SettingsScreen from './SettingsScreen';
import ProductDetailScreen from './ProductDetailScreen';

const colors = {
  primary: '#6D8B74',
  secondary: '#FFD166',
  error: '#EF7C8E',
  background: '#F8F4E9',
  surface: '#FFFFFF',
  surfaceLight: '#F0F0F0',
  textPrimary: '#3C3C3C',
  textSecondary: '#888888',
  textTertiary: '#B0B0B0',
  textLight: '#F8F4E9',
};

const { width } = Dimensions.get('window');

interface NewHomeContentProps {
  onNavigateToHome?: () => void;
  personalityPopupVisible: boolean;
  setPersonalityPopupVisible: React.Dispatch<React.SetStateAction<boolean>>;
  modePopupVisible: boolean;
  setModePopupVisible: React.Dispatch<React.SetStateAction<boolean>>;
  convosPopupVisible: boolean;
  setConvosPopupVisible: React.Dispatch<React.SetStateAction<boolean>>;
  chatPopupVisible: boolean;
  setChatPopupVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

const NewHomeContent = ({ 
  onNavigateToHome, 
  personalityPopupVisible, 
  setPersonalityPopupVisible, 
  modePopupVisible, 
  setModePopupVisible, 
  convosPopupVisible, 
  setConvosPopupVisible, 
  chatPopupVisible, 
  setChatPopupVisible 
}: NewHomeContentProps) => {
  const [refreshing, setRefreshing] = useState(false);
  const [toyStatus, setToyStatus] = useState('online');

  const fadeAnim = new Animated.Value(0);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1500);
  };

  const mockToyData = {
    name: 'Buddy the Bear',
    status: toyStatus,
    mood: 'happy',
    lastInteraction: '2 hours ago',
  };

  const quickActions = [
    { id: 'customize', title: 'Customize', subtitle: 'Personality traits', icon: 'sparkles-outline', color: colors.primary },
    { id: 'safety', title: 'Safety', subtitle: 'Parental controls', icon: 'shield-checkmark-outline', color: colors.error },
    { id: 'activity', title: 'Activity', subtitle: 'Recent interactions', icon: 'time-outline', color: colors.secondary },
    { id: 'progress', title: 'Progress', subtitle: 'Track development', icon: 'trending-up-outline', color: colors.primary },
  ];

  const parentalControls = [
    { id: 'safetyMode', label: 'Safety Mode', icon: 'shield-checkmark-outline', enabled: true },
    { id: 'screenTime', label: 'Screen Time', icon: 'timer-outline', enabled: true },
    { id: 'contentFilter', label: 'Content Filter', icon: 'filter-outline', enabled: true },
  ];

  const [parentalControlStates, setParentalControlStates] = useState(
    parentalControls.reduce((acc, control) => {
      acc[control.id] = control.enabled;
      return acc;
    }, {} as Record<string, boolean>)
  );

  const recentActivities = [
    { id: 1, time: '2h ago', type: 'Story', description: 'Buddy told a bedtime story', icon: 'book-outline' },
    { id: 2, time: '4h ago', type: 'Game', description: 'Played "Guess the Animal"', icon: 'game-controller-outline' },
    { id: 3, time: 'Yesterday', type: 'Chat', description: 'Discussed favorite colors', icon: 'chatbubble-outline' },
  ];

  const toggleParentalControl = (id: string) => {
    setParentalControlStates(prev => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  if (toyStatus === 'offline') {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.offlineCard}>
          <View style={styles.offlineIconContainer}>
            <Icon name="power-outline" size={48} color={colors.textTertiary} />
          </View>
          <Text style={styles.offlineTitle}>Buddy is offline</Text>
          <Text style={styles.offlineSubtitle}>Connect your toy to continue</Text>
          <TouchableOpacity style={styles.connectButton} onPress={() => setToyStatus('online')}>
            <Text style={styles.connectButtonText}>Reconnect Toy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Greeting */}
          <View style={styles.greetingSection}>
            <Text style={styles.greeting}>Good morning, Sarah!</Text>
            <Text style={styles.greetingSubtitle}>Welcome back</Text>
          </View>

          {/* Toy Status Card */}
          <View style={styles.toyCard}>
            <View style={styles.toyHeader}>
              <View style={styles.toyAvatar}>
                <Text style={styles.toyAvatarText}>BB</Text>
              </View>
              <View style={styles.toyInfo}>
                <Text style={styles.toyName}>{mockToyData.name}</Text>
                <View style={styles.statusRow}>
                  <View style={[styles.statusDot, { backgroundColor: colors.primary }]} />
                  <Text style={styles.statusText}>Connected</Text>
                </View>
                <Text style={styles.lastInteraction}>Last active {mockToyData.lastInteraction}</Text>
              </View>
            </View>

            <View style={styles.moodSection}>
              <Text style={styles.moodLabel}>Mood</Text>
              <Text style={styles.moodValue}>😊 Happy</Text>
            </View>

            <View style={styles.toyActionsGrid}>
              <TouchableOpacity 
                style={styles.toyActionCard}
                onPress={() => setPersonalityPopupVisible(true)}
              >
                <Icon name="person-outline" size={20} color={colors.primary} />
                <Text style={styles.toyActionLabel}>Personality</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.toyActionCard}
                onPress={() => setModePopupVisible(true)}
              >
                <Icon name="layers-outline" size={20} color={colors.primary} />
                <Text style={styles.toyActionLabel}>Mode</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.toyActionCard}
                onPress={() => setConvosPopupVisible(true)}
              >
                <Icon name="chatbubbles-outline" size={20} color={colors.primary} />
                <Text style={styles.toyActionLabel}>Convos</Text>
              </TouchableOpacity>
              
              <TouchableOpacity style={styles.toyActionCard}>
                <Icon name="settings-outline" size={20} color={colors.primary} />
                <Text style={styles.toyActionLabel}>Settings</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Add New Toy */}
          <TouchableOpacity style={styles.addToyButton}>
            <Icon name="add-circle-outline" size={22} color={colors.primary} />
            <Text style={styles.addToyText}>Add New Toy</Text>
          </TouchableOpacity>

          {/* Quick Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <View style={styles.quickActionsGrid}>
              {quickActions.map((action) => (
                <TouchableOpacity key={action.id} style={styles.quickActionCard}>
                  <Icon name={action.icon} size={24} color={action.color} />
                  <Text style={styles.quickActionTitle}>{action.title}</Text>
                  <Text style={styles.quickActionSubtitle}>{action.subtitle}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Parental Controls */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Parental Controls</Text>
            <View style={styles.controlsCard}>
              {parentalControls.map((control, index) => (
                <View 
                  key={control.id} 
                  style={[
                    styles.controlItem,
                    index !== parentalControls.length - 1 && styles.controlItemBorder
                  ]}
                >
                  <View style={styles.controlLeft}>
                    <Icon name={control.icon} size={20} color={colors.textPrimary} />
                    <Text style={styles.controlLabel}>{control.label}</Text>
                  </View>
                  <TouchableOpacity
                    style={[
                      styles.toggle,
                      { backgroundColor: parentalControlStates[control.id] ? colors.primary : '#E0E0E0' }
                    ]}
                    onPress={() => toggleParentalControl(control.id)}
                  >
                    <View style={[
                      styles.toggleThumb,
                      { transform: [{ translateX: parentalControlStates[control.id] ? 18 : 0 }] }
                    ]} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>

          {/* Recent Activity */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentActivities.map((activity) => (
              <TouchableOpacity key={activity.id} style={styles.activityCard}>
                <View style={styles.activityIconContainer}>
                  <Icon name={activity.icon} size={20} color={colors.primary} />
                </View>
                <View style={styles.activityContent}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityType}>{activity.type}</Text>
                    <Text style={styles.activityTime}>{activity.time}</Text>
                  </View>
                  <Text style={styles.activityDescription}>{activity.description}</Text>
                </View>
                <Icon name="chevron-forward" size={20} color={colors.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.bottomSpacer} />
        </Animated.View>
      </ScrollView>
      
      {/* Modals */}
      <Modal
        visible={personalityPopupVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPersonalityPopupVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPersonalityPopupVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Personality</Text>
            {['Friendly Helper', 'Science Explorer', 'Creative Artist', 'Storyteller', 'Smart Teacher'].map((item) => (
              <TouchableOpacity key={item} style={styles.modalItem}>
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={() => setPersonalityPopupVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={modePopupVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setModePopupVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setModePopupVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Mode</Text>
            {[
              { icon: '💬', label: 'Chat Mode' },
              { icon: '🎤', label: 'Rap Mode' },
              { icon: '🤔', label: 'Debate Mode' },
              { icon: '🤗', label: 'Counselor Mode' },
              { icon: '📚', label: 'Tutor Mode' }
            ].map((item) => (
              <TouchableOpacity key={item.label} style={styles.modalItem}>
                <Text style={styles.modalItemText}>{item.icon} {item.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={() => setModePopupVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={convosPopupVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setConvosPopupVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setConvosPopupVisible(false)}
          />
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Start Conversation</Text>
            {['Chat', 'Voice', 'Video'].map((item) => (
              <TouchableOpacity 
                key={item} 
                style={styles.modalItem}
                onPress={() => {
                  setConvosPopupVisible(false);
                  if (item === 'Chat') setChatPopupVisible(true);
                }}
              >
                <Text style={styles.modalItemText}>{item}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity 
              style={styles.modalButton} 
              onPress={() => setConvosPopupVisible(false)}
            >
              <Text style={styles.modalButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={chatPopupVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setChatPopupVisible(false)}
      >
        <View style={styles.chatModal}>
          <View style={styles.chatHeader}>
            <Text style={styles.chatTitle}>Chat with Buddy</Text>
            <TouchableOpacity onPress={() => setChatPopupVisible(false)}>
              <Icon name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.chatMessages}>
            <View style={styles.messageBubbleBot}>
              <Text style={styles.messageText}>Hello! How can I help you today?</Text>
            </View>
            <View style={styles.messageBubbleUser}>
              <Text style={[styles.messageText, { color: '#FFFFFF' }]}>Can you tell me a story?</Text>
            </View>
            <View style={styles.messageBubbleBot}>
              <Text style={styles.messageText}>Of course! Once upon a time...</Text>
            </View>
          </ScrollView>
          <View style={styles.chatInputContainer}>
            <TouchableOpacity style={styles.chatIconButton}>
              <Icon name="mic-outline" size={22} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.chatInput}>
              <Text style={styles.chatPlaceholder}>Type a message...</Text>
            </View>
            <TouchableOpacity style={styles.chatIconButton}>
              <Icon name="send" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

const HomeScreen = ({ onNavigateToHome }: { onNavigateToHome?: () => void; }) => {
  const [activeTab, setActiveTab] = useState('Home');
  const [isNotificationDrawerVisible, setNotificationDrawerVisible] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  
  // Popup states for home content
  const [personalityPopupVisible, setPersonalityPopupVisible] = useState(false);
  const [modePopupVisible, setModePopupVisible] = useState(false);
  const [convosPopupVisible, setConvosPopupVisible] = useState(false);
  const [chatPopupVisible, setChatPopupVisible] = useState(false);

  const renderTabContent = () => {
    if (detailProduct) {
      return (
        <ProductDetailScreen 
          product={detailProduct} 
          onGoBack={() => setDetailProduct(null)}
        />
      );
    }
    
    switch (activeTab) {
      case 'Marketplace':
        return <MarketplaceScreen onNavigateToProductDetail={setDetailProduct} />;
      case 'Cart':
        return <CartScreen />;
      case 'Settings':
        return <SettingsScreen />;
      default:
        return (
          <>
            <View style={styles.header}>
              <TouchableOpacity 
                style={styles.headerButton} 
                onPress={() => {}}
              >
                <Icon name="person-circle-outline" size={28} color={colors.textPrimary} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.headerButton}
                onPress={() => setNotificationDrawerVisible(true)}
              >
                <Icon name="notifications-outline" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <NewHomeContent 
              onNavigateToHome={onNavigateToHome}
              personalityPopupVisible={personalityPopupVisible}
              setPersonalityPopupVisible={setPersonalityPopupVisible}
              modePopupVisible={modePopupVisible}
              setModePopupVisible={setModePopupVisible}
              convosPopupVisible={convosPopupVisible}
              setConvosPopupVisible={setConvosPopupVisible}
              chatPopupVisible={chatPopupVisible}
              setChatPopupVisible={setChatPopupVisible}
            />
          </>
        );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {renderTabContent()}
      
      {/* Tab Bar - Only show when not viewing product detail */}
      {detailProduct ? null : (
        <View style={styles.tabBar}>
          {[
            { name: 'Home', icon: 'home-outline' },
            { name: 'Marketplace', icon: 'storefront-outline' },
            { name: 'Cart', icon: 'cart-outline' },
            { name: 'Settings', icon: 'settings-outline' }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.name}
              style={styles.tabItem}
              onPress={() => setActiveTab(tab.name)}
            >
              <Icon 
                name={tab.icon} 
                size={24} 
                color={activeTab === tab.name ? colors.primary : colors.textSecondary} 
              />
              <Text style={[
                styles.tabLabel,
                activeTab === tab.name && styles.tabLabelActive
              ]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Notification Drawer */}
      <Modal
        visible={isNotificationDrawerVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setNotificationDrawerVisible(false)}
      >
        <View style={styles.drawerOverlay}>
          <TouchableOpacity 
            style={styles.drawerBackdrop}
            activeOpacity={1}
            onPress={() => setNotificationDrawerVisible(false)}
          />
          <View style={styles.drawerContent}>
            <View style={styles.drawerHeader}>
              <Text style={styles.drawerTitle}>Notifications</Text>
              <TouchableOpacity onPress={() => setNotificationDrawerVisible(false)}>
                <Icon name="close" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              {[
                { icon: 'notifications', color: colors.primary, title: 'New message from Buddy', subtitle: 'Buddy sent you a special message', time: '2 min ago' },
                { icon: 'gift', color: colors.secondary, title: 'Special offer', subtitle: 'New toy available at 20% discount', time: '1 hour ago' },
                { icon: 'calendar', color: colors.error, title: 'Reminder', subtitle: "Don't forget to update Buddy's personality", time: '3 hours ago' }
              ].map((notif, index) => (
                <TouchableOpacity key={index} style={styles.notificationItem}>
                  <View style={[styles.notifIcon, { backgroundColor: `${notif.color}20` }]}>
                    <Icon name={notif.icon} size={20} color={notif.color} />
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={styles.notifTitle}>{notif.title}</Text>
                    <Text style={styles.notifSubtitle}>{notif.subtitle}</Text>
                    <Text style={styles.notifTime}>{notif.time}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  headerButton: {
    padding: 4,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  greetingSection: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  greetingSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  toyCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  toyHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  toyAvatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  toyAvatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  toyInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  toyName: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  lastInteraction: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  moodSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  moodLabel: {
    fontSize: 15,
    color: colors.textSecondary,
    marginRight: 8,
  },
  moodValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  toyActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  toyActionCard: {
    width: '48%',
    paddingVertical: 16,
    backgroundColor: colors.surfaceLight,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  toyActionLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
    marginTop: 6,
  },
  addToyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    paddingVertical: 14,
    marginBottom: 24,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
  },
  addToyText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
    marginLeft: 8,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionCard: {
    width: (width - 52) / 2,
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  quickActionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 2,
  },
  quickActionSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  controlsCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  controlItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  controlItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  controlLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  controlLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 2,
    elevation: 1,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  activityType: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  activityTime: {
    fontSize: 12,
    color: colors.textTertiary,
  },
  activityDescription: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  offlineCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 40,
    alignItems: 'center',
    marginTop: 40,
  },
  offlineIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  offlineTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  offlineSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  connectButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
  },
  connectButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  bottomSpacer: {
    height: 20,
  },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLight,
    paddingVertical: 8,
    paddingBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 20,
    width: width * 0.85,
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 16,
    textAlign: 'center',
  },
  modalItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  modalItemText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  modalButton: {
    marginTop: 16,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  chatModal: {
    flex: 1,
    backgroundColor: colors.surface,
    marginTop: 60,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  chatMessages: {
    flex: 1,
    padding: 16,
  },
  messageBubbleBot: {
    backgroundColor: colors.surfaceLight,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    padding: 12,
    marginBottom: 10,
    alignSelf: 'flex-start',
    maxWidth: '75%',
  },
  messageBubbleUser: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    borderTopRightRadius: 4,
    padding: 12,
    marginBottom: 10,
    alignSelf: 'flex-end',
    maxWidth: '75%',
  },
  messageText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceLight,
    gap: 10,
  },
  chatIconButton: {
    padding: 8,
  },
  chatInput: {
    flex: 1,
    backgroundColor: colors.surfaceLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  chatPlaceholder: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  drawerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  drawerBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  drawerContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  drawerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  drawerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  notificationItem: {
    flexDirection: 'row',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  notifContent: {
    flex: 1,
  },
  notifTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  notifSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  notifTime: {
    fontSize: 12,
    color: colors.textTertiary,
  },
});

export default HomeScreen;