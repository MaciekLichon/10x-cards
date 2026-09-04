export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      flashcard_review_logs: {
        Row: {
          config_version: string;
          created_at: string;
          expected_schedule_version: number;
          flashcard_id: string;
          id: string;
          post_state: Json;
          pre_state: Json;
          rating: number;
          request_id: string;
          result: Json;
          reviewed_at: string;
          scheduler_version: string;
          session_id: string;
          user_id: string;
        };
        Insert: {
          config_version: string;
          created_at?: string;
          expected_schedule_version: number;
          flashcard_id: string;
          id?: string;
          post_state: Json;
          pre_state: Json;
          rating: number;
          request_id: string;
          result: Json;
          reviewed_at: string;
          scheduler_version: string;
          session_id: string;
          user_id: string;
        };
        Update: {
          config_version?: string;
          created_at?: string;
          expected_schedule_version?: number;
          flashcard_id?: string;
          id?: string;
          post_state?: Json;
          pre_state?: Json;
          rating?: number;
          request_id?: string;
          result?: Json;
          reviewed_at?: string;
          scheduler_version?: string;
          session_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcard_review_logs_card_owner_fk";
            columns: ["flashcard_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "flashcard_review_logs_session_owner_fk";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "flashcard_review_sessions";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      flashcard_review_session_cards: {
        Row: {
          completed_at: string | null;
          flashcard_id: string;
          next_due: string | null;
          ordinal: number;
          review_count: number;
          session_id: string;
          state: string;
          user_id: string;
        };
        Insert: {
          completed_at?: string | null;
          flashcard_id: string;
          next_due?: string | null;
          ordinal: number;
          review_count?: number;
          session_id: string;
          state?: string;
          user_id: string;
        };
        Update: {
          completed_at?: string | null;
          flashcard_id?: string;
          next_due?: string | null;
          ordinal?: number;
          review_count?: number;
          session_id?: string;
          state?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "flashcard_review_session_cards_card_owner_fk";
            columns: ["flashcard_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "flashcards";
            referencedColumns: ["id", "user_id"];
          },
          {
            foreignKeyName: "flashcard_review_session_cards_session_owner_fk";
            columns: ["session_id", "user_id"];
            isOneToOne: false;
            referencedRelation: "flashcard_review_sessions";
            referencedColumns: ["id", "user_id"];
          },
        ];
      };
      flashcard_review_sessions: {
        Row: {
          again_count: number;
          completed_at: string | null;
          created_at: string;
          cutoff: string;
          deferred_count: number;
          easy_count: number;
          expires_at: string;
          good_count: number;
          hard_count: number;
          id: string;
          reviewed_count: number;
          status: string;
          user_id: string;
        };
        Insert: {
          again_count?: number;
          completed_at?: string | null;
          created_at?: string;
          cutoff: string;
          deferred_count?: number;
          easy_count?: number;
          expires_at?: string;
          good_count?: number;
          hard_count?: number;
          id?: string;
          reviewed_count?: number;
          status?: string;
          user_id: string;
        };
        Update: {
          again_count?: number;
          completed_at?: string | null;
          created_at?: string;
          cutoff?: string;
          deferred_count?: number;
          easy_count?: number;
          expires_at?: string;
          good_count?: number;
          hard_count?: number;
          id?: string;
          reviewed_count?: number;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      flashcards: {
        Row: {
          back: string;
          config_version: string;
          created_at: string;
          difficulty: number;
          due: string;
          elapsed_days: number;
          front: string;
          id: string;
          lapses: number;
          last_review: string | null;
          learning_steps: number;
          reps: number;
          schedule_version: number;
          scheduled_days: number;
          scheduler_version: string;
          stability: number;
          state: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          back: string;
          config_version?: string;
          created_at?: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          front: string;
          id?: string;
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          reps?: number;
          schedule_version?: number;
          scheduled_days?: number;
          scheduler_version?: string;
          stability?: number;
          state?: number;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          back?: string;
          config_version?: string;
          created_at?: string;
          difficulty?: number;
          due?: string;
          elapsed_days?: number;
          front?: string;
          id?: string;
          lapses?: number;
          last_review?: string | null;
          learning_steps?: number;
          reps?: number;
          schedule_version?: number;
          scheduled_days?: number;
          scheduler_version?: string;
          stability?: number;
          state?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      apply_flashcard_review: {
        Args: {
          p_expected_schedule_version: number;
          p_flashcard_id: string;
          p_post_state: Json;
          p_rating: number;
          p_request_id: string;
          p_result: Json;
          p_reviewed_at: string;
          p_session_id: string;
          p_user_id: string;
        };
        Returns: Json;
      };
      get_or_create_review_session: {
        Args: { p_cutoff: string; p_user_id: string };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
