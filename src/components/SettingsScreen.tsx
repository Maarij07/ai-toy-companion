import React, { useState } from 'react';
import {
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Box, 
  Text, 
  Button, 
  ButtonText, 
  VStack, 
  HStack, 
  Avatar,
  AvatarFallbackText,
  Heading,
  Pressable,
  Switch,
  Icon
} from '@gluestack-ui/themed';
import { 
  User, 
  Bell, 
  LogOut, 
  Star, 
  Shield, 
  Gamepad2, 
  Receipt, 
  Heart, 
  HelpCircle,
  FileText,
  Lock,
  ChevronRight
} from 'lucide-react-native';

interface SettingsScreenProps {
  onNavigateToHome?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigateToHome }) => {
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

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Sign Out',
          onPress: async () => {
            try {
              // Simulate logout
              console.log('User logged out');
              // In a real app without DB, you might clear local storage/session
            } catch (error: any) {
              console.error('Logout error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
            }
          },
          style: 'destructive',
        },
      ],
      { cancelable: false }
    );
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <VStack flex={1}>
        {/* Sticky Header */}
        <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
          <Pressable p="$2">
            <Icon as={User} size="xl" color="$textDark800" />
          </Pressable>
          
          <Heading size="md" color="$textDark800">Settings</Heading>
          
          <Pressable p="$2">
            <Icon as={Bell} size="lg" color="$textDark800" />
          </Pressable>
        </HStack>
        
        {/* Scrollable Content */}
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, flexGrow: 1 }}>
          {/* Profile Section */}
          <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
            <HStack alignItems="center" mb="$4">
              <Avatar size="xl" bg="$primary500" mr="$3">
                <AvatarFallbackText>{userData.name.split(' ').map(n => n[0]).join('')}</AvatarFallbackText>
              </Avatar>
              <VStack flex={1}>
                <Heading size="sm" color="$textDark800">{userData.name}</Heading>
                <Text size="sm" color="$textDark500">{userData.email}</Text>
              </VStack>
              <Button variant="outline" size="sm" borderRadius="$full" px="$4">
                <ButtonText>Edit Profile</ButtonText>
              </Button>
            </HStack>
          </Box>

          {/* Safety & Parental Controls */}
          <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
            <HStack alignItems="center" mb="$3">
              <Icon as={Shield} size="sm" color="$primary500" mr="$2" />
              <Heading size="sm" color="$textDark800">Safety & Parental Controls</Heading>
            </HStack>
            
            <VStack space="md">
              <HStack justifyContent="space-between" alignItems="center" py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <VStack flex={1}>
                  <FormControlLabel mb="$1">
                    <FormControlLabelText color="$textDark800">Profanity Filter</FormControlLabelText>
                  </FormControlLabel>
                  <Text size="sm" color="$textDark500">Block inappropriate language</Text>
                </VStack>
                <Switch 
                  isChecked={profanityFilter} 
                  onToggle={(e) => setProfanityFilter(!!e)}
                />
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <VStack flex={1}>
                  <FormControlLabel mb="$1">
                    <FormControlLabelText color="$textDark800">Internet Access</FormControlLabelText>
                  </FormControlLabel>
                  <Text size="sm" color="$textDark500">Allow toy to access online content</Text>
                </VStack>
                <Switch 
                  isChecked={internetAccess} 
                  onToggle={(e) => setInternetAccess(!!e)}
                />
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <VStack flex={1}>
                  <FormControlLabel mb="$1">
                    <FormControlLabelText color="$textDark800">Daily Time Limit</FormControlLabelText>
                  </FormControlLabel>
                  <Text size="sm" color="$textDark500">Maximum play time per day</Text>
                </VStack>
                <Text size="md" fontWeight="$medium" color="$primary500">60 min</Text>
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <VStack flex={1}>
                  <FormControlLabel mb="$1">
                    <FormControlLabelText color="$textDark800">Voice Preview</FormControlLabelText>
                  </FormControlLabel>
                  <Text size="sm" color="$textDark500">Preview responses before toy speaks</Text>
                </VStack>
                <Switch 
                  isChecked={voicePreview} 
                  onToggle={(e) => setVoicePreview(!!e)}
                />
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$3">
                <VStack flex={1}>
                  <FormControlLabel mb="$1">
                    <FormControlLabelText color="$textDark800">Data Collection</FormControlLabelText>
                  </FormControlLabel>
                  <Text size="sm" color="$textDark500">Allow usage analytics for improvement</Text>
                </VStack>
                <Switch 
                  isChecked={dataCollection} 
                  onToggle={(e) => setDataCollection(!!e)}
                />
              </HStack>
            </VStack>
          </Box>

          {/* Connected Toys */}
          <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
            <HStack alignItems="center" mb="$3">
              <Icon as={Gamepad2} size="sm" color="$primary500" mr="$2" />
              <Heading size="sm" color="$textDark800">Connected Toys</Heading>
            </HStack>
            <VStack space="sm">
              {connectedToys.map((toy, index) => (
                <HStack key={index} justifyContent="space-between" alignItems="center" py="$2" px="$3" bg="$backgroundLight50" borderRadius="$md">
                  <Text size="sm" color="$textDark800">{toy.name}</Text>
                  <Text size="xs" color="$textDark500">{toy.id}</Text>
                </HStack>
              ))}
            </VStack>
          </Box>

          {/* App Preferences */}
          <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
            <HStack alignItems="center" mb="$3">
              <Icon as={Heart} size="sm" color="$primary500" mr="$2" />
              <Heading size="sm" color="$textDark800">App Preferences</Heading>
            </HStack>
            
            <VStack space="md">
              <HStack justifyContent="space-between" alignItems="center" py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <Text size="md" color="$textDark800">Push Notifications</Text>
                <Switch 
                  isChecked={pushNotifications} 
                  onToggle={(e) => setPushNotifications(!!e)}
                />
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <Text size="md" color="$textDark800">Sound & Haptics</Text>
                <Switch 
                  isChecked={soundHaptics} 
                  onToggle={(e) => setSoundHaptics(!!e)}
                />
              </HStack>
              
              <Pressable py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <HStack alignItems="center">
                  <Icon as={Star} size="md" color="$textDark500" mr="$3" />
                  <Text size="md" color="$textDark800">Rate App</Text>
                </HStack>
              </Pressable>
            </VStack>
          </Box>

          {/* Subscription & Billing */}
          <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
            <HStack alignItems="center" mb="$3">
              <Icon as={Receipt} size="sm" color="$primary500" mr="$2" />
              <Heading size="sm" color="$textDark800">Subscription & Billing</Heading>
            </HStack>
            
            <Box bg="$primary500" borderRadius="$md" p="$3" mb="$3">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text size="md" fontWeight="$medium" color="$textLight50">Premium Plan</Text>
                  <Text size="sm" fontWeight="$medium" color="$textLight50">{subscriptionData.active ? 'Active' : 'Inactive'}</Text>
                  <Text size="sm" color="$textLight50">Next billing: {subscriptionData.nextBilling}</Text>
                </VStack>
                <VStack alignItems="flex-end">
                  <Text size="lg" fontWeight="$bold" color="$textLight50">{subscriptionData.amount}</Text>
                  <Text size="sm" color="$textLight50">{subscriptionData.period}</Text>
                </VStack>
              </HStack>
            </Box>
            
            <VStack space="sm">
              <Pressable py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center">
                    <Icon as={Receipt} size="md" color="$textDark500" mr="$3" />
                    <Text size="md" color="$textDark800">Manage Subscription</Text>
                  </HStack>
                  <Icon as={ChevronRight} size="md" color="$textDark500" />
                </HStack>
              </Pressable>
              
              <Pressable py="$3">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center">
                    <Icon as={Receipt} size="md" color="$textDark500" mr="$3" />
                    <Text size="md" color="$textDark800">Purchase History</Text>
                  </HStack>
                  <Icon as={ChevronRight} size="md" color="$textDark500" />
                </HStack>
              </Pressable>
            </VStack>
          </Box>

          {/* Support & Help */}
          <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
            <HStack alignItems="center" mb="$3">
              <Icon as={HelpCircle} size="sm" color="$primary500" mr="$2" />
              <Heading size="sm" color="$textDark800">Support & Help</Heading>
            </HStack>
            
            <VStack space="sm">
              <Pressable py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center">
                    <Icon as={HelpCircle} size="md" color="$textDark500" mr="$3" />
                    <Text size="md" color="$textDark800">Help Center</Text>
                  </HStack>
                  <Icon as={ChevronRight} size="md" color="$textDark500" />
                </HStack>
              </Pressable>
              
              <Pressable py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center">
                    <Icon as={HelpCircle} size="md" color="$textDark500" mr="$3" />
                    <Text size="md" color="$textDark800">Contact Support</Text>
                  </HStack>
                  <Icon as={ChevronRight} size="md" color="$textDark500" />
                </HStack>
              </Pressable>
              
              <Pressable py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center">
                    <Icon as={Lock} size="md" color="$textDark500" mr="$3" />
                    <Text size="md" color="$textDark800">Privacy Policy</Text>
                  </HStack>
                  <Icon as={ChevronRight} size="md" color="$textDark500" />
                </HStack>
              </Pressable>
              
              <Pressable py="$3">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center">
                    <Icon as={FileText} size="md" color="$textDark500" mr="$3" />
                    <Text size="md" color="$textDark800">Terms of Service</Text>
                  </HStack>
                  <Icon as={ChevronRight} size="md" color="$textDark500" />
                </HStack>
              </Pressable>
            </VStack>
          </Box>

          {/* Sign Out */}
          <Box mt="$4" mb="$8">
            <Button 
              variant="outline" 
              action="negative" 
              size="lg" 
              borderRadius="$lg" 
              borderColor="$error500"
              onPress={handleLogout}
            >
              <HStack alignItems="center" space="sm">
                <Icon as={LogOut} size="lg" color="$error500" />
                <ButtonText color="$error500" fontWeight="$medium">Sign Out</ButtonText>
              </HStack>
            </Button>
          </Box>
        </ScrollView>
      </VStack>
    </SafeAreaView>
  );
};

export default SettingsScreen;