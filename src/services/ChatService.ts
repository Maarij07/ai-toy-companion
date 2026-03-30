import { supabase } from '../config/supabase';

// Refresh session if expired or within 60s of expiry — same pattern as GoogleSTTService
async function getRefreshedSession() {
  let { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData?.session;
  if (session) {
    const now = Math.floor(Date.now() / 1000);
    if ((session.expires_at ?? 0) - now < 60) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      if (refreshed?.session) session = refreshed.session;
    }
  }
  return session;
}

export interface ChatMessage {
  id: string;
  toy_id: string;
  user_id: string;
  message_type: 'user' | 'assistant';
  content: string;
  audio_url?: string;
  created_at: string;
  updated_at: string;
}

class ChatService {
  /**
   * Save a chat message to the database
   */
  static async saveMessage(
    toyId: string,
    messageType: 'user' | 'assistant',
    content: string,
    audioUrl?: string
  ): Promise<{ success: boolean; error?: string; data?: ChatMessage }> {
    try {
      const session = await getRefreshedSession();

      if (!session?.user?.id) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          toy_id: toyId,
          user_id: session.user.id,
          message_type: messageType,
          content: content,
          audio_url: audioUrl || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        console.error('Error saving chat message:', error);
        return { success: false, error: error.message };
      }

      console.log('Chat message saved:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Error in saveMessage:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Get all chat messages for a toy
   */
  static async getMessages(toyId: string): Promise<{ success: boolean; error?: string; data?: ChatMessage[] }> {
    try {
      const session = await getRefreshedSession();

      if (!session?.user?.id) {
        return { success: false, error: 'User not authenticated' };
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('*')
        .eq('toy_id', toyId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching chat messages:', error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data as ChatMessage[] };
    } catch (error) {
      console.error('Error in getMessages:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Delete a chat message
   */
  static async deleteMessage(messageId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('id', messageId);

      if (error) {
        console.error('Error deleting chat message:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in deleteMessage:', error);
      return { success: false, error: (error as Error).message };
    }
  }

  /**
   * Clear all chat messages for a toy
   */
  static async clearMessages(toyId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .delete()
        .eq('toy_id', toyId);

      if (error) {
        console.error('Error clearing chat messages:', error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in clearMessages:', error);
      return { success: false, error: (error as Error).message };
    }
  }
}

export default ChatService;
