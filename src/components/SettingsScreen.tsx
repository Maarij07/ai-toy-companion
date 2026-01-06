import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
const colors = require('../config/colors');

const SettingsScreen = ({ onNavigateToHome }: { onNavigateToHome?: () => void; }) => {
  // State for toggle switches
  const [profanityFilter, setProfanityFilter] = useState(true);
  const [internetAccess, setInternetAccess] = useState(true);
  const [voicePreview, setVoicePreview] = useState(false);
  const [dataCollection, setDataCollection] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [soundHaptics, setSoundHaptics] = useState(true);

  // Mock user data
  const [userData] = useState({
    name: 'Alex Johnson',
    email: 'alex.johnson@example.com',
    profilePic: null, // In a real app, this would be an image URL
  });

  // Mock connected toys
  const [connectedToys] = useState([
    { id: 'njsf', name: 'AB-001-2024' }
  ]);

  // Mock subscription data
  const [subscriptionData] = useState({
    active: true,
    nextBilling: 'Nov 6, 2024',
    amount: '$9.99',
    period: '/month'
  });

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <TouchableOpacity style={styles.headerLeftButton}>
          <Icon name="person-circle-outline" size={28} color={colors.textPrimary} />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>Settings</Text>
        
        <TouchableOpacity style={styles.headerRightButton}>
          <Icon name="notifications-outline" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>
      
      <ScrollView contentContainerStyle={styles.content}>
        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.profileHeader}>
            <View style={styles.profilePicContainer}>
              {userData.profilePic ? (
                <Image source={{ uri: userData.profilePic }} style={styles.profilePic} />
              ) : (
                <View style={styles.profilePicPlaceholder}>
                  <Text style={styles.profilePicInitials}>
                    {userData.name.charAt(0)}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{userData.name}</Text>
              <Text style={styles.profileEmail}>{userData.email}</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.editButton}>
            <Text style={styles.editButtonText}>Edit Profile</Text>
          </TouchableOpacity>
        </View>

        {/* Safety & Parental Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Safety & Parental Controls</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Profanity Filter</Text>
              <Text style={styles.settingSubtitle}>Block inappropriate language</Text>
            </View>
            <Switch
              value={profanityFilter}
              onValueChange={setProfanityFilter}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={profanityFilter ? colors.textLight : colors.textTertiary}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Internet Access</Text>
              <Text style={styles.settingSubtitle}>Allow toy to access online content</Text>
            </View>
            <Switch
              value={internetAccess}
              onValueChange={setInternetAccess}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={internetAccess ? colors.textLight : colors.textTertiary}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Daily Time Limit</Text>
              <Text style={styles.settingSubtitle}>Maximum play time per day</Text>
            </View>
            <Text style={styles.timeLimit}>60 min</Text>
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Voice Preview</Text>
              <Text style={styles.settingSubtitle}>Preview responses before toy speaks</Text>
            </View>
            <Switch
              value={voicePreview}
              onValueChange={setVoicePreview}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={voicePreview ? colors.textLight : colors.textTertiary}
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingTitle}>Data Collection</Text>
              <Text style={styles.settingSubtitle}>Allow usage analytics for improvement</Text>
            </View>
            <Switch
              value={dataCollection}
              onValueChange={setDataCollection}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={dataCollection ? colors.textLight : colors.textTertiary}
            />
          </View>
        </View>

        {/* Connected Toys */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Connected Toys</Text>
          {connectedToys.map((toy, index) => (
            <View key={index} style={styles.toyItem}>
              <Text style={styles.toyId}>{toy.id}</Text>
              <Text style={styles.toyName}>{toy.name}</Text>
            </View>
          ))}
        </View>

        {/* App Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Preferences</Text>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingTitle}>Push Notifications</Text>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={pushNotifications ? colors.textLight : colors.textTertiary}
            />
          </View>
          
          <View style={styles.settingItem}>
            <Text style={styles.settingTitle}>Sound & Haptics</Text>
            <Switch
              value={soundHaptics}
              onValueChange={setSoundHaptics}
              trackColor={{ false: colors.surfaceLight, true: colors.primary }}
              thumbColor={soundHaptics ? colors.textLight : colors.textTertiary}
            />
          </View>
          
          <TouchableOpacity style={styles.buttonItem}>
            <Text style={styles.buttonItemText}>Rate App</Text>
          </TouchableOpacity>
        </View>

        {/* Subscription & Billing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subscription & Billing</Text>
          
          <View style={styles.subscriptionItem}>
            <View style={styles.subscriptionInfo}>
              <Text style={styles.subscriptionTitle}>Premium Plan</Text>
              <Text style={styles.subscriptionStatus}>
                {subscriptionData.active ? 'Active' : 'Inactive'}
              </Text>
              <Text style={styles.subscriptionBilling}>
                Next billing: {subscriptionData.nextBilling}
              </Text>
            </View>
            <View style={styles.subscriptionPrice}>
              <Text style={styles.subscriptionAmount}>{subscriptionData.amount}</Text>
              <Text style={styles.subscriptionPeriod}>{subscriptionData.period}</Text>
            </View>
          </View>
          
          <TouchableOpacity style={styles.buttonItem}>
            <Text style={styles.buttonItemText}>Manage Subscription</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.buttonItem}>
            <Text style={styles.buttonItemText}>Purchase History</Text>
          </TouchableOpacity>
        </View>

        {/* Support & Help */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support & Help</Text>
          
          <TouchableOpacity style={styles.buttonItem}>
            <Text style={styles.buttonItemText}>Help Center</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.buttonItem}>
            <Text style={styles.buttonItemText}>Contact Support</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.buttonItem}>
            <Text style={styles.buttonItemText}>Privacy Policy</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.buttonItem}>
            <Text style={styles.buttonItemText}>Terms of Service</Text>
          </TouchableOpacity>
        </View>

        {/* Sign Out */}
        <View style={styles.signOutSection}>
          <TouchableOpacity style={styles.signOutButton}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingTop: 10,
    paddingBottom: 100,
  },
  section: {
    backgroundColor: colors.surface,
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.textTertiary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  profilePicContainer: {
    marginRight: 16,
  },
  profilePic: {
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  profilePicPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profilePicInitials: {
    fontSize: 24,
    fontWeight: '600',
    color: colors.textLight,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  profileEmail: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  editButton: {
    backgroundColor: colors.primary,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  toyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  toyId: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  toyName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  settingInfo: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  timeLimit: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  buttonItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  buttonItemText: {
    fontSize: 16,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  subscriptionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  subscriptionInfo: {
    flex: 1,
  },
  subscriptionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subscriptionStatus: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
    marginBottom: 4,
  },
  subscriptionBilling: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  subscriptionPrice: {
    alignItems: 'flex-end',
  },
  subscriptionAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subscriptionPeriod: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  signOutSection: {
    marginHorizontal: 20,
  },
  signOutButton: {
    backgroundColor: colors.error,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  headerLeftButton: {
    padding: 8,
  },
  headerRightButton: {
    padding: 8,
  },
  headerCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 32,
    height: 32,
  },
});

export default SettingsScreen;