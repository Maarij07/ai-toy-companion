import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { 
  Box, 
  Button, 
  ButtonText,
  Heading
} from '@gluestack-ui/themed';

interface PrivacyModalProps {
  visible: boolean;
  onClose: () => void;
}

const PrivacyModal: React.FC<PrivacyModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Heading size="lg" color="$textDark800">Privacy Policy</Heading>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content}>
            <Text style={styles.paragraph}>Last updated: 14/01/2026</Text>
            
            <Text style={styles.paragraph}>
              This Privacy Policy explains how we collect, use, and protect information when you use the AI Toy app and related devices.
            </Text>
            
            <Text style={styles.sectionTitle}>1. Data We Collect</Text>
            <Text style={styles.paragraph}>We may collect:</Text>
            <Text style={styles.paragraph}>• Account data: email, name, profile data, subscription status</Text>
            <Text style={styles.paragraph}>• Device data: toy serial number, pairing status, battery info, diagnostics</Text>
            <Text style={styles.paragraph}>• Usage data: feature usage, crash logs, analytics</Text>
            <Text style={styles.paragraph}>• Audio data (if enabled): voice recordings or transcripts to provide AI features</Text>
            <Text style={styles.paragraph}>• Purchase data: subscription plan, payment confirmation (we do not store full card details)</Text>
            
            <Text style={styles.sectionTitle}>2. How We Use Data</Text>
            <Text style={styles.paragraph}>We use data to:</Text>
            <Text style={styles.paragraph}>• Provide toy functionality (pairing, settings, modes)</Text>
            <Text style={styles.paragraph}>• Provide AI features (speech-to-text, responses, voices)</Text>
            <Text style={styles.paragraph}>• Store interaction history, notes, and preferences (if enabled)</Text>
            <Text style={styles.paragraph}>• Process purchases and subscriptions</Text>
            <Text style={styles.paragraph}>• Improve product performance and safety</Text>
            <Text style={styles.paragraph}>• Detect misuse, fraud, and security threats (e.g., pairing abuse, payment abuse)</Text>
            
            <Text style={styles.sectionTitle}>3. Audio + AI Processing</Text>
            <Text style={styles.paragraph}>Audio may be processed to generate transcripts and AI responses. Depending on your settings, audio and transcripts may be stored for:</Text>
            <Text style={styles.paragraph}>• conversation history</Text>
            <Text style={styles.paragraph}>• product improvement</Text>
            <Text style={styles.paragraph}>• personalization</Text>
            <Text style={styles.paragraph}>You can control storage options in Settings where available.</Text>
            
            <Text style={styles.sectionTitle}>4. Children's Privacy</Text>
            <Text style={styles.paragraph}>The Services are intended to be used under a parent/guardian account. We do not knowingly collect personal data from children without guardian control. Parents/guardians can request deletion of associated data.</Text>
            
            <Text style={styles.sectionTitle}>5. Sharing of Data</Text>
            <Text style={styles.paragraph}>We may share limited data with service providers that help run the app, such as:</Text>
            <Text style={styles.paragraph}>• Cloud hosting</Text>
            <Text style={styles.paragraph}>• Speech-to-text processing</Text>
            <Text style={styles.paragraph}>• AI processing</Text>
            <Text style={styles.paragraph}>• Payments (e.g., Stripe)</Text>
            <Text style={styles.paragraph}>These providers are required to protect user data.</Text>
            <Text style={styles.paragraph}>We do not sell personal data.</Text>
            
            <Text style={styles.sectionTitle}>6. Data Retention</Text>
            <Text style={styles.paragraph}>We retain data only as long as needed for the Services, legal obligations, safety, and fraud prevention. You may request deletion.</Text>
            
            <Text style={styles.sectionTitle}>7. Security</Text>
            <Text style={styles.paragraph}>We use encryption, secure device pairing, and access controls designed to protect users from unauthorized access.</Text>
            
            <Text style={styles.sectionTitle}>8. Your Rights</Text>
            <Text style={styles.paragraph}>You may request:</Text>
            <Text style={styles.paragraph}>• Access to your data</Text>
            <Text style={styles.paragraph}>• Correction of your data</Text>
            <Text style={styles.paragraph}>• Deletion of your data</Text>
            <Text style={styles.paragraph}>Contact: [privacy@email.com]</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    maxWidth: 500,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '80%',
    justifyContent: 'flex-start',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5E5',
  },
  content: {
    padding: 20,
    maxHeight: '70%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3C3C3C',
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: '#6B6B6B',
    lineHeight: 22,
    marginBottom: 12,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#6B6B6B',
  },
});

export default PrivacyModal;