import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
  Box, 
  Text, 
  Input, 
  InputField, 
  InputIcon, 
  InputSlot, 
  Button, 
  ButtonText, 
  FormControl, 
  FormControlError, 
  FormControlErrorText, 
  FormControlLabel, 
  FormControlLabelText, 
  HStack, 
  VStack, 
  Center, 
  Pressable,
  Badge,
  BadgeText,
  Textarea,
  TextareaInput,
  Heading
} from '@gluestack-ui/themed';
import { User, ToyBrick, Star, Sparkles, Plus, Minus } from 'lucide-react-native';

// Firebase imports
import { getAuth } from '../config/firebase';
import { doc, getFirestore, setDoc, getDoc } from '@react-native-firebase/firestore';

interface Owner {
  name: string;
  age: string;
}

interface SetupScreenProps {
  onNavigateToHome?: () => void;
}

const SetupScreen: React.FC<SetupScreenProps> = ({ onNavigateToHome }) => {
  const [toyName, setToyName] = useState('');
  const [owners, setOwners] = useState<Owner[]>([{ name: '', age: '' }]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [errors, setErrors] = useState({
    toyName: '',
    owners: [{ name: '', age: '' }],
  });
  const [isLoading, setIsLoading] = useState(false);

  const interests = [
    'Creative Arts',
    'Science & Tech',
    'Sports & Games',
    'Music & Dance',
    'Reading & Stories',
    'Animals & Nature',
    'Cooking & Food',
    'Building & Making',
  ];

  const addOwner = () => {
    setOwners([...owners, { name: '', age: '' }]);
    setErrors({
      ...errors,
      owners: [...errors.owners, { name: '', age: '' }]
    });
  };

  const updateOwner = (index: number, field: keyof Owner, value: string) => {
    const updatedOwners = [...owners];
    updatedOwners[index] = { ...updatedOwners[index], [field]: value };
    setOwners(updatedOwners);
    
    const updatedErrors = [...errors.owners];
    updatedErrors[index] = { ...updatedErrors[index], [field]: '' };
    setErrors({
      ...errors,
      owners: updatedErrors
    });
  };

  const removeOwner = (index: number) => {
    if (owners.length > 1) {
      const updatedOwners = owners.filter((_, i) => i !== index);
      const updatedErrors = errors.owners.filter((_, i) => i !== index);
      setOwners(updatedOwners);
      setErrors({
        ...errors,
        owners: updatedErrors
      });
    }
  };

  const toggleInterest = (interest: string) => {
    if (selectedInterests.includes(interest)) {
      setSelectedInterests(selectedInterests.filter(item => item !== interest));
    } else {
      setSelectedInterests([...selectedInterests, interest]);
    }
  };

  const validateInputs = () => {
    let newErrors = {
      toyName: '',
      owners: owners.map(() => ({ name: '', age: '' }))
    };
    let hasError = false;

    if (!toyName.trim()) {
      newErrors.toyName = 'Toy name is required';
      hasError = true;
    }

    owners.forEach((owner, index) => {
      if (!owner.name.trim()) {
        newErrors.owners[index].name = 'Owner name is required';
        hasError = true;
      }
      
      if (!owner.age.trim()) {
        newErrors.owners[index].age = 'Owner age is required';
        hasError = true;
      } else if (isNaN(parseInt(owner.age)) || parseInt(owner.age) <= 0) {
        newErrors.owners[index].age = 'Please enter a valid age';
        hasError = true;
      }
    });

    setErrors(newErrors);
    return !hasError;
  };

  const handleCompleteSetup = async () => {
    if (validateInputs()) {
      setIsLoading(true);
      try {
        // Get the current user
        const auth = getAuth();
        const currentUser = auth.currentUser;
        
        if (currentUser) {
          // Create toy data object
          const toyData = {
            name: toyName.trim(),
            owners: owners,
            interests: selectedInterests,
            customPersonality: customPrompt,
            createdAt: new Date(),
            connected: true,
          };
          
          // Get the current user document
          const userDocRef = doc(getFirestore(), 'users', currentUser.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            // Get existing toys array or initialize as empty array
            const userData = userDoc.data() as any;
            const existingToys = userData.toys || [];
            
            // Add the new toy to the array
            const updatedToys = [...existingToys, toyData];
            
            // Update the user document with the new toys array
            await setDoc(userDocRef, {
              ...userData,
              toys: updatedToys,
            }, { merge: true });
          } else {
            // If user doc doesn't exist, create it with the toy
            await setDoc(userDocRef, {
              toys: [toyData],
            });
          }
          
          console.log('Toy setup completed and saved:', toyData);
        }
        
        // Navigate to home screen
        if (onNavigateToHome) {
          onNavigateToHome();
        }
      } catch (error) {
        console.error('Error saving toy data:', error);
        // Optionally show an error message to the user
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
          <ScrollView 
            contentContainerStyle={{ 
              paddingHorizontal: 16,
              paddingVertical: 20,
              flexGrow: 1,
              backgroundColor: '$backgroundLight0',
            }}
          >
            {/* Header */}
            <Center mb="$6">
              <Box mb="$2">
                <ToyBrick size={48} color="#6D8B74" />
              </Box>
              <Heading size="xl" color="$textDark800" textAlign="center" mb="$2">
                Set Up Your AI Buddy
              </Heading>
              <Text size="sm" color="$textDark500" textAlign="center">
                Complete the setup to connect your toy
              </Text>
            </Center>

            <VStack space="lg" flex={1}>
              {/* Toy Name Input */}
              <FormControl isInvalid={!!errors.toyName}>
                <FormControlLabel mb="$2">
                  <FormControlLabelText color="$textDark800">Give your AI Buddy a name</FormControlLabelText>
                </FormControlLabel>
                <Input borderColor="$borderLight300" borderWidth="$1" borderRadius="$lg" bg="$backgroundLight0" h="$12" py="$3">
                  <InputSlot pl="$3">
                    <InputIcon as={ToyBrick} color="$textDark800" />
                  </InputSlot>
                  <InputField 
                    placeholder="Enter toy name" 
                    placeholderTextColor="$textDark500"
                    color="$textDark800"
                    value={toyName}
                    onChangeText={setToyName}
                    autoCapitalize="words"
                    autoCorrect={false}
                  />
                </Input>
                <FormControlError>
                  <FormControlErrorText>{errors.toyName}</FormControlErrorText>
                </FormControlError>
              </FormControl>

              {/* Owners Section */}
              <VStack space="md">
                <HStack justifyContent="space-between" alignItems="center">
                  <Heading size="md" color="$textDark800" mb="$2">
                    Add Owners
                  </Heading>
                </HStack>
                
                {owners.map((owner, index) => (
                  <Box key={index} bg="$backgroundLight0" borderRadius="$lg" p="$4" borderWidth="$1" borderColor="$borderLight300">
                    <HStack justifyContent="space-between" alignItems="center" mb="$3">
                      <Text size="sm" fontWeight="$medium" color="$textDark800">
                        Owner {index + 1}
                      </Text>
                      {owners.length > 1 && (
                        <Pressable onPress={() => removeOwner(index)}>
                          <Minus size={20} color="#EF4444" />
                        </Pressable>
                      )}
                    </HStack>
                    
                    <VStack space="md">
                      {/* Owner Name */}
                      <FormControl isInvalid={!!errors.owners[index]?.name}>
                        <FormControlLabel mb="$2">
                          <FormControlLabelText color="$textDark800">Owner name</FormControlLabelText>
                        </FormControlLabel>
                        <Input borderColor="$borderLight300" borderWidth="$1" borderRadius="$lg" bg="$backgroundLight0" h="$12" py="$3">
                          <InputSlot pl="$3">
                            <InputIcon as={User} color="$textDark800" />
                          </InputSlot>
                          <InputField 
                            placeholder="Enter owner name" 
                            placeholderTextColor="$textDark500"
                            color="$textDark800"
                            value={owner.name}
                            onChangeText={(value) => updateOwner(index, 'name', value)}
                            autoCapitalize="words"
                            autoCorrect={false}
                          />
                        </Input>
                        <FormControlError>
                          <FormControlErrorText>{errors.owners[index]?.name}</FormControlErrorText>
                        </FormControlError>
                      </FormControl>

                      {/* Owner Age */}
                      <FormControl isInvalid={!!errors.owners[index]?.age}>
                        <FormControlLabel mb="$2">
                          <FormControlLabelText color="$textDark800">Age</FormControlLabelText>
                        </FormControlLabel>
                        <Input borderColor="$borderLight300" borderWidth="$1" borderRadius="$lg" bg="$backgroundLight0" h="$12" py="$3">
                          <InputSlot pl="$3">
                            <InputIcon as={Star} color="$textDark800" />
                          </InputSlot>
                          <InputField 
                            placeholder="Enter age" 
                            placeholderTextColor="$textDark500"
                            color="$textDark800"
                            value={owner.age}
                            onChangeText={(value) => updateOwner(index, 'age', value)}
                            keyboardType="numeric"
                            autoCapitalize="none"
                            autoCorrect={false}
                          />
                        </Input>
                        <FormControlError>
                          <FormControlErrorText>{errors.owners[index]?.age}</FormControlErrorText>
                        </FormControlError>
                      </FormControl>
                    </VStack>
                  </Box>
                ))}
                
                <Button 
                  variant="outline" 
                  borderColor="$borderLight300" 
                  bg="$backgroundLight0"
                  onPress={addOwner}
                  h="$12"
                  py="$3"
                  alignItems="center"
                  justifyContent="center"
                >
                  <HStack alignItems="center" space="sm">
                    <Plus size={20} color="#6D8B74" />
                    <ButtonText color="$textDark800">Add Another Owner</ButtonText>
                  </HStack>
                </Button>
              </VStack>

              {/* Interests Section */}
              <VStack space="md">
                <Heading size="md" color="$textDark800" mb="$2">
                  Interests
                </Heading>
                <Text size="sm" color="$textDark500" mb="$3">
                  Select interests for your AI Buddy
                </Text>
                
                <HStack flexWrap="wrap" space="md">
                  {interests.map((interest, index) => (
                    <Pressable 
                      key={index} 
                      onPress={() => toggleInterest(interest)}
                      m="$1"
                    >
                      <Badge 
                        variant={selectedInterests.includes(interest) ? "solid" : "outline"}
                        action={selectedInterests.includes(interest) ? "success" : "muted"}
                        m="$0.5"
                      >
                        <BadgeText>{interest}</BadgeText>
                      </Badge>
                    </Pressable>
                  ))}
                </HStack>
              </VStack>

              {/* Custom Personality Prompt */}
              <VStack space="md">
                <Heading size="md" color="$textDark800" mb="$2">
                  Custom personality prompt
                </Heading>
                
                <FormControl>
                  <FormControlLabel mb="$2">
                    <FormControlLabelText color="$textDark800">Describe how you want Your AI Buddy to behave ...</FormControlLabelText>
                  </FormControlLabel>
                  <Textarea 
                    borderColor="$borderLight300" 
                    borderWidth="$1" 
                    borderRadius="$lg" 
                    bg="$backgroundLight0" 
                    h="$32"
                  >
                    <TextareaInput 
                      placeholder="Enter custom personality traits, behaviors, or preferences..." 
                      placeholderTextColor="$textDark500"
                      color="$textDark800"
                      value={customPrompt}
                      onChangeText={setCustomPrompt}
                      textAlignVertical="top"
                    />
                  </Textarea>
                </FormControl>

                <Button 
                  variant="outline" 
                  borderColor="$borderLight300" 
                  bg="$backgroundLight0"
                  h="$12"
                  py="$3"
                  alignItems="center"
                  justifyContent="center"
                  disabled={!customPrompt.trim()}
                >
                  <HStack alignItems="center" space="sm">
                    <Sparkles size={20} color="#6D8B74" />
                    <ButtonText color="$textDark800">Generate</ButtonText>
                  </HStack>
                </Button>
              </VStack>
            </VStack>
          </ScrollView>

          {/* Complete Setup Button */}
          <Box p="$4" bg="$backgroundLight0">
            <Button 
              bg="$primary500" 
              py="$3" 
              h="$12" 
              borderRadius="$lg" 
              onPress={handleCompleteSetup} 
              disabled={!toyName.trim() || owners.some(owner => !owner.name.trim() || !owner.age.trim())}
              alignItems="center"
              justifyContent="center"
            >
              <ButtonText color="$white" fontWeight="$semibold" textAlign="center">
                Complete Setup
              </ButtonText>
            </Button>
          </Box>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

export default SetupScreen;