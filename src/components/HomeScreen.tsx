import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Animated,
  StatusBar,
} from 'react-native';
import { 
  Box, 
  Text, 
  Button, 
  ButtonText, 
  VStack, 
  HStack, 
  Image,
  Heading,
  Icon,
  Card,
  Avatar,
  Pressable
} from '@gluestack-ui/themed';
import { 
  User, 
  Bell, 
  Power, 
  Settings,
  Layers,
  MessageSquare,
  UserRound,
  Shield,
  PlusCircle,
  ChevronRight,
  Calendar,
  BookOpen,
  Gamepad2,
  MessageCircle,
  Home,
  Store,
  ShoppingCart
} from 'lucide-react-native';

// Import other screens for tab navigation
import MarketplaceScreen from './MarketplaceScreen';
import CartScreen from './CartScreen';
import SettingsScreen from './SettingsScreen';
import ProductDetailScreen from './ProductDetailScreen';

interface NewHomeContentProps {
  onNavigateToHome?: () => void;
  toyDetailVisible: boolean;
  setToyDetailVisible: React.Dispatch<React.SetStateAction<boolean>>;
  selectedToy: any;
  setSelectedToy: React.Dispatch<React.SetStateAction<any>>;
}

const NewHomeContent = ({ 
  onNavigateToHome, 
  toyDetailVisible,
  setToyDetailVisible,
  selectedToy,
  setSelectedToy
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

  const parentalControls = [
    { id: 'safetyMode', label: 'Safety Mode', enabled: true },
    { id: 'screenTime', label: 'Screen Time', enabled: true },
    { id: 'contentFilter', label: 'Content Filter', enabled: true },
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
        contentContainerStyle={{ padding: 20, flex: 1, justifyContent: 'center' }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Card bg="$backgroundLight0" borderRadius="$lg" p="$6" alignItems="center" justifyContent="center" my="$4">
          <Box bg="$backgroundLight50" borderRadius="$full" p="$4" mb="$4">
            <Icon as={Power} size="2xl" color="$textDark500" />
          </Box>
          <Heading size="lg" color="$textDark800" textAlign="center" mb="$2">Buddy is offline</Heading>
          <Text size="sm" color="$textDark500" textAlign="center" mb="$4">Connect your toy to continue</Text>
          <Button 
            bg="$primary500" 
            borderRadius="$full" 
            onPress={() => setToyStatus('online')}
          >
            <ButtonText color="$textLight500">Reconnect Toy</ButtonText>
          </Button>
        </Card>
      </ScrollView>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View style={{ opacity: fadeAnim }}>
          {/* Greeting */}
          <VStack mb="$6">
            <Text size="2xl" fontWeight="$bold" color="$textDark800">Good morning, Sarah!</Text>
            <Text size="sm" color="$textDark500">Welcome back</Text>
          </VStack>

          {/* Toy Status Strip */}
          <Pressable 
            bg="$backgroundLight0" 
            borderRadius="$lg" 
            p="$4" 
            mb="$4"
            onPress={() => {
              setSelectedToy(mockToyData);
              setToyDetailVisible(true);
            }}
          >
            <HStack justifyContent="space-between" alignItems="center">
              <HStack alignItems="center">
                <Avatar size="md" bg="$primary500" mr="$3">
                  <Text color="$textLight50" fontWeight="$bold">BB</Text>
                </Avatar>
                <VStack>
                  <Text size="lg" fontWeight="$bold" color="$textDark800">{mockToyData.name}</Text>
                  <HStack alignItems="center">
                    <Box w="$2" h="$2" bg="$success500" borderRadius="$full" mr="$2" />
                    <Text size="sm" color="$textDark800">Connected</Text>
                  </HStack>
                  <Text size="xs" color="$textDark500">Last active {mockToyData.lastInteraction}</Text>
                </VStack>
              </HStack>
              
              <VStack alignItems="flex-end">
                <Icon as={ChevronRight} size="md" color="$textDark500" />
              </VStack>
            </HStack>
          </Pressable>

          {/* Add New Toy */}
          <Pressable 
            bg="$backgroundLight0" 
            borderRadius="$lg" 
            p="$4" 
            mb="$4"
            borderWidth={1.5}
            borderColor="$primary500"
            borderStyle="dashed"
            alignItems="center"
            flexDirection="row"
            justifyContent="center"
          >
            <Icon as={PlusCircle} size="md" color="$primary500" mr="$2" />
            <Text size="sm" fontWeight="$medium" color="$primary500">Add New Toy</Text>
          </Pressable>

          {/* Parental Controls */}
          <VStack mb="$4">
            <Heading size="sm" mb="$3" color="$textDark800">Parental Controls</Heading>
            <Card bg="$backgroundLight0" borderRadius="$lg" p="$3">
              {parentalControls.map((control, index) => (
                <VStack 
                  key={control.id} 
                  py="$3" 
                  borderBottomWidth={index !== parentalControls.length - 1 ? 0.5 : 0} 
                  borderBottomColor="$borderLight300"
                >
                  <HStack justifyContent="space-between" alignItems="center">
                    <HStack alignItems="center">
                      <Box mr="$3">
                        <Icon as={Shield} size="sm" color="$textDark800" />
                      </Box>
                      <Text size="sm" color="$textDark800">{control.label}</Text>
                    </HStack>
                    <Pressable
                      onPress={() => toggleParentalControl(control.id)}
                      bg={parentalControlStates[control.id] ? "$primary500" : "$borderLight400"}
                      borderRadius="$full"
                      w="$10" 
                      h="$5"
                      justifyContent="center"
                      alignItems="flex-start"
                      px="$1"
                    >
                      <Box 
                        bg="$white" 
                        borderRadius="$full" 
                        w="$4" 
                        h="$4" 
                        position="absolute"
                        style={{ transform: [{ translateX: parentalControlStates[control.id] ? 20 : 0 }] }}
                      />
                    </Pressable>
                  </HStack>
                </VStack>
              ))}
            </Card>
          </VStack>

          {/* Recent Activity */}
          <VStack>
            <Heading size="sm" mb="$3" color="$textDark800">Recent Activity</Heading>
            {recentActivities.map((activity) => (
              <Pressable key={activity.id} bg="$backgroundLight0" borderRadius="$lg" p="$3" mb="$2">
                <HStack alignItems="center">
                  <Box bg="$primary200" borderRadius="$full" w="$10" h="$10" justifyContent="center" alignItems="center" mr="$3">
                    <Icon as={BookOpen} size="sm" color="$primary500" />
                  </Box>
                  <VStack flex={1}>
                    <HStack justifyContent="space-between" mb="$1">
                      <Text size="sm" fontWeight="$medium" color="$textDark800">{activity.type}</Text>
                      <Text size="xs" color="$textDark500">{activity.time}</Text>
                    </HStack>
                    <Text size="sm" color="$textDark500">{activity.description}</Text>
                  </VStack>
                  <Icon as={ChevronRight} size="sm" color="$textDark500" />
                </HStack>
              </Pressable>
            ))}
          </VStack>
        </Animated.View>
      </ScrollView>
    </>
  );
};

const ToyDetailScreen = ({ toy, onGoBack }: { toy: any; onGoBack: () => void; }) => {
  const [activeTab, setActiveTab] = useState('Personality');

  const tabOptions = [
    { id: 'Personality', label: 'Personality', icon: UserRound },
    { id: 'Mode', label: 'Mode', icon: Layers },
    { id: 'Convos', label: 'Convos', icon: MessageSquare },
    { id: 'Settings', label: 'Settings', icon: Settings },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Personality':
        return (
          <VStack space="md">
            <Text size="sm" color="$textDark800" mb="$2">Select a personality trait for your toy:</Text>
            {['Friendly Helper', 'Science Explorer', 'Creative Artist', 'Storyteller', 'Smart Teacher'].map((item, index) => (
              <Pressable key={index} bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$2" borderWidth={1} borderColor="$borderLight300">
                <Text size="sm" color="$textDark800">{item}</Text>
              </Pressable>
            ))}
          </VStack>
        );
      case 'Mode':
        return (
          <VStack space="md">
            <Text size="sm" color="$textDark800" mb="$2">Select a mode for your toy:</Text>
            {[
              { icon: '💬', label: 'Chat Mode' },
              { icon: '🎤', label: 'Rap Mode' },
              { icon: '🤔', label: 'Debate Mode' },
              { icon: '🤗', label: 'Counselor Mode' },
              { icon: '📚', label: 'Tutor Mode' }
            ].map((item, index) => (
              <Pressable key={index} bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$2" borderWidth={1} borderColor="$borderLight300">
                <HStack alignItems="center">
                  <Box bg="$primary100" borderRadius="$full" w="$8" h="$8" justifyContent="center" alignItems="center" mr="$3">
                    <Text size="sm" fontWeight="$bold" color="$primary500">{item.icon}</Text>
                  </Box>
                  <Text size="sm" color="$textDark800">{item.label}</Text>
                </HStack>
              </Pressable>
            ))}
          </VStack>
        );
      case 'Convos':
        return (
          <VStack space="md">
            <Text size="sm" color="$textDark800" mb="$2">Start a conversation:</Text>
            {['Chat', 'Voice', 'Video'].map((item, index) => (
              <Pressable key={index} bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$2" borderWidth={1} borderColor="$borderLight300">
                <Text size="sm" color="$textDark800">{item}</Text>
              </Pressable>
            ))}
          </VStack>
        );
      case 'Settings':
        return (
          <VStack space="md">
            <Text size="sm" color="$textDark800" mb="$2">Configure toy settings:</Text>
            {['General', 'Safety', 'Notifications', 'Connection'].map((item, index) => (
              <Pressable key={index} bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$2" borderWidth={1} borderColor="$borderLight300">
                <Text size="sm" color="$textDark800">{item}</Text>
              </Pressable>
            ))}
          </VStack>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <VStack flex={1}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
          <Pressable p="$2" onPress={onGoBack} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}>
            <Icon as={ChevronRight} size="lg" color="$textDark800" style={{ transform: [{ rotate: '180deg' }] }} />
          </Pressable>
          
          <Heading size="md" color="$textDark800">{toy?.name}</Heading>
          
          <Pressable p="$2" onPress={() => {}}>
            <Icon as={Settings} size="lg" color="$textDark800" />
          </Pressable>
        </HStack>

        {/* Toy Info */}
        <VStack p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
          <HStack alignItems="center" justifyContent="center">
            <Avatar size="lg" bg="$primary500" mr="$3">
              <Text color="$textLight50" fontWeight="$bold">BB</Text>
            </Avatar>
            <VStack alignItems="center">
              <Text size="md" fontWeight="$bold" color="$textDark800">{toy?.name}</Text>
              <HStack alignItems="center">
                <Box w="$2" h="$2" bg="$success500" borderRadius="$full" mr="$2" />
                <Text size="sm" color="$textDark800">Connected</Text>
              </HStack>
            </VStack>
          </HStack>
        </VStack>

        {/* Tabs */}
        <HStack bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
          {tabOptions.map((tab) => (
            <Pressable
              key={tab.id}
              flex={1}
              p="$3"
              alignItems="center"
              borderBottomWidth={activeTab === tab.id ? 2 : 0}
              borderBottomColor="$primary500"
              onPress={() => setActiveTab(tab.id)}
            >
              <Icon as={tab.icon} size="sm" color={activeTab === tab.id ? "$primary500" : "$textDark500"} mb="$1" />
              <Text size="xs" color={activeTab === tab.id ? "$primary500" : "$textDark500"}>{tab.label}</Text>
            </Pressable>
          ))}
        </HStack>

        {/* Tab Content */}
        <Box p="$4" flex={1} bg="$backgroundLight50">
          <ScrollView showsVerticalScrollIndicator={false}>
            {renderTabContent()}
          </ScrollView>
        </Box>
      </VStack>
    </SafeAreaView>
  );
};

const HomeScreen = ({ onNavigateToHome }: { onNavigateToHome?: () => void; }) => {
  const [activeTab, setActiveTab] = useState('Home');
  const [isNotificationDrawerVisible, setNotificationDrawerVisible] = useState(false);
  const [detailProduct, setDetailProduct] = useState<any>(null);
  const [toyDetailVisible, setToyDetailVisible] = useState(false);
  const [selectedToy, setSelectedToy] = useState<any>(null);
  
  const renderTabContent = () => {
    if (detailProduct) {
      return (
        <ProductDetailScreen 
          route={{ params: { product: detailProduct } }}
          navigation={{ goBack: () => setDetailProduct(null) }}
        />
      );
    }
    
    if (toyDetailVisible && selectedToy) {
      return <ToyDetailScreen toy={selectedToy} onGoBack={() => setToyDetailVisible(false)} />;
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
            <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
              <Pressable p="$2">
                <Icon as={User} size="xl" color="$textDark800" />
              </Pressable>
              
              <Heading size="md" color="$textDark800">Home</Heading>
              
              <Pressable p="$2" onPress={() => setNotificationDrawerVisible(true)}>
                <Icon as={Bell} size="lg" color="$textDark800" />
              </Pressable>
            </HStack>
            
            <NewHomeContent 
              onNavigateToHome={onNavigateToHome}
              toyDetailVisible={toyDetailVisible}
              setToyDetailVisible={setToyDetailVisible}
              selectedToy={selectedToy}
              setSelectedToy={setSelectedToy}
            />
          </>
        );
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      {renderTabContent()}
      
      {/* Tab Bar - Only show when not viewing product detail */}
      {detailProduct || toyDetailVisible ? null : (
        <HStack justifyContent="space-around" alignItems="center" p="$3" bg="$backgroundLight0" borderTopWidth={0.5} borderTopColor="$borderLight300" position="absolute" bottom={0} left={0} right={0}>
          {[
            { name: 'Home', icon: Home },
            { name: 'Marketplace', icon: Store },
            { name: 'Cart', icon: ShoppingCart },
            { name: 'Settings', icon: Settings }
          ].map((tab) => (
            <Pressable
              key={tab.name}
              p="$3"
              onPress={() => setActiveTab(tab.name)}
            >
              <VStack alignItems="center">
                <Icon 
                  as={tab.icon} 
                  size="md" 
                  color={activeTab === tab.name ? "$primary500" : "$textDark500"} 
                />
                <Text size="xs" mt="$1" color={activeTab === tab.name ? "$primary500" : "$textDark500"}>{tab.name}</Text>
              </VStack>
            </Pressable>
          ))}
        </HStack>
      )}
    </SafeAreaView>
  );
};

export default HomeScreen;