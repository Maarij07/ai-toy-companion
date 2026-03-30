import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { Trash2 } from 'lucide-react-native';
import ChatService, { ChatMessage } from '../services/ChatService';
import { supabase } from '../config/supabase';

interface ChatScreenProps {
  toyId: string;
  toyName: string;
  onClose: () => void;
}

export default function ChatScreen({ toyId, toyName, onClose }: ChatScreenProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const scrollViewRef = useRef<ScrollView>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    loadMessages();
    setupRealtimeSubscription();

    // Cleanup subscription on unmount
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [toyId]);

  const setupRealtimeSubscription = () => {
    // Remove existing subscription if any
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
    }

    // Subscribe to new chat messages for this toy
    const channel = supabase
      .channel(`chat_messages_${toyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `toy_id=eq.${toyId}`,
        },
        (payload) => {
          console.log('New message received:', payload.new);
          const newMessage = payload.new as ChatMessage;
          
          // Add new message to the list
          setMessages(prev => {
            // Check if message already exists to avoid duplicates
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage];
          });

          // Scroll to bottom after a short delay
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
          filter: `toy_id=eq.${toyId}`,
        },
        (payload) => {
          console.log('Message deleted:', payload.old);
          const deletedMessageId = payload.old.id;
          setMessages(prev => prev.filter(m => m.id !== deletedMessageId));
        }
      )
      .subscribe((status) => {
        console.log('Realtime subscription status:', status);
      });

    subscriptionRef.current = channel;
  };

  const loadMessages = async () => {
    setLoading(true);
    setError('');
    const result = await ChatService.getMessages(toyId);
    
    if (result.success && result.data) {
      setMessages(result.data);
      // Scroll to bottom after loading
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } else {
      setError(result.error || 'Failed to load messages');
    }
    
    setLoading(false);
  };

  const handleClearChat = async () => {
    Alert.alert(
      'Clear Chat',
      'Are you sure you want to clear all chat messages?',
      [
        { text: 'Cancel', onPress: () => {}, style: 'cancel' },
        {
          text: 'Clear',
          onPress: async () => {
            const result = await ChatService.clearMessages(toyId);
            if (result.success) {
              setMessages([]);
            } else {
              setError(result.error || 'Failed to clear messages');
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleDeleteMessage = async (messageId: string) => {
    const result = await ChatService.deleteMessage(messageId);
    if (result.success) {
      setMessages(messages.filter(m => m.id !== messageId));
    } else {
      setError(result.error || 'Failed to delete message');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>{toyName}</Text>
          <Text style={styles.headerSubtitle}>Chat History</Text>
        </View>
        <TouchableOpacity
          onPress={handleClearChat}
          style={styles.clearButton}
          disabled={messages.length === 0}>
          <Trash2 size={20} color={messages.length === 0 ? '#999' : '#FF6B6B'} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#6D8B74" />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={loadMessages}
            style={styles.retryButton}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : messages.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyText}>No messages yet</Text>
          <Text style={styles.emptySubtext}>Start speaking to your toy!</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}>
          {messages.map((message) => (
            <View
              key={message.id}
              style={[
                styles.messageBubble,
                message.message_type === 'user'
                  ? styles.userMessage
                  : styles.assistantMessage,
              ]}>
              <View style={styles.messageHeader}>
                <Text style={styles.messageType}>
                  {message.message_type === 'user' ? 'You' : 'Buddy'}
                </Text>
                <Text style={styles.messageTime}>
                  {new Date(message.created_at).toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.messageContent}>{message.content}</Text>
              <TouchableOpacity
                onPress={() => handleDeleteMessage(message.id)}
                style={styles.deleteButton}>
                <Trash2 size={14} color="rgba(255,255,255,0.5)" />
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}

      {/* Close Button */}
      <TouchableOpacity
        onPress={onClose}
        style={styles.closeButton}>
        <Text style={styles.closeButtonText}>Close</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 2,
  },
  clearButton: {
    padding: 8,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageBubble: {
    marginVertical: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    maxWidth: '85%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#6D8B74',
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  messageType: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.7)',
  },
  messageTime: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.5)',
  },
  messageContent: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  deleteButton: {
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.5)',
  },
  errorText: {
    fontSize: 14,
    color: '#FF6B6B',
    marginBottom: 16,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#6D8B74',
    borderRadius: 8,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  closeButton: {
    marginHorizontal: 16,
    marginVertical: 12,
    paddingVertical: 12,
    backgroundColor: '#6D8B74',
    borderRadius: 8,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
