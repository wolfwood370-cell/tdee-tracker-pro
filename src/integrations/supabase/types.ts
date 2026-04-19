export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      biofeedback_logs: {
        Row: {
          created_at: string
          energy_score: number
          hunger_score: number
          id: string
          notes: string | null
          performance_score: number
          sleep_score: number
          user_id: string
          week_start_date: string
        }
        Insert: {
          created_at?: string
          energy_score: number
          hunger_score: number
          id?: string
          notes?: string | null
          performance_score: number
          sleep_score: number
          user_id: string
          week_start_date: string
        }
        Update: {
          created_at?: string
          energy_score?: number
          hunger_score?: number
          id?: string
          notes?: string | null
          performance_score?: number
          sleep_score?: number
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "biofeedback_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_metrics: {
        Row: {
          average_food_quality: number | null
          bfm: number | null
          bmr_inbody: number | null
          calories: number | null
          carbs: number | null
          day_type: string | null
          fat_la_kg: number | null
          fat_la_pct: number | null
          fat_ll_kg: number | null
          fat_ll_pct: number | null
          fat_ra_kg: number | null
          fat_ra_pct: number | null
          fat_rl_kg: number | null
          fat_rl_pct: number | null
          fat_tr_kg: number | null
          fat_tr_pct: number | null
          fats: number | null
          fiber: number | null
          id: string
          is_interpolated: boolean
          is_perfect_day: boolean
          lean_la_kg: number | null
          lean_la_pct: number | null
          lean_ll_kg: number | null
          lean_ll_pct: number | null
          lean_ra_kg: number | null
          lean_ra_pct: number | null
          lean_rl_kg: number | null
          lean_rl_pct: number | null
          lean_tr_kg: number | null
          lean_tr_pct: number | null
          log_date: string
          meals_log: Json
          menstrual_phase: string | null
          notes: string | null
          pbf: number | null
          protein: number | null
          smm: number | null
          sodium_mg: number | null
          steps: number | null
          tbw: number | null
          user_id: string
          vfa: number | null
          water_l: number | null
          weight: number | null
        }
        Insert: {
          average_food_quality?: number | null
          bfm?: number | null
          bmr_inbody?: number | null
          calories?: number | null
          carbs?: number | null
          day_type?: string | null
          fat_la_kg?: number | null
          fat_la_pct?: number | null
          fat_ll_kg?: number | null
          fat_ll_pct?: number | null
          fat_ra_kg?: number | null
          fat_ra_pct?: number | null
          fat_rl_kg?: number | null
          fat_rl_pct?: number | null
          fat_tr_kg?: number | null
          fat_tr_pct?: number | null
          fats?: number | null
          fiber?: number | null
          id?: string
          is_interpolated?: boolean
          is_perfect_day?: boolean
          lean_la_kg?: number | null
          lean_la_pct?: number | null
          lean_ll_kg?: number | null
          lean_ll_pct?: number | null
          lean_ra_kg?: number | null
          lean_ra_pct?: number | null
          lean_rl_kg?: number | null
          lean_rl_pct?: number | null
          lean_tr_kg?: number | null
          lean_tr_pct?: number | null
          log_date: string
          meals_log?: Json
          menstrual_phase?: string | null
          notes?: string | null
          pbf?: number | null
          protein?: number | null
          smm?: number | null
          sodium_mg?: number | null
          steps?: number | null
          tbw?: number | null
          user_id: string
          vfa?: number | null
          water_l?: number | null
          weight?: number | null
        }
        Update: {
          average_food_quality?: number | null
          bfm?: number | null
          bmr_inbody?: number | null
          calories?: number | null
          carbs?: number | null
          day_type?: string | null
          fat_la_kg?: number | null
          fat_la_pct?: number | null
          fat_ll_kg?: number | null
          fat_ll_pct?: number | null
          fat_ra_kg?: number | null
          fat_ra_pct?: number | null
          fat_rl_kg?: number | null
          fat_rl_pct?: number | null
          fat_tr_kg?: number | null
          fat_tr_pct?: number | null
          fats?: number | null
          fiber?: number | null
          id?: string
          is_interpolated?: boolean
          is_perfect_day?: boolean
          lean_la_kg?: number | null
          lean_la_pct?: number | null
          lean_ll_kg?: number | null
          lean_ll_pct?: number | null
          lean_ra_kg?: number | null
          lean_ra_pct?: number | null
          lean_rl_kg?: number | null
          lean_rl_pct?: number | null
          lean_tr_kg?: number | null
          lean_tr_pct?: number | null
          log_date?: string
          meals_log?: Json
          menstrual_phase?: string | null
          notes?: string | null
          pbf?: number | null
          protein?: number | null
          smm?: number | null
          sodium_mg?: number | null
          steps?: number | null
          tbw?: number | null
          user_id?: string
          vfa?: number | null
          water_l?: number | null
          weight?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_metrics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      favorite_meals: {
        Row: {
          calories: number
          carbs: number
          created_at: string
          description: string | null
          fats: number
          id: string
          meal_type: string
          name: string
          protein: number
          user_id: string
        }
        Insert: {
          calories?: number
          carbs?: number
          created_at?: string
          description?: string | null
          fats?: number
          id?: string
          meal_type: string
          name: string
          protein?: number
          user_id: string
        }
        Update: {
          calories?: number
          carbs?: number
          created_at?: string
          description?: string | null
          fats?: number
          id?: string
          meal_type?: string
          name?: string
          protein?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorite_meals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          activity_level: number | null
          allergies: string | null
          birth_date: string | null
          calorie_distribution: string
          coach_note: string | null
          created_at: string
          current_streak: number
          diet_break_until: string | null
          diet_strategy: string
          diet_type: string
          dietary_preference: string
          full_name: string | null
          goal_rate: number | null
          goal_type: string
          height_cm: number | null
          id: string
          last_activity_date: string | null
          manual_calories: number | null
          manual_carbs: number | null
          manual_fats: number | null
          manual_override_active: boolean
          manual_protein: number | null
          protein_pref: string
          sex: string | null
          subscription_status: string
          target_weight: number | null
          track_menstrual_cycle: boolean
          training_days_per_week: number
          training_schedule: Json
          trial_ends_at: string
          weekly_schedule: Json
        }
        Insert: {
          activity_level?: number | null
          allergies?: string | null
          birth_date?: string | null
          calorie_distribution?: string
          coach_note?: string | null
          created_at?: string
          current_streak?: number
          diet_break_until?: string | null
          diet_strategy?: string
          diet_type?: string
          dietary_preference?: string
          full_name?: string | null
          goal_rate?: number | null
          goal_type?: string
          height_cm?: number | null
          id: string
          last_activity_date?: string | null
          manual_calories?: number | null
          manual_carbs?: number | null
          manual_fats?: number | null
          manual_override_active?: boolean
          manual_protein?: number | null
          protein_pref?: string
          sex?: string | null
          subscription_status?: string
          target_weight?: number | null
          track_menstrual_cycle?: boolean
          training_days_per_week?: number
          training_schedule?: Json
          trial_ends_at?: string
          weekly_schedule?: Json
        }
        Update: {
          activity_level?: number | null
          allergies?: string | null
          birth_date?: string | null
          calorie_distribution?: string
          coach_note?: string | null
          created_at?: string
          current_streak?: number
          diet_break_until?: string | null
          diet_strategy?: string
          diet_type?: string
          dietary_preference?: string
          full_name?: string | null
          goal_rate?: number | null
          goal_type?: string
          height_cm?: number | null
          id?: string
          last_activity_date?: string | null
          manual_calories?: number | null
          manual_carbs?: number | null
          manual_fats?: number | null
          manual_override_active?: boolean
          manual_protein?: number | null
          protein_pref?: string
          sex?: string | null
          subscription_status?: string
          target_weight?: number | null
          track_menstrual_cycle?: boolean
          training_days_per_week?: number
          training_schedule?: Json
          trial_ends_at?: string
          weekly_schedule?: Json
        }
        Relationships: []
      }
      progress_entries: {
        Row: {
          arm_left: number | null
          arm_right: number | null
          calf_left: number | null
          calf_right: number | null
          chest: number | null
          created_at: string
          entry_date: string
          hips: number | null
          id: string
          neck: number | null
          photo_back: string | null
          photo_front: string | null
          photo_side: string | null
          snap_calories: number | null
          snap_carbs: number | null
          snap_fats: number | null
          snap_protein: number | null
          snap_sodium: number | null
          snap_tdee: number | null
          snap_water: number | null
          thigh_left: number | null
          thigh_right: number | null
          user_id: string
          waist: number | null
          weight: number | null
        }
        Insert: {
          arm_left?: number | null
          arm_right?: number | null
          calf_left?: number | null
          calf_right?: number | null
          chest?: number | null
          created_at?: string
          entry_date: string
          hips?: number | null
          id?: string
          neck?: number | null
          photo_back?: string | null
          photo_front?: string | null
          photo_side?: string | null
          snap_calories?: number | null
          snap_carbs?: number | null
          snap_fats?: number | null
          snap_protein?: number | null
          snap_sodium?: number | null
          snap_tdee?: number | null
          snap_water?: number | null
          thigh_left?: number | null
          thigh_right?: number | null
          user_id: string
          waist?: number | null
          weight?: number | null
        }
        Update: {
          arm_left?: number | null
          arm_right?: number | null
          calf_left?: number | null
          calf_right?: number | null
          chest?: number | null
          created_at?: string
          entry_date?: string
          hips?: number | null
          id?: string
          neck?: number | null
          photo_back?: string | null
          photo_front?: string | null
          photo_side?: string | null
          snap_calories?: number | null
          snap_carbs?: number | null
          snap_fats?: number | null
          snap_protein?: number | null
          snap_sodium?: number | null
          snap_tdee?: number | null
          snap_water?: number | null
          thigh_left?: number | null
          thigh_right?: number | null
          user_id?: string
          waist?: number | null
          weight?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      weekly_analytics: {
        Row: {
          adaptive_tdee: number | null
          avg_calories: number | null
          avg_weight: number | null
          id: string
          user_id: string
          week_start_date: string
        }
        Insert: {
          adaptive_tdee?: number | null
          avg_calories?: number | null
          avg_weight?: number | null
          id?: string
          user_id: string
          week_start_date: string
        }
        Update: {
          adaptive_tdee?: number | null
          avg_calories?: number | null
          avg_weight?: number | null
          id?: string
          user_id?: string
          week_start_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_analytics_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_checkins: {
        Row: {
          created_at: string
          feedback_text: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_text: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_text?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_coach_user_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "coach" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["coach", "client"],
    },
  },
} as const
