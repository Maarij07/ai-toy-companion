import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
const colors = require('../config/colors');

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
            <Text style={styles.title}>Terms & Conditions</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content}>
            <Text style={styles.sectionTitle}>1. Introduction</Text>
            <Text style={styles.paragraph}>
              Welcome to AI Toy Companion. These terms and conditions outline the rules and regulations for the use of our application.
            </Text>
            
            <Text style={styles.sectionTitle}>2. Intellectual Property</Text>
            <Text style={styles.paragraph}>
              All content, trademarks, logos, and intellectual property on this application are owned by AI Toy Companion or its licensors.
            </Text>
            
            <Text style={styles.sectionTitle}>3. User Responsibilities</Text>
            <Text style={styles.paragraph}>
              Users must be at least 13 years old to use this application. Parents and guardians are responsible for supervising children under 16.
            </Text>
            
            <Text style={styles.sectionTitle}>4. Data Collection</Text>
            <Text style={styles.paragraph}>
              We collect personal information to provide and improve our services. We use your data to enhance your experience with AI Toy Companion.
            </Text>
            
            <Text style={styles.sectionTitle}>5. Prohibited Activities</Text>
            <Text style={styles.paragraph}>
              You agree not to misuse our service or help anyone else do so. This includes attempting to access, tamper with, or use non-public APIs.
            </Text>
            
            <Text style={styles.sectionTitle}>6. Limitation of Liability</Text>
            <Text style={styles.paragraph}>
              AI Toy Companion shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of our services.
            </Text>
            
            <Text style={styles.sectionTitle}>7. Changes to Terms</Text>
            <Text style={styles.paragraph}>
              We reserve the right to modify these terms at any time. Continued use of the application after changes constitutes acceptance of the updated terms.
            </Text>
            
            <Text style={styles.sectionTitle}>8. Contact Us</Text>
            <Text style={styles.paragraph}>
              If you have any questions about these terms, please contact us at support@aitoycompanion.com
            </Text>
          </ScrollView>
          
          <TouchableOpacity style={styles.agreeButton} onPress={onClose}>
            <Text style={styles.agreeButtonText}>I Agree</Text>
          </TouchableOpacity>
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
    backgroundColor: colors.surface,
    borderRadius: 16,
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16.0,
    elevation: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: colors.surfaceLight,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 20,
    color: colors.textSecondary,
  },
  content: {
    padding: 20,
    maxHeight: '70%',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  paragraph: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 12,
  },
  agreeButton: {
    backgroundColor: colors.primary,
    padding: 16,
    alignItems: 'center',
    margin: 20,
    borderRadius: 12,
  },
  agreeButtonText: {
    color: colors.textLight,
    fontSize: 16,
    fontWeight: '600',
  },
});

export default TermsModal;