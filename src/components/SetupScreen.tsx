import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
const colors = require('../config/colors');

const SetupScreen = ({ onNavigateToHome }: { onNavigateToHome?: () => void; }) => {
  const [toyName, setToyName] = useState('');
  const [owners, setOwners] = useState([{ name: '', age: '' }]);
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [isFocused, setIsFocused] = useState({
    toyName: false,
    customPrompt: false,
  });
  const [errors, setErrors] = useState({
    toyName: '',
    owners: [{ name: '', age: '' }],
  });


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

  const updateOwner = (index: number, field: string, value: string) => {
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

  const handleFocus = (field: string) => {
    setIsFocused({
      ...isFocused,
      [field]: true,
    });
  };

  const handleBlur = (field: string) => {
    setIsFocused({
      ...isFocused,
      [field]: false,
    });
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

  const handleCompleteSetup = () => {
    if (validateInputs()) {
      // Setup completion logic would go here
      console.log('Completing setup with:', {
        toyName,
        owners,
        selectedInterests,
        customPrompt
      });
      // In a real app: navigation.navigate('Home');
      if (onNavigateToHome) {
        onNavigateToHome();
      }
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView contentContainerStyle={styles.scrollContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Set Up Your AI Buddy</Text>
            </View>

            {/* Toy Name Input */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Give your AI Buddy a name</Text>
              <View
                style={[
                  styles.inputContainer,
                  isFocused.toyName && styles.inputContainerFocused,
                  errors.toyName ? styles.inputContainerError : null,
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={toyName}
                  onChangeText={setToyName}
                  placeholder="Enter toy name"
                  placeholderTextColor={colors.textTertiary}
                  onFocus={() => handleFocus('toyName')}
                  onBlur={() => handleBlur('toyName')}
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
              {errors.toyName ? <Text style={styles.errorText}>{errors.toyName}</Text> : null}
            </View>

            {/* Owners Section */}
            <Text style={styles.sectionTitle}>Add Owners</Text>
            
            {owners.map((owner, index) => (
              <View key={index} style={styles.ownerInputGroup}>
                <View style={styles.ownerHeader}>
                  <Text style={styles.ownerLabel}>Owner {index + 1}</Text>
                  {owners.length > 1 && (
                    <TouchableOpacity style={styles.removeOwnerButton} onPress={() => removeOwner(index)}>
                      <Text style={styles.removeOwnerButtonText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
                
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Owner name</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      errors.owners[index]?.name ? styles.inputContainerError : null,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      value={owner.name}
                      onChangeText={(value) => updateOwner(index, 'name', value)}
                      placeholder="Enter owner name"
                      placeholderTextColor={colors.textTertiary}
                      autoCapitalize="words"
                      autoCorrect={false}
                    />
                  </View>
                  {errors.owners[index]?.name ? <Text style={styles.errorText}>{errors.owners[index].name}</Text> : null}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Age</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      errors.owners[index]?.age ? styles.inputContainerError : null,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      value={owner.age}
                      onChangeText={(value) => updateOwner(index, 'age', value)}
                      placeholder="Enter age"
                      placeholderTextColor={colors.textTertiary}
                      keyboardType="numeric"
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                  </View>
                  {errors.owners[index]?.age ? <Text style={styles.errorText}>{errors.owners[index].age}</Text> : null}
                </View>
              </View>
            ))}
            
            <TouchableOpacity style={styles.addOwnerButton} onPress={addOwner}>
              <Text style={styles.addOwnerButtonText}>+ Add Another Owner</Text>
            </TouchableOpacity>

            {/* Interests Section */}
            <Text style={styles.sectionTitle}>Interests</Text>
            <Text style={styles.sectionSubtitle}>Select interests for your AI Buddy</Text>
            
            <View style={styles.interestsContainer}>
              {interests.map((interest, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.interestButton,
                    selectedInterests.includes(interest) && styles.interestButtonSelected,
                  ]}
                  onPress={() => toggleInterest(interest)}
                >
                  <Text
                    style={[
                      styles.interestButtonText,
                      selectedInterests.includes(interest) && styles.interestButtonTextSelected,
                    ]}
                  >
                    {interest}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Custom Personality Prompt */}
            <Text style={styles.sectionTitle}>Custom personality prompt</Text>
            
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Describe how you want Your AI Buddy to behave ...</Text>
              <View
                style={[
                  styles.textAreaContainer,
                  isFocused.customPrompt && styles.inputContainerFocused,
                ]}
              >
                <TextInput
                  style={styles.textArea}
                  value={customPrompt}
                  onChangeText={setCustomPrompt}
                  placeholder="Enter custom personality traits, behaviors, or preferences..."
                  placeholderTextColor={colors.textTertiary}
                  onFocus={() => handleFocus('customPrompt')}
                  onBlur={() => handleBlur('customPrompt')}
                  multiline
                  textAlignVertical="top"
                />
              </View>
            </View>

            <TouchableOpacity style={styles.generateButton} disabled={!customPrompt.trim()}>
              <Text style={styles.generateButtonText}>Generate</Text>
            </TouchableOpacity>
          </ScrollView>

          {/* Complete Setup Button */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[
                styles.completeButton, 
                (!toyName.trim() || owners.some(owner => !owner.name.trim() || !owner.age.trim())) && styles.disabledButton
              ]} 
              onPress={handleCompleteSetup}
              disabled={!toyName.trim() || owners.some(owner => !owner.name.trim() || !owner.age.trim())}
            >
              <Text style={styles.completeButtonText}>Complete Setup</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 24,
  },
  header: {
    paddingTop: 20,
    paddingBottom: 30,
    alignItems: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 0,
    left: 0,
    padding: 8,
    zIndex: 1,
  },
  backButtonText: {
    fontSize: 24,
    color: colors.textPrimary,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 20,
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  inputContainer: {
    height: 56,
    borderWidth: 2,
    borderColor: colors.surfaceLight,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    justifyContent: 'center',
    shadowColor: colors.textTertiary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  textAreaContainer: {
    minHeight: 120,
    borderWidth: 2,
    borderColor: colors.surfaceLight,
    borderRadius: 16,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingTop: 16,
    shadowColor: colors.textTertiary,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  inputContainerFocused: {
    borderColor: colors.primary,
  },
  inputContainerError: {
    borderColor: colors.error,
  },
  input: {
    fontSize: 16,
    color: colors.textPrimary,
    height: '100%',
  },
  textArea: {
    fontSize: 16,
    color: colors.textPrimary,
    flex: 1,
  },
  errorText: {
    fontSize: 14,
    color: colors.error,
    marginTop: 8,
    marginLeft: 4,
  },
  interestsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  interestButton: {
    flexBasis: '48%',
    height: 48,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    backgroundColor: colors.surface,
  },
  interestButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  interestButtonText: {
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  interestButtonTextSelected: {
    color: colors.textLight,
  },
  generateButton: {
    backgroundColor: colors.secondary,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
    shadowColor: colors.secondary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  generateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  buttonContainer: {
    paddingHorizontal: 24,
    paddingBottom: 20,
  },
  completeButton: {
    backgroundColor: colors.primary,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  completeButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textLight,
  },
  ownerInputGroup: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.surfaceLight,
  },
  ownerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ownerLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  removeOwnerButton: {
    backgroundColor: colors.error,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  removeOwnerButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textLight,
  },
  addOwnerButton: {
    backgroundColor: colors.primary,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
  },
  addOwnerButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textLight,
  },
  disabledButton: {
    backgroundColor: colors.textTertiary,
  },
});

export default SetupScreen;