import React from 'react';
import {
  ScrollView,
  StyleSheet,
} from 'react-native';
import { 
  Box, 
  Text, 
  VStack, 
  HStack, 
  Heading,
  Pressable,
  Icon
} from '@gluestack-ui/themed';
import { 
  User, 
  Bell, 
  ChevronRight,
  BookOpen,
  CreditCard,
  ShieldAlert,
  Mail
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const HelpCenterScreen = () => {
  // FAQ Sections
  const faqSections = [
    {
      id: 'getting-started',
      title: 'Getting Started',
      icon: BookOpen,
      items: [
        {
          question: 'How do I set up my toy?',
          answer: [
            '1. Open the AI Toy app and sign in',
            '2. Tap "Add New Toy"',
            '3. Scan the QR code on your toy - to be verified - what is the pairing method?',
            '4. Follow the pairing steps to connect via Bluetooth'
          ]
        },
        {
          question: 'Why do I need to scan a QR code?',
          answer: [
            'The QR code helps securely link your specific toy to your account.',
            'To be verified - what is the pairing method?',
            'Bluetooth + Pairing'
          ]
        },
        {
          question: 'My toy won\'t connect',
          answer: [
            '• Ensure Bluetooth is enabled on your phone',
            '• Hold the toy button for 2 seconds to wake it',
            '• Keep the toy close to the phone (within 1–2 meters)',
            '• Restart the app and try again'
          ]
        },
        {
          question: 'How do I factory reset the toy?',
          answer: [
            '• Press and hold the toy button for 10 seconds until the LED indicates reset',
            '• Re-open the app and re-pair using the QR code'
          ]
        }
      ]
    },
    {
      id: 'subscription-billing',
      title: 'Subscription & Billing',
      icon: CreditCard,
      items: [
        {
          question: 'Plans',
          answer: [
            '• Basic: $8/month (first month free) or $80/year',
            '• Pro: $19/month or $180/year'
          ]
        },
        {
          question: 'How do I cancel?',
          answer: [
            'You can cancel in the app or via your App Store / Play Store subscription settings.'
          ]
        }
      ]
    },
    {
      id: 'refunds',
      title: 'Refunds',
      icon: CreditCard,
      items: [
        {
          question: 'Physical toy refund',
          answer: [
            '• 30-day money-back guarantee from delivery date',
            '• Physical products only'
          ]
        },
        {
          question: 'Digital goods refund',
          answer: [
            '• Digital goods (voices/personalities/content packs) refundable within 5 days of purchase',
            '• After 5 days, digital goods are non-refundable'
          ]
        }
      ]
    },
    {
      id: 'child-safety',
      title: 'Child Safety Standards',
      icon: ShieldAlert,
      items: [
        {
          question: 'Parent / Guardian Control',
          answer: [
            '• AI Toy is intended to be set up and managed by a parent or legal guardian account.',
            '• Parents control toy pairing, permissions, and safety settings.',
            '• Parents may review or delete conversation history and account data.'
          ]
        },
        {
          question: 'Safe Content & Moderation',
          answer: [
            'We aim to prevent harmful or age-inappropriate content by implementing:',
            '• Safety filters designed to block unsafe, explicit, or abusive content.',
            '• Restrictions on high-risk topics (e.g., self-harm, violence, sexual content).',
            '• A child-safe response style prioritizing friendly, non-threatening language.'
          ]
        },
        {
          question: 'Data Minimisation & Privacy',
          answer: [
            '• We collect only the data needed to operate the toy and app safely.',
            '• Audio recording storage is optional and controlled through Settings.',
            '• We do not sell personal data.',
            '• Parents may request deletion of data at any time.'
          ]
        },
        {
          question: 'Anti-Misuse & Platform Enforcement',
          answer: [
            'To protect children and families, we may restrict or terminate access if we detect:',
            '• Attempts to bypass pairing or security controls',
            '• Fraudulent activity or abusive behavior',
            '• Unsafe use or misuse of the toy/device ecosystem'
          ]
        },
        {
          question: 'Reporting & Support',
          answer: [
            'If you believe there is a safety issue or inappropriate content:',
            '• You can contact us immediately at [safety@email.com]',
            '• Our support team will investigate reports and take action where necessary, including disabling content or accounts.'
          ]
        }
      ]
    },
    {
      id: 'misuse-policy',
      title: 'Misuse & Policy Enforcement',
      icon: ShieldAlert,
      items: [
        {
          question: 'What counts as misuse?',
          answer: [
            'Misuse includes tampering with device security, attempting unauthorized pairing, reverse engineering firmware, abusing refunds, or intentionally damaging the toy.'
          ]
        },
        {
          question: 'What happens if misuse is detected?',
          answer: [
            'We may suspend or terminate account access, disable device pairing, and refuse refunds where appropriate (except where required by law).'
          ]
        }
      ]
    }
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <VStack flex={1}>
        {/* Sticky Header */}
        <HStack justifyContent="space-between" alignItems="center" p="$4" bg="$backgroundLight0" borderBottomWidth={0.5} borderBottomColor="$borderLight300">
          <Pressable p="$2">
            <Icon as={User} size="xl" color="$textDark800" />
          </Pressable>
          
          <Heading size="md" color="$textDark800">Help Center</Heading>
          <Text size="sm" color="$textDark500" mt="$1">Last updated: 14/01/2026</Text>
          
          <Pressable p="$2">
            <Icon as={Bell} size="lg" color="$textDark800" />
          </Pressable>
        </HStack>
        
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100, flexGrow: 1 }}>
          <VStack space="md">
            {faqSections.map((section) => (
              <Box key={section.id} bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
                <HStack alignItems="center" mb="$3">
                  <Icon as={section.icon} size="sm" color="$primary500" mr="$2" />
                  <Heading size="sm" color="$textDark800">{section.title}</Heading>
                </HStack>
                
                <VStack space="sm">
                  {section.items.map((item, index) => (
                    <Box 
                      key={index} 
                      bg="$backgroundLight50" 
                      borderRadius="$md" 
                      p="$3"
                      mb={index !== section.items.length - 1 ? "$2" : "$0"}
                    >
                      <Pressable>
                        <HStack justifyContent="space-between" alignItems="center">
                          <Text size="sm" fontWeight="$medium" color="$textDark800" flexShrink={1}>
                            {item.question}
                          </Text>
                          <Icon as={ChevronRight} size="md" color="$textDark500" />
                        </HStack>
                        
                        <VStack mt="$2">
                          {item.answer.map((answerLine, idx) => (
                            <Text 
                              key={idx} 
                              size="sm" 
                              color="$textDark500" 
                              style={{ lineHeight: 20 }}
                              ml={answerLine.startsWith('•') ? 16 : 0}
                            >
                              {answerLine}
                            </Text>
                          ))}
                        </VStack>
                      </Pressable>
                    </Box>
                  ))}
                </VStack>
              </Box>
            ))}
            
            {/* Contact Support */}
            <Box bg="$backgroundLight0" borderRadius="$lg" p="$4" mb="$4">
              <HStack alignItems="center" mb="$3">
                <Icon as={Mail} size="sm" color="$primary500" mr="$2" />
                <Heading size="sm" color="$textDark800">Contact Support</Heading>
              </HStack>
              
              <VStack space="sm">
                <Box bg="$backgroundLight50" borderRadius="$md" p="$3">
                  <Text size="sm" color="$textDark800">Email: [support@email.com]</Text>
                </Box>
                
                <Box bg="$backgroundLight50" borderRadius="$md" p="$3">
                  <Text size="sm" color="$textDark800">Hours: [Support hours/timezone]</Text>
                </Box>
              </VStack>
            </Box>
          </VStack>
        </ScrollView>
      </VStack>
    </SafeAreaView>
  );
};

export default HelpCenterScreen;