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
          bfm: number | null
          bmr_inbody: number | null
          calories: number | null
          id: string
          is_interpolated: boolean
          log_date: string
          notes: string | null
          pbf: number | null
          smm: number | null
          steps: number | null
          user_id: string
          vfa: number | null
          weight: number | null
        }
        Insert: {
          bfm?: number | null
          bmr_inbody?: number | null
          calories?: number | null
          id?: string
          is_interpolated?: boolean
          log_date: string
          notes?: string | null
          pbf?: number | null
          smm?: number | null
          steps?: number | null
          user_id: string
          vfa?: number | null
          weight?: number | null
        }
        Update: {
          bfm?: number | null
          bmr_inbody?: number | null
          calories?: number | null
          id?: string
          is_interpolated?: boolean
          log_date?: string
          notes?: string | null
          pbf?: number | null
          smm?: number | null
          steps?: number | null
          user_id?: string
          vfa?: number | null
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
      profiles: {
        Row: {
          activity_level: number | null
          birth_date: string | null
          calorie_distribution: string
          coach_note: string | null
          created_at: string
          diet_strategy: string
          diet_type: string
          full_name: string | null
          goal_rate: number | null
          goal_type: string
          height_cm: number | null
          id: string
          manual_calories: number | null
          manual_carbs: number | null
          manual_fats: number | null
          manual_override_active: boolean
          manual_protein: number | null
          protein_pref: string
          sex: string | null
          training_days_per_week: number
          training_schedule: Json
        }
        Insert: {
          activity_level?: number | null
          birth_date?: string | null
          calorie_distribution?: string
          coach_note?: string | null
          created_at?: string
          diet_strategy?: string
          diet_type?: string
          full_name?: string | null
          goal_rate?: number | null
          goal_type?: string
          height_cm?: number | null
          id: string
          manual_calories?: number | null
          manual_carbs?: number | null
          manual_fats?: number | null
          manual_override_active?: boolean
          manual_protein?: number | null
          protein_pref?: string
          sex?: string | null
          training_days_per_week?: number
          training_schedule?: Json
        }
        Update: {
          activity_level?: number | null
          birth_date?: string | null
          calorie_distribution?: string
          coach_note?: string | null
          created_at?: string
          diet_strategy?: string
          diet_type?: string
          full_name?: string | null
          goal_rate?: number | null
          goal_type?: string
          height_cm?: number | null
          id?: string
          manual_calories?: number | null
          manual_carbs?: number | null
          manual_fats?: number | null
          manual_override_active?: boolean
          manual_protein?: number | null
          protein_pref?: string
          sex?: string | null
          training_days_per_week?: number
          training_schedule?: Json
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
