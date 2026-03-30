-- Create chat_messages table for storing voice conversation logs
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  toy_id UUID REFERENCES toys(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('user', 'assistant')),
  content TEXT NOT NULL,
  audio_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Users can view chat messages for their toys
DROP POLICY IF EXISTS "Users can view chat messages for their toys" ON chat_messages;
CREATE POLICY "Users can view chat messages for their toys" ON chat_messages FOR SELECT
  USING (EXISTS (SELECT 1 FROM toys WHERE toys.id = toy_id AND toys.user_id = auth.uid()));

-- Users can insert chat messages for their toys
DROP POLICY IF EXISTS "Users can insert chat messages for their toys" ON chat_messages;
CREATE POLICY "Users can insert chat messages for their toys" ON chat_messages FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM toys WHERE toys.id = toy_id AND toys.user_id = auth.uid()));

-- Users can delete chat messages for their toys
DROP POLICY IF EXISTS "Users can delete chat messages for their toys" ON chat_messages;
CREATE POLICY "Users can delete chat messages for their toys" ON chat_messages FOR DELETE
  USING (EXISTS (SELECT 1 FROM toys WHERE toys.id = toy_id AND toys.user_id = auth.uid()));

-- Create index for faster queries (IF NOT EXISTS requires PG 9.5+, safe to re-run)
CREATE INDEX IF NOT EXISTS idx_chat_messages_toy_id ON chat_messages(toy_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Enable real-time for chat_messages table
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;