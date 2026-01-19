import React, { useState } from 'react';
import {
  ScrollView,
  Alert,
} from 'react-native';

// Supabase services
import { AuthService } from '../services';
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
  onNavigateToHelpCenter?: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onNavigateToHome, onNavigateToHelpCenter }) => {
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
    planType: 'Basic', // Basic or Pro
    nextBilling: 'Nov 6, 2024',
    amount: '$8.00',
    period: '/month'
  });

  // Pricing plans
  const pricingPlans = [
    {
      id: 'basic',
      name: 'Basic Plan',
      monthlyPrice: 8,
      yearlyPrice: 80,
      yearlySavings: 16, // 16% savings
      features: [
        '✓ Up to 2 connected toys',
        '✓ Basic AI responses',
        '✓ Standard safety filters',
        '✓ Email support'
      ],
      popular: false
    },
    {
      id: 'pro',
      name: 'Pro Plan',
      monthlyPrice: 19,
      yearlyPrice: 180,
      yearlySavings: 16, // 16% savings
      features: [
        '✓ Unlimited connected toys',
        '✓ Advanced AI responses',
        '✓ Premium safety filters',
        '✓ Priority support',
        '✓ Early access to new features',
        '✓ Custom personalities'
      ],
      popular: true
    }
  ];

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
              // Use Supabase AuthService for logout
              const { error } = await AuthService.signOut();
              
              if (error) {
                console.error('Logout error:', error);
                Alert.alert('Error', error.message || 'Failed to sign out. Please try again.');
                return;
              }
              
              console.log('User logged out successfully');
              
              // Optionally navigate to login screen
              if (onNavigateToHome) {
                onNavigateToHome();
              }
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
                  <Text color="$textDark800" fontWeight="$medium">Profanity Filter</Text>
                  <Text size="sm" color="$textDark500">Block inappropriate language</Text>
                </VStack>
                <Switch 
                  isChecked={profanityFilter} 
                  onToggle={(e) => setProfanityFilter(!!e)}
                />
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <VStack flex={1}>
                  <Text color="$textDark800" fontWeight="$medium">Internet Access</Text>
                  <Text size="sm" color="$textDark500">Allow toy to access online content</Text>
                </VStack>
                <Switch 
                  isChecked={internetAccess} 
                  onToggle={(e) => setInternetAccess(!!e)}
                />
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <VStack flex={1}>
                  <Text color="$textDark800" fontWeight="$medium">Daily Time Limit</Text>
                  <Text size="sm" color="$textDark500">Maximum play time per day</Text>
                </VStack>
                <Text size="md" fontWeight="$medium" color="$primary500">60 min</Text>
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <VStack flex={1}>
                  <Text color="$textDark800" fontWeight="$medium">Voice Preview</Text>
                  <Text size="sm" color="$textDark500">Preview responses before toy speaks</Text>
                </VStack>
                <Switch 
                  isChecked={voicePreview} 
                  onToggle={(e) => setVoicePreview(!!e)}
                />
              </HStack>
              
              <HStack justifyContent="space-between" alignItems="center" py="$3">
                <VStack flex={1}>
                  <Text color="$textDark800" fontWeight="$medium">Data Collection</Text>
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
            
            {/* Current Plan Display */}
            <Box bg="$primary500" borderRadius="$md" p="$4" mb="$4">
              <HStack justifyContent="space-between" alignItems="center">
                <VStack>
                  <Text size="md" fontWeight="$medium" color="$textLight50">{subscriptionData.planType} Plan</Text>
                  <Text size="sm" fontWeight="$medium" color="$textLight50">{subscriptionData.active ? 'Active' : 'Inactive'}</Text>
                  <Text size="sm" color="$textLight50">Next billing: {subscriptionData.nextBilling}</Text>
                  <Text size="xs" color="$textLight50" mt="$1">First month free trial</Text>
                </VStack>
                <VStack alignItems="flex-end">
                  <Text size="lg" fontWeight="$bold" color="$textLight50">{subscriptionData.amount}</Text>
                  <Text size="sm" color="$textLight50">{subscriptionData.period}</Text>
                </VStack>
              </HStack>
            </Box>
            
            {/* Pricing Plans */}
            <VStack space="md" mb="$4">
              <Heading size="sm" color="$textDark800" mb="$2">Upgrade Your Plan</Heading>
              
              {pricingPlans.map((plan) => (
                <Box 
                  key={plan.id}
                  borderWidth={1.5} 
                  borderColor={plan.popular ? "$primary500" : "$borderLight300"}
                  borderRadius="$lg" 
                  p="$4"
                  bg={plan.popular ? "$primary50" : "$backgroundLight0"}
                >
                  {plan.popular && (
                    <Box bg="$primary500" borderRadius="$full" alignSelf="flex-start" px="$3" py="$1" mb="$2">
                      <Text size="xs" fontWeight="$bold" color="$textLight50">POPULAR</Text>
                    </Box>
                  )}
                  
                  <HStack justifyContent="space-between" alignItems="flex-start" mb="$3">
                    <VStack>
                      <Heading size="sm" color="$textDark800">{plan.name}</Heading>
                      <Text size="xs" color="$textDark500">Billed {plan.yearlySavings}% less annually</Text>
                    </VStack>
                    <VStack alignItems="flex-end">
                      <Text size="lg" fontWeight="$bold" color="$primary500">${plan.monthlyPrice}/mo</Text>
                      <Text size="sm" color="$textDark500">or ${plan.yearlyPrice}/year</Text>
                    </VStack>
                  </HStack>
                  
                  <VStack space="sm" mb="$3">
                    {plan.features.map((feature, index) => (
                      <Text key={index} size="sm" color="$textDark800">{feature}</Text>
                    ))}
                  </VStack>
                  
                  <Button 
                    variant={plan.popular ? "solid" : "outline"}
                    action={plan.popular ? "primary" : "secondary"}
                    size="md" 
                    borderRadius="$lg"
                    isDisabled={subscriptionData.planType.toLowerCase() === plan.id}
                  >
                    <ButtonText>
                      {subscriptionData.planType.toLowerCase() === plan.id ? 'Current Plan' : `Choose ${plan.name}`}
                    </ButtonText>
                  </Button>
                </Box>
              ))}
            </VStack>
            
            {/* Management Options */}
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
              
              <Pressable py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center">
                    <Icon as={Receipt} size="md" color="$textDark500" mr="$3" />
                    <Text size="md" color="$textDark800">Payment Methods</Text>
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
              <Pressable py="$3" borderBottomWidth={0.5} borderBottomColor="$borderLight300" onPress={onNavigateToHelpCenter}>
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
                    <Icon as={FileText} size="md" color="$textDark500" mr="$3" />
                    <Text size="md" color="$textDark800">Terms of Service</Text>
                  </HStack>
                  <Icon as={ChevronRight} size="md" color="$textDark500" />
                </HStack>
              </Pressable>
              
              <Pressable py="$3">
                <HStack alignItems="center" justifyContent="space-between">
                  <HStack alignItems="center">
                    <Icon as={Lock} size="md" color="$textDark500" mr="$3" />
                    <Text size="md" color="$textDark800">Privacy Policy</Text>
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