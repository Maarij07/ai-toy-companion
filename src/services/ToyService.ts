import { supabase } from '../config/supabase';
import { Toy, ToyOwner, ToyInterest } from '../config/supabase';

export class ToyService {
  // Create a new toy
  static async createToy(userId: string, toyData: Omit<Toy, 'id' | 'user_id' | 'created_at' | 'updated_at'>) {
    try {
      const { data, error } = await supabase
        .from('toys')
        .insert([
          {
            user_id: userId,
            name: toyData.name,
            custom_personality: toyData.custom_personality,
            connected: toyData.connected,
            is_active: toyData.is_active,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Get all toys for a user
  static async getUserToys(userId: string) {
    try {
      const { data, error } = await supabase
        .from('toys')
        .select(`
          *,
          toy_owners (*),
          toy_interests (interest)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Get a specific toy by ID
  static async getToyById(toyId: string) {
    try {
      const { data, error } = await supabase
        .from('toys')
        .select(`
          *,
          toy_owners (*),
          toy_interests (interest)
        `)
        .eq('id', toyId)
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Update a toy
  static async updateToy(toyId: string, updates: Partial<Omit<Toy, 'id' | 'user_id' | 'created_at'>>) {
    try {
      const { data, error } = await supabase
        .from('toys')
        .update(updates)
        .eq('id', toyId)
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Delete a toy
  static async deleteToy(toyId: string) {
    try {
      const { error } = await supabase
        .from('toys')
        .delete()
        .eq('id', toyId);

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  // Add owner to toy
  static async addOwnerToToy(toyId: string, ownerData: Omit<ToyOwner, 'id' | 'toy_id' | 'created_at'>) {
    try {
      const { data, error } = await supabase
        .from('toy_owners')
        .insert([
          {
            toy_id: toyId,
            name: ownerData.name,
            age: ownerData.age,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Remove owner from toy
  static async removeOwnerFromToy(ownerId: string) {
    try {
      const { error } = await supabase
        .from('toy_owners')
        .delete()
        .eq('id', ownerId);

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  // Add interest to toy
  static async addInterestToToy(toyId: string, interest: ToyInterest['interest']) {
    try {
      const { data, error } = await supabase
        .from('toy_interests')
        .insert([
          {
            toy_id: toyId,
            interest: interest,
          },
        ])
        .select()
        .single();

      if (error) throw error;
      return { data, error: null };
    } catch (error: any) {
      return { data: null, error };
    }
  }

  // Remove interest from toy
  static async removeInterestFromToy(toyId: string, interest: ToyInterest['interest']) {
    try {
      const { error } = await supabase
        .from('toy_interests')
        .delete()
        .match({ toy_id: toyId, interest: interest });

      if (error) throw error;
      return { error: null };
    } catch (error: any) {
      return { error };
    }
  }

  // Get all interests for a toy
  static async getToyInterests(toyId: string) {
    try {
      const { data, error } = await supabase
        .from('toy_interests')
        .select('interest')
        .eq('toy_id', toyId);

      if (error) throw error;
      return { data: data?.map(item => item.interest) || [], error: null };
    } catch (error: any) {
      return { data: [], error };
    }
  }
}

// Also export as default for compatibility
export default ToyService;