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
            <Text style={styles.title}>Privacy Policy</Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={styles.content}>
            <Text style={styles.sectionTitle}>1. Information We Collect</Text>
            <Text style={styles.paragraph}>
              We collect personal information that you provide directly to us, such as when you create an account, use our services, or communicate with us.
            </Text>
            
            <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
            <Text style={styles.paragraph}>
              We use your information to provide, maintain, and improve our services, to communicate with you, and to personalize your experience.
            </Text>
            
            <Text style={styles.sectionTitle}>3. Data Security</Text>
            <Text style={styles.paragraph}>
              We implement appropriate security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.
            </Text>
            
            <Text style={styles.sectionTitle}>4. Children's Privacy</Text>
            <Text style={styles.paragraph}>
              Our services are not intended for children under 13. We do not knowingly collect personal information from children under 13.
            </Text>
            
            <Text style={styles.sectionTitle}>5. Data Retention</Text>
            <Text style={styles.paragraph}>
              We retain your personal information for as long as necessary to provide our services and comply with our legal obligations.
            </Text>
            
            <Text style={styles.sectionTitle}>6. Your Rights</Text>
            <Text style={styles.paragraph}>
              You have the right to access, update, or delete your personal information. You may also object to processing or request data portability.
            </Text>
            
            <Text style={styles.sectionTitle}>7. Third-Party Services</Text>
            <Text style={styles.paragraph}>
              We may share your information with third-party service providers who assist us in operating our app and conducting business.
            </Text>
            
            <Text style={styles.sectionTitle}>8. Changes to Privacy Policy</Text>
            <Text style={styles.paragraph}>
              We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page.
            </Text>
            
            <Text style={styles.sectionTitle}>9. Contact Us</Text>
            <Text style={styles.paragraph}>
              If you have any questions about this privacy policy, please contact us at privacy@aitoycompanion.com
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

export default PrivacyModal;