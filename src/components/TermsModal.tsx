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

interface TermsModalProps {
  visible: boolean;
  onClose: () => void;
}

const TermsModal: React.FC<TermsModalProps> = ({ visible, onClose }) => {
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
            <Heading size="lg" color="$textDark800">Terms of Service</Heading>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content}>
            <Text style={styles.paragraph}>Last updated: 14/01/2026</Text>
            
            <Text style={styles.paragraph}>
              These Terms of Service ("Terms") govern the use of the AI Toy app, device ecosystem, and related services (collectively, "Services"). By using the Services, you agree to these Terms.
            </Text>
            
            <Text style={styles.sectionTitle}>1. Eligibility & Accounts</Text>
            <Text style={styles.paragraph}>• The Services are intended for use by parents/guardians and families.</Text>
            <Text style={styles.paragraph}>• A parent/guardian account may be required for onboarding, purchases, and settings.</Text>
            <Text style={styles.paragraph}>• You are responsible for maintaining account security and device pairing security.</Text>
            
            <Text style={styles.sectionTitle}>2. Device Pairing & Security</Text>
            <Text style={styles.paragraph}>To protect users and prevent unauthorized access:</Text>
            <Text style={styles.paragraph}>• Devices use custom BLE services and proprietary UUIDs</Text>
            <Text style={styles.paragraph}>• Onboarding may include QR code scanning and authentication</Text>
            <Text style={styles.paragraph}>• Devices may refuse connections or restrict features unless successfully authenticated</Text>
            <Text style={styles.paragraph}>You agree not to attempt to bypass pairing security or access devices not owned by you.</Text>
            
            <Text style={styles.sectionTitle}>3. Acceptable Use</Text>
            <Text style={styles.paragraph}>You may not:</Text>
            <Text style={styles.paragraph}>• Reverse engineer, exploit, or interfere with device/app security</Text>
            <Text style={styles.paragraph}>• Use the Services for illegal, harmful, abusive, or unsafe activity</Text>
            <Text style={styles.paragraph}>• Upload or use content that infringes intellectual property or privacy rights</Text>
            <Text style={styles.paragraph}>• Attempt to clone voices or impersonate individuals without permission</Text>
            <Text style={styles.paragraph}>• Harass, threaten, or endanger others via the Services</Text>
            
            <Text style={styles.sectionTitle}>4. AI Features & Content Disclaimer</Text>
            <Text style={styles.paragraph}>The Services may generate content using AI (including text and voice). AI outputs may be inaccurate. Do not rely on AI responses for medical, legal, or emergency purposes.</Text>
            
            <Text style={styles.sectionTitle}>5. Subscriptions</Text>
            <Text style={styles.paragraph}>If you purchase a subscription, it will auto-renew unless cancelled. You may cancel at any time in the App or through your app store billing settings.</Text>
            
            <Text style={styles.sectionTitle}>6. Termination for Misuse / Abuse</Text>
            <Text style={styles.paragraph}>We may suspend, restrict, or terminate your access to the Services (including disabling device connectivity, blocking pairing, or restricting Digital Goods) if we reasonably believe you have:</Text>
            <Text style={styles.paragraph}>• Misused, intentionally damaged, or tampered with the physical device</Text>
            <Text style={styles.paragraph}>• Attempted to bypass BLE security, pairing, authentication, or firmware restrictions</Text>
            <Text style={styles.paragraph}>• Used the system in a way that risks harm to children or other users</Text>
            <Text style={styles.paragraph}>• Engaged in fraud, abusive payment activity, or refund abuse</Text>
            <Text style={styles.paragraph}>• Violated acceptable use, IP rights, or safety rules</Text>
            <Text style={styles.paragraph}>If access is terminated due to misuse, refunds may be denied except where required by law.</Text>
            
            <Text style={styles.sectionTitle}>7. Limitation of Liability</Text>
            <Text style={styles.paragraph}>To the extent permitted by law, we are not liable for indirect or consequential damages arising from use of the Services.</Text>
            
            <Text style={styles.sectionTitle}>8. Changes</Text>
            <Text style={styles.paragraph}>We may update these Terms. If we make material changes, we will notify users in the App.</Text>
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
  sectionTitleSmall: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3C3C3C',
    marginTop: 12,
    marginBottom: 4,
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

export default TermsModal;