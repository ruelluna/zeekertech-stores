export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  ops: {
    Tables: {
      ingredient_daily_status: {
        Row: {
          date: string;
          ingredient_key: string;
          market_price: number | null;
          qty_available: number | null;
          status: Database["ops"]["Enums"]["daily_status"];
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          date: string;
          ingredient_key: string;
          market_price?: number | null;
          qty_available?: number | null;
          status?: Database["ops"]["Enums"]["daily_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          date?: string;
          ingredient_key?: string;
          market_price?: number | null;
          qty_available?: number | null;
          status?: Database["ops"]["Enums"]["daily_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      inventory_counts: {
        Row: {
          beginning: number | null;
          counted_by: string | null;
          date: string;
          ending: number | null;
          item_id: string;
          received: number;
          updated_at: string;
          wasted: number;
        };
        ComputedFields: never;
        Insert: {
          beginning?: number | null;
          counted_by?: string | null;
          date: string;
          ending?: number | null;
          item_id: string;
          received?: number;
          updated_at?: string;
          wasted?: number;
        };
        Update: {
          beginning?: number | null;
          counted_by?: string | null;
          date?: string;
          ending?: number | null;
          item_id?: string;
          received?: number;
          updated_at?: string;
          wasted?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_counts_item_id_fkey";
            columns: ["item_id"];
            isOneToOne: false;
            referencedRelation: "inventory_items";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_items: {
        Row: {
          active: boolean;
          buy_for_days: number;
          category: string;
          created_at: string;
          id: string;
          name: string;
          notes: string | null;
          par_level: number | null;
          reorder_point: number | null;
          sort_order: number;
          store_id: string;
          unit: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          buy_for_days?: number;
          category?: string;
          created_at?: string;
          id?: string;
          name: string;
          notes?: string | null;
          par_level?: number | null;
          reorder_point?: number | null;
          sort_order?: number;
          store_id: string;
          unit?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          buy_for_days?: number;
          category?: string;
          created_at?: string;
          id?: string;
          name?: string;
          notes?: string | null;
          par_level?: number | null;
          reorder_point?: number | null;
          sort_order?: number;
          store_id?: string;
          unit?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      label_templates: {
        Row: {
          created_at: string;
          id: string;
          is_default: boolean;
          kind: Database["ops"]["Enums"]["label_kind"];
          layout: NonNullable<Json>;
          name: string;
          store_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind: Database["ops"]["Enums"]["label_kind"];
          layout: NonNullable<Json>;
          name: string;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_default?: boolean;
          kind?: Database["ops"]["Enums"]["label_kind"];
          layout?: NonNullable<Json>;
          name?: string;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      menu_snapshots: {
        Row: {
          received_at: string;
          snapshot: NonNullable<Json>;
          store_id: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          received_at?: string;
          snapshot: NonNullable<Json>;
          store_id: string;
          version: string;
        };
        Update: {
          received_at?: string;
          snapshot?: NonNullable<Json>;
          store_id?: string;
          version?: string;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          actor: string | null;
          created_at: string;
          from_status: Database["ops"]["Enums"]["order_status"] | null;
          id: number;
          note: string | null;
          order_id: string;
          to_status: Database["ops"]["Enums"]["order_status"];
        };
        ComputedFields: never;
        Insert: {
          actor?: string | null;
          created_at?: string;
          from_status?: Database["ops"]["Enums"]["order_status"] | null;
          id?: never;
          note?: string | null;
          order_id: string;
          to_status: Database["ops"]["Enums"]["order_status"];
        };
        Update: {
          actor?: string | null;
          created_at?: string;
          from_status?: Database["ops"]["Enums"]["order_status"] | null;
          id?: never;
          note?: string | null;
          order_id?: string;
          to_status?: Database["ops"]["Enums"]["order_status"];
        };
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      order_item_availability: {
        Row: {
          confirmed_at: string | null;
          confirmed_by: string | null;
          final_unit_price: number | null;
          note: string | null;
          order_item_id: string;
          status: Database["ops"]["Enums"]["item_availability"];
          substitute_sku: string | null;
        };
        ComputedFields: never;
        Insert: {
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          final_unit_price?: number | null;
          note?: string | null;
          order_item_id: string;
          status?: Database["ops"]["Enums"]["item_availability"];
          substitute_sku?: string | null;
        };
        Update: {
          confirmed_at?: string | null;
          confirmed_by?: string | null;
          final_unit_price?: number | null;
          note?: string | null;
          order_item_id?: string;
          status?: Database["ops"]["Enums"]["item_availability"];
          substitute_sku?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_item_availability_order_item_id_fkey";
            columns: ["order_item_id"];
            isOneToOne: true;
            referencedRelation: "order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          estimated_unit_price: number | null;
          id: string;
          item_status: Database["ops"]["Enums"]["item_status"];
          modifiers: NonNullable<Json>;
          name: string;
          needs_availability: boolean;
          notes: string;
          order_id: string;
          prep_minutes: number | null;
          price_mode: Database["ops"]["Enums"]["price_mode"];
          qty: number;
          requires_cooking: boolean;
          sku: string;
          sort_order: number;
          unit_price: number | null;
          weight_kg: number | null;
        };
        ComputedFields: never;
        Insert: {
          estimated_unit_price?: number | null;
          id?: string;
          item_status?: Database["ops"]["Enums"]["item_status"];
          modifiers?: NonNullable<Json>;
          name: string;
          needs_availability?: boolean;
          notes?: string;
          order_id: string;
          prep_minutes?: number | null;
          price_mode: Database["ops"]["Enums"]["price_mode"];
          qty: number;
          requires_cooking?: boolean;
          sku: string;
          sort_order?: number;
          unit_price?: number | null;
          weight_kg?: number | null;
        };
        Update: {
          estimated_unit_price?: number | null;
          id?: string;
          item_status?: Database["ops"]["Enums"]["item_status"];
          modifiers?: NonNullable<Json>;
          name?: string;
          needs_availability?: boolean;
          notes?: string;
          order_id?: string;
          prep_minutes?: number | null;
          price_mode?: Database["ops"]["Enums"]["price_mode"];
          qty?: number;
          requires_cooking?: boolean;
          sku?: string;
          sort_order?: number;
          unit_price?: number | null;
          weight_kg?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          address: Json | null;
          availability_deadline: string | null;
          barangay: string | null;
          client_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          customer_decision: Database["ops"]["Enums"]["customer_decision"] | null;
          customer_name: string | null;
          customer_phone: string | null;
          customer_ref: string | null;
          decision_deadline: string | null;
          delivery_fee: number;
          discount_amount: number;
          distance_km: number | null;
          distance_method: Database["ops"]["Enums"]["distance_method"] | null;
          external_id: string | null;
          fee_breakdown: Json | null;
          fee_overridden_by: string | null;
          fee_override_reason: string | null;
          fee_source: Database["ops"]["Enums"]["fee_source"] | null;
          flags: string[];
          fulfillment: Database["ops"]["Enums"]["fulfillment"];
          id: string;
          is_estimate: boolean;
          lat: number | null;
          lng: number | null;
          notes: string | null;
          out_for_delivery_at: string | null;
          parent_order_id: string | null;
          payment_amount_claimed: number | null;
          payment_method: Database["ops"]["Enums"]["payment_method"] | null;
          payment_proof_path: string | null;
          payment_reference_no: string | null;
          payment_sender_name: string | null;
          payment_status: Database["ops"]["Enums"]["payment_status"];
          promotion_ref: string | null;
          queue_code: string;
          queue_date: string;
          rider_id: string | null;
          rider_name: string | null;
          rider_paid_out_at: string | null;
          rider_pay: number | null;
          scheduled_for: string;
          source: Database["ops"]["Enums"]["order_source"];
          status: Database["ops"]["Enums"]["order_status"];
          store_id: string;
          subtotal: number;
          total: number;
          travel_minutes: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: Json | null;
          availability_deadline?: string | null;
          barangay?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_decision?: Database["ops"]["Enums"]["customer_decision"] | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_ref?: string | null;
          decision_deadline?: string | null;
          delivery_fee?: number;
          discount_amount?: number;
          distance_km?: number | null;
          distance_method?: Database["ops"]["Enums"]["distance_method"] | null;
          external_id?: string | null;
          fee_breakdown?: Json | null;
          fee_overridden_by?: string | null;
          fee_override_reason?: string | null;
          fee_source?: Database["ops"]["Enums"]["fee_source"] | null;
          flags?: string[];
          fulfillment: Database["ops"]["Enums"]["fulfillment"];
          id?: string;
          is_estimate?: boolean;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          out_for_delivery_at?: string | null;
          parent_order_id?: string | null;
          payment_amount_claimed?: number | null;
          payment_method?: Database["ops"]["Enums"]["payment_method"] | null;
          payment_proof_path?: string | null;
          payment_reference_no?: string | null;
          payment_sender_name?: string | null;
          payment_status?: Database["ops"]["Enums"]["payment_status"];
          promotion_ref?: string | null;
          queue_code?: string;
          queue_date?: string;
          rider_id?: string | null;
          rider_name?: string | null;
          rider_paid_out_at?: string | null;
          rider_pay?: number | null;
          scheduled_for: string;
          source: Database["ops"]["Enums"]["order_source"];
          status?: Database["ops"]["Enums"]["order_status"];
          store_id: string;
          subtotal?: number;
          total?: number;
          travel_minutes?: number | null;
          updated_at?: string;
        };
        Update: {
          address?: Json | null;
          availability_deadline?: string | null;
          barangay?: string | null;
          client_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_decision?: Database["ops"]["Enums"]["customer_decision"] | null;
          customer_name?: string | null;
          customer_phone?: string | null;
          customer_ref?: string | null;
          decision_deadline?: string | null;
          delivery_fee?: number;
          discount_amount?: number;
          distance_km?: number | null;
          distance_method?: Database["ops"]["Enums"]["distance_method"] | null;
          external_id?: string | null;
          fee_breakdown?: Json | null;
          fee_overridden_by?: string | null;
          fee_override_reason?: string | null;
          fee_source?: Database["ops"]["Enums"]["fee_source"] | null;
          flags?: string[];
          fulfillment?: Database["ops"]["Enums"]["fulfillment"];
          id?: string;
          is_estimate?: boolean;
          lat?: number | null;
          lng?: number | null;
          notes?: string | null;
          out_for_delivery_at?: string | null;
          parent_order_id?: string | null;
          payment_amount_claimed?: number | null;
          payment_method?: Database["ops"]["Enums"]["payment_method"] | null;
          payment_proof_path?: string | null;
          payment_reference_no?: string | null;
          payment_sender_name?: string | null;
          payment_status?: Database["ops"]["Enums"]["payment_status"];
          promotion_ref?: string | null;
          queue_code?: string;
          queue_date?: string;
          rider_id?: string | null;
          rider_name?: string | null;
          rider_paid_out_at?: string | null;
          rider_pay?: number | null;
          scheduled_for?: string;
          source?: Database["ops"]["Enums"]["order_source"];
          status?: Database["ops"]["Enums"]["order_status"];
          store_id?: string;
          subtotal?: number;
          total?: number;
          travel_minutes?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "orders_parent_order_id_fkey";
            columns: ["parent_order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      payment_verifications: {
        Row: {
          amount_received: number | null;
          created_at: string;
          decision: Database["ops"]["Enums"]["payment_decision"];
          id: string;
          order_id: string;
          reason: string | null;
          reference_no: string | null;
          sender_name: string | null;
          verified_by: string;
        };
        ComputedFields: never;
        Insert: {
          amount_received?: number | null;
          created_at?: string;
          decision: Database["ops"]["Enums"]["payment_decision"];
          id?: string;
          order_id: string;
          reason?: string | null;
          reference_no?: string | null;
          sender_name?: string | null;
          verified_by: string;
        };
        Update: {
          amount_received?: number | null;
          created_at?: string;
          decision?: Database["ops"]["Enums"]["payment_decision"];
          id?: string;
          order_id?: string;
          reason?: string | null;
          reference_no?: string | null;
          sender_name?: string | null;
          verified_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payment_verifications_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      printers: {
        Row: {
          address: string;
          connection: Database["ops"]["Enums"]["printer_connection"];
          created_at: string;
          dpi: number;
          gap_mm: number;
          id: string;
          is_default: boolean;
          label_height_mm: number;
          label_width_mm: number;
          language: Database["ops"]["Enums"]["printer_language"];
          name: string;
          options: NonNullable<Json>;
          port: number | null;
          store_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address: string;
          connection: Database["ops"]["Enums"]["printer_connection"];
          created_at?: string;
          dpi?: number;
          gap_mm?: number;
          id?: string;
          is_default?: boolean;
          label_height_mm?: number;
          label_width_mm?: number;
          language: Database["ops"]["Enums"]["printer_language"];
          name: string;
          options?: NonNullable<Json>;
          port?: number | null;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          address?: string;
          connection?: Database["ops"]["Enums"]["printer_connection"];
          created_at?: string;
          dpi?: number;
          gap_mm?: number;
          id?: string;
          is_default?: boolean;
          label_height_mm?: number;
          label_width_mm?: number;
          language?: Database["ops"]["Enums"]["printer_language"];
          name?: string;
          options?: NonNullable<Json>;
          port?: number | null;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_overrides: {
        Row: {
          sku: string;
          sold_out: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          sku: string;
          sold_out?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          sku?: string;
          sold_out?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      product_stock: {
        Row: {
          qty_on_hand: number;
          sku: string;
          updated_at: string;
          updated_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          qty_on_hand?: number;
          sku: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          qty_on_hand?: number;
          sku?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      queue_counters: {
        Row: {
          last_number: number;
          queue_date: string;
          store_id: string;
        };
        ComputedFields: never;
        Insert: {
          last_number?: number;
          queue_date: string;
          store_id: string;
        };
        Update: {
          last_number?: number;
          queue_date?: string;
          store_id?: string;
        };
        Relationships: [];
      };
      sms_log: {
        Row: {
          created_at: string;
          error: string | null;
          id: number;
          kind: string;
          message: string;
          order_code: string | null;
          provider_id: string | null;
          recipient: string;
          status: string;
          store_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          error?: string | null;
          id?: never;
          kind: string;
          message: string;
          order_code?: string | null;
          provider_id?: string | null;
          recipient: string;
          status: string;
          store_id: string;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          id?: never;
          kind?: string;
          message?: string;
          order_code?: string | null;
          provider_id?: string | null;
          recipient?: string;
          status?: string;
          store_id?: string;
        };
        Relationships: [];
      };
      sms_settings: {
        Row: {
          admin_payment_to_verify: boolean;
          admin_phone: string | null;
          admin_seafood_check: boolean;
          customer_cancelled: boolean;
          customer_out_for_delivery: boolean;
          customer_payment_confirmed: boolean;
          customer_payment_rejected: boolean;
          customer_ready_pickup: boolean;
          customer_review: boolean;
          enabled: boolean;
          store_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          admin_payment_to_verify?: boolean;
          admin_phone?: string | null;
          admin_seafood_check?: boolean;
          customer_cancelled?: boolean;
          customer_out_for_delivery?: boolean;
          customer_payment_confirmed?: boolean;
          customer_payment_rejected?: boolean;
          customer_ready_pickup?: boolean;
          customer_review?: boolean;
          enabled?: boolean;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          admin_payment_to_verify?: boolean;
          admin_phone?: string | null;
          admin_seafood_check?: boolean;
          customer_cancelled?: boolean;
          customer_out_for_delivery?: boolean;
          customer_payment_confirmed?: boolean;
          customer_payment_rejected?: boolean;
          customer_ready_pickup?: boolean;
          customer_review?: boolean;
          enabled?: boolean;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_push_tokens: {
        Row: {
          created_at: string;
          token: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          token: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          token?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      staff_users: {
        Row: {
          active: boolean;
          created_at: string;
          display_name: string;
          role: Database["ops"]["Enums"]["staff_role"];
          store_id: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          display_name: string;
          role: Database["ops"]["Enums"]["staff_role"];
          store_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          display_name?: string;
          role?: Database["ops"]["Enums"]["staff_role"];
          store_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      staff_web_push: {
        Row: {
          auth: string;
          created_at: string;
          endpoint: string;
          p256dh: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          endpoint: string;
          p256dh: string;
          user_id: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          endpoint?: string;
          p256dh?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          actor: string | null;
          created_at: string;
          delta: number;
          id: number;
          order_id: string | null;
          reason: Database["ops"]["Enums"]["stock_reason"];
          sku: string;
        };
        ComputedFields: never;
        Insert: {
          actor?: string | null;
          created_at?: string;
          delta: number;
          id?: never;
          order_id?: string | null;
          reason: Database["ops"]["Enums"]["stock_reason"];
          sku: string;
        };
        Update: {
          actor?: string | null;
          created_at?: string;
          delta?: number;
          id?: never;
          order_id?: string | null;
          reason?: Database["ops"]["Enums"]["stock_reason"];
          sku?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      super_admins: {
        Row: {
          created_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      webhook_inbox: {
        Row: {
          error: string | null;
          event_id: string;
          event_type: string;
          payload: NonNullable<Json>;
          processed_at: string | null;
          received_at: string;
        };
        ComputedFields: never;
        Insert: {
          error?: string | null;
          event_id: string;
          event_type: string;
          payload: NonNullable<Json>;
          processed_at?: string | null;
          received_at?: string;
        };
        Update: {
          error?: string | null;
          event_id?: string;
          event_type?: string;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
          received_at?: string;
        };
        Relationships: [];
      };
      webhook_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          event_id: string;
          event_type: string;
          id: number;
          last_error: string | null;
          next_attempt_at: string;
          payload: NonNullable<Json>;
          sent_at: string | null;
          status: Database["ops"]["Enums"]["webhook_status"];
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          event_id: string;
          event_type: string;
          id?: never;
          last_error?: string | null;
          next_attempt_at?: string;
          payload: NonNullable<Json>;
          sent_at?: string | null;
          status?: Database["ops"]["Enums"]["webhook_status"];
        };
        Update: {
          attempts?: number;
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: never;
          last_error?: string | null;
          next_attempt_at?: string;
          payload?: NonNullable<Json>;
          sent_at?: string | null;
          status?: Database["ops"]["Enums"]["webhook_status"];
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_availability_check: {
        Args: { p_decision_minutes?: number; p_order_id: string };
        Returns: Database["ops"]["Enums"]["order_status"];
      };
      enqueue_web_event: { Args: { p_event: string; p_payload: Json }; Returns: undefined };
      has_store_role: {
        Args: { p_store: string; roles: Database["ops"]["Enums"]["staff_role"][] };
        Returns: boolean;
      };
      ingredient_store: { Args: { p_key: string }; Returns: string };
      is_any_staff: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_store_staff: { Args: { p_store: string }; Returns: boolean };
      is_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      next_queue_code: { Args: { p_date: string; p_store: string }; Returns: string };
      review_payment: {
        Args: {
          p_amount_received?: number;
          p_decision: Database["ops"]["Enums"]["payment_decision"];
          p_order_id: string;
          p_reason?: string;
        };
        Returns: undefined;
      };
      run_timers: { Args: { p_unpaid_flag_minutes?: number }; Returns: undefined };
      sku_store: { Args: { p_sku: string }; Returns: string };
      store_role: { Args: { p_store: string }; Returns: Database["ops"]["Enums"]["staff_role"] };
    };
    Enums: {
      customer_decision: "continue" | "cancel" | "expired";
      daily_status: "available" | "out" | "unknown";
      distance_method: "road" | "straight_line";
      fee_source: "formula" | "barangay_override" | "free_threshold" | "manual";
      fulfillment: "pickup" | "delivery";
      item_availability: "pending" | "ready_to_cook" | "cant_source";
      item_status: "pending" | "queued" | "ready" | "handed_over" | "removed";
      label_kind: "item" | "delivery_slip";
      order_source: "web" | "walk_in" | "phone" | "messenger";
      order_status:
        | "received"
        | "awaiting_availability"
        | "awaiting_customer"
        | "pending_payment"
        | "queued"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "picked_up"
        | "completed"
        | "denied"
        | "rejected"
        | "cancelled"
        | "expired";
      payment_decision: "confirmed" | "partial" | "rejected";
      payment_method: "gcash" | "cash";
      payment_status:
        "not_requested" | "awaiting_payment" | "submitted" | "partial" | "confirmed" | "rejected";
      price_mode: "fixed" | "market";
      printer_connection: "lan" | "bluetooth" | "usb";
      printer_language: "escpos" | "tspl" | "zpl";
      staff_role: "owner" | "verifier" | "kitchen" | "counter" | "rider";
      stock_reason: "sale" | "restock" | "correction" | "cancel_return";
      webhook_status: "pending" | "sent" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  store: {
    Tables: {
      barangays: {
        Row: {
          active: boolean;
          center_lat: number | null;
          center_lng: number | null;
          created_at: string;
          fee_override: number | null;
          id: string;
          is_island: boolean;
          name: string;
          notes: string | null;
          sort_order: number;
          store_id: string;
          surcharge: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          fee_override?: number | null;
          id?: string;
          is_island?: boolean;
          name: string;
          notes?: string | null;
          sort_order?: number;
          store_id: string;
          surcharge?: number | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          center_lat?: number | null;
          center_lng?: number | null;
          created_at?: string;
          fee_override?: number | null;
          id?: string;
          is_island?: boolean;
          name?: string;
          notes?: string | null;
          sort_order?: number;
          store_id?: string;
          surcharge?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "barangays_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          active: boolean;
          created_at: string;
          id: string;
          name: string;
          sort_order: number;
          store_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name: string;
          sort_order?: number;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      customer_addresses: {
        Row: {
          barangay_id: string;
          created_at: string;
          customer_id: string;
          id: string;
          is_default: boolean;
          label: string;
          landmark: string;
          lat: number;
          lng: number;
          rider_notes: string;
          street_purok: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          barangay_id: string;
          created_at?: string;
          customer_id: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          landmark?: string;
          lat: number;
          lng: number;
          rider_notes?: string;
          street_purok?: string;
          updated_at?: string;
        };
        Update: {
          barangay_id?: string;
          created_at?: string;
          customer_id?: string;
          id?: string;
          is_default?: boolean;
          label?: string;
          landmark?: string;
          lat?: number;
          lng?: number;
          rider_notes?: string;
          street_purok?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "customer_addresses_barangay_id_fkey";
            columns: ["barangay_id"];
            isOneToOne: false;
            referencedRelation: "barangays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
        ];
      };
      customers: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          facebook_id: string | null;
          id: string;
          is_registered: boolean;
          merged_into_customer_id: string | null;
          name: string;
          phone: string | null;
          phone_verified: boolean;
          privacy_consent_at: string | null;
          store_id: string;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          facebook_id?: string | null;
          id?: string;
          is_registered?: boolean;
          merged_into_customer_id?: string | null;
          name: string;
          phone?: string | null;
          phone_verified?: boolean;
          privacy_consent_at?: string | null;
          store_id: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          facebook_id?: string | null;
          id?: string;
          is_registered?: boolean;
          merged_into_customer_id?: string | null;
          name?: string;
          phone?: string | null;
          phone_verified?: boolean;
          privacy_consent_at?: string | null;
          store_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "customers_merged_into_customer_id_fkey";
            columns: ["merged_into_customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "customers_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      delivery_settings: {
        Row: {
          area_name: string | null;
          base_fee: number;
          delivery_enabled: boolean;
          excluded_areas_geojson: Json | null;
          free_delivery_threshold: number | null;
          included_km: number;
          kitchen_address: string | null;
          kitchen_lat: number | null;
          kitchen_lng: number | null;
          max_km: number;
          min_fee: number;
          per_km: number;
          rider_min_pay: number;
          rider_share_percent: number;
          round_to: number;
          service_area_geojson: Json | null;
          store_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          area_name?: string | null;
          base_fee?: number;
          delivery_enabled?: boolean;
          excluded_areas_geojson?: Json | null;
          free_delivery_threshold?: number | null;
          included_km?: number;
          kitchen_address?: string | null;
          kitchen_lat?: number | null;
          kitchen_lng?: number | null;
          max_km?: number;
          min_fee?: number;
          per_km?: number;
          rider_min_pay?: number;
          rider_share_percent?: number;
          round_to?: number;
          service_area_geojson?: Json | null;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          area_name?: string | null;
          base_fee?: number;
          delivery_enabled?: boolean;
          excluded_areas_geojson?: Json | null;
          free_delivery_threshold?: number | null;
          included_km?: number;
          kitchen_address?: string | null;
          kitchen_lat?: number | null;
          kitchen_lng?: number | null;
          max_km?: number;
          min_fee?: number;
          per_km?: number;
          rider_min_pay?: number;
          rider_share_percent?: number;
          round_to?: number;
          service_area_geojson?: Json | null;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "delivery_settings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredient_availability: {
        Row: {
          date: string;
          ingredient_id: string;
          market_price: number | null;
          qty_available: number | null;
          status: Database["store"]["Enums"]["daily_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          date: string;
          ingredient_id: string;
          market_price?: number | null;
          qty_available?: number | null;
          status?: Database["store"]["Enums"]["daily_status"];
          updated_at?: string;
        };
        Update: {
          date?: string;
          ingredient_id?: string;
          market_price?: number | null;
          qty_available?: number | null;
          status?: Database["store"]["Enums"]["daily_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_availability_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
      ingredients: {
        Row: {
          availability_mode: Database["store"]["Enums"]["availability_mode"];
          created_at: string;
          default_wait_minutes: number | null;
          id: string;
          key: string;
          name: string;
          store_id: string;
          unit: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          availability_mode?: Database["store"]["Enums"]["availability_mode"];
          created_at?: string;
          default_wait_minutes?: number | null;
          id?: string;
          key: string;
          name: string;
          store_id: string;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          availability_mode?: Database["store"]["Enums"]["availability_mode"];
          created_at?: string;
          default_wait_minutes?: number | null;
          id?: string;
          key?: string;
          name?: string;
          store_id?: string;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ingredients_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      modifier_groups: {
        Row: {
          created_at: string;
          id: string;
          max_select: number;
          min_select: number;
          name: string;
          required: boolean;
          sort_order: number;
          store_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          max_select?: number;
          min_select?: number;
          name: string;
          required?: boolean;
          sort_order?: number;
          store_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          max_select?: number;
          min_select?: number;
          name?: string;
          required?: boolean;
          sort_order?: number;
          store_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "modifier_groups_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      modifiers: {
        Row: {
          active: boolean;
          created_at: string;
          group_id: string;
          id: string;
          name: string;
          price_delta: number | null;
          requires_cooking: boolean;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          created_at?: string;
          group_id: string;
          id?: string;
          name: string;
          price_delta?: number | null;
          requires_cooking?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          created_at?: string;
          group_id?: string;
          id?: string;
          name?: string;
          price_delta?: number | null;
          requires_cooking?: boolean;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "modifiers_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "modifier_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      product_ingredients: {
        Row: {
          ingredient_id: string;
          is_key: boolean;
          product_id: string;
        };
        ComputedFields: never;
        Insert: {
          ingredient_id: string;
          is_key?: boolean;
          product_id: string;
        };
        Update: {
          ingredient_id?: string;
          is_key?: boolean;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_ingredients_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_ingredients_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_modifier_groups: {
        Row: {
          group_id: string;
          product_id: string;
          show_when_modifier_id: string | null;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          group_id: string;
          product_id: string;
          show_when_modifier_id?: string | null;
          sort_order?: number;
        };
        Update: {
          group_id?: string;
          product_id?: string;
          show_when_modifier_id?: string | null;
          sort_order?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_modifier_groups_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "modifier_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_modifier_groups_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_modifier_groups_show_when_modifier_id_fkey";
            columns: ["show_when_modifier_id"];
            isOneToOne: false;
            referencedRelation: "modifiers";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          active: boolean;
          category_id: string;
          created_at: string;
          daily_limit: number | null;
          description: string | null;
          estimated_price: number | null;
          id: string;
          image_url: string | null;
          name: string;
          note_prompt: string | null;
          notice_days: number | null;
          prep_minutes: number | null;
          price: number | null;
          price_mode: Database["store"]["Enums"]["price_mode"];
          sku: string;
          sold_by: Database["store"]["Enums"]["sold_by"];
          sold_out: boolean;
          sort_order: number;
          stock_qty: number | null;
          stock_tracked: boolean;
          store_id: string;
          type: Database["store"]["Enums"]["product_type"];
          updated_at: string;
          weight_options_kg: number[];
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          category_id: string;
          created_at?: string;
          daily_limit?: number | null;
          description?: string | null;
          estimated_price?: number | null;
          id?: string;
          image_url?: string | null;
          name: string;
          note_prompt?: string | null;
          notice_days?: number | null;
          prep_minutes?: number | null;
          price?: number | null;
          price_mode?: Database["store"]["Enums"]["price_mode"];
          sku: string;
          sold_by?: Database["store"]["Enums"]["sold_by"];
          sold_out?: boolean;
          sort_order?: number;
          stock_qty?: number | null;
          stock_tracked?: boolean;
          store_id: string;
          type: Database["store"]["Enums"]["product_type"];
          updated_at?: string;
          weight_options_kg?: number[];
        };
        Update: {
          active?: boolean;
          category_id?: string;
          created_at?: string;
          daily_limit?: number | null;
          description?: string | null;
          estimated_price?: number | null;
          id?: string;
          image_url?: string | null;
          name?: string;
          note_prompt?: string | null;
          notice_days?: number | null;
          prep_minutes?: number | null;
          price?: number | null;
          price_mode?: Database["store"]["Enums"]["price_mode"];
          sku?: string;
          sold_by?: Database["store"]["Enums"]["sold_by"];
          sold_out?: boolean;
          sort_order?: number;
          stock_qty?: number | null;
          stock_tracked?: boolean;
          store_id?: string;
          type?: Database["store"]["Enums"]["product_type"];
          updated_at?: string;
          weight_options_kg?: number[];
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      promotion_redemptions: {
        Row: {
          amount: number;
          created_at: string;
          customer_id: string;
          id: string;
          promotion_id: string;
          web_order_id: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          customer_id: string;
          id?: string;
          promotion_id: string;
          web_order_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          customer_id?: string;
          id?: string;
          promotion_id?: string;
          web_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "promotion_redemptions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_promotion_id_fkey";
            columns: ["promotion_id"];
            isOneToOne: false;
            referencedRelation: "promotions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "promotion_redemptions_web_order_id_fkey";
            columns: ["web_order_id"];
            isOneToOne: false;
            referencedRelation: "web_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      promotions: {
        Row: {
          active: boolean;
          code: string | null;
          created_at: string;
          ends_at: string | null;
          id: string;
          max_discount: number | null;
          min_order: number | null;
          name: string;
          per_customer_limit: number;
          starts_at: string | null;
          store_id: string;
          trigger: Database["store"]["Enums"]["promotion_trigger"];
          type: Database["store"]["Enums"]["promotion_type"];
          updated_at: string;
          valid_days: number | null;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          active?: boolean;
          code?: string | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          max_discount?: number | null;
          min_order?: number | null;
          name: string;
          per_customer_limit?: number;
          starts_at?: string | null;
          store_id: string;
          trigger: Database["store"]["Enums"]["promotion_trigger"];
          type: Database["store"]["Enums"]["promotion_type"];
          updated_at?: string;
          valid_days?: number | null;
          value: number;
        };
        Update: {
          active?: boolean;
          code?: string | null;
          created_at?: string;
          ends_at?: string | null;
          id?: string;
          max_discount?: number | null;
          min_order?: number | null;
          name?: string;
          per_customer_limit?: number;
          starts_at?: string | null;
          store_id?: string;
          trigger?: Database["store"]["Enums"]["promotion_trigger"];
          type?: Database["store"]["Enums"]["promotion_type"];
          updated_at?: string;
          valid_days?: number | null;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "promotions_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          customer_id: string | null;
          endpoint: string;
          id: string;
          p256dh: string;
          web_order_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          customer_id?: string | null;
          endpoint: string;
          id?: string;
          p256dh: string;
          web_order_id?: string | null;
        };
        Update: {
          auth?: string;
          created_at?: string;
          customer_id?: string | null;
          endpoint?: string;
          id?: string;
          p256dh?: string;
          web_order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "push_subscriptions_web_order_id_fkey";
            columns: ["web_order_id"];
            isOneToOne: false;
            referencedRelation: "web_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      store_closures: {
        Row: {
          date: string;
          reason: string | null;
          store_id: string;
        };
        ComputedFields: never;
        Insert: {
          date: string;
          reason?: string | null;
          store_id: string;
        };
        Update: {
          date?: string;
          reason?: string | null;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_closures_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_hours: {
        Row: {
          closes_at: string;
          day_of_week: number;
          is_open: boolean;
          opens_at: string;
          store_id: string;
        };
        ComputedFields: never;
        Insert: {
          closes_at: string;
          day_of_week: number;
          is_open?: boolean;
          opens_at: string;
          store_id: string;
        };
        Update: {
          closes_at?: string;
          day_of_week?: number;
          is_open?: boolean;
          opens_at?: string;
          store_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_hours_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      store_settings: {
        Row: {
          allow_preorders: boolean;
          customer_decision_minutes: number;
          delivery_buffer_minutes: number;
          gcash_account_name: string | null;
          gcash_qr_url: string | null;
          notice_days: number;
          ordering_paused: boolean;
          pickup_instructions: string | null;
          prep_lead_minutes: number;
          print_label_height_mm: number;
          print_label_width_mm: number;
          print_labels_per_unit: boolean;
          print_ticket_width_mm: number;
          slot_end_offset_minutes: number;
          slot_start_offset_minutes: number;
          store_id: string;
          uncertain_items_cutoff: string;
          unpaid_flag_minutes: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          allow_preorders?: boolean;
          customer_decision_minutes?: number;
          delivery_buffer_minutes?: number;
          gcash_account_name?: string | null;
          gcash_qr_url?: string | null;
          notice_days?: number;
          ordering_paused?: boolean;
          pickup_instructions?: string | null;
          prep_lead_minutes?: number;
          print_label_height_mm?: number;
          print_label_width_mm?: number;
          print_labels_per_unit?: boolean;
          print_ticket_width_mm?: number;
          slot_end_offset_minutes?: number;
          slot_start_offset_minutes?: number;
          store_id: string;
          uncertain_items_cutoff?: string;
          unpaid_flag_minutes?: number;
          updated_at?: string;
        };
        Update: {
          allow_preorders?: boolean;
          customer_decision_minutes?: number;
          delivery_buffer_minutes?: number;
          gcash_account_name?: string | null;
          gcash_qr_url?: string | null;
          notice_days?: number;
          ordering_paused?: boolean;
          pickup_instructions?: string | null;
          prep_lead_minutes?: number;
          print_label_height_mm?: number;
          print_label_width_mm?: number;
          print_labels_per_unit?: boolean;
          print_ticket_width_mm?: number;
          slot_end_offset_minutes?: number;
          slot_start_offset_minutes?: number;
          store_id?: string;
          uncertain_items_cutoff?: string;
          unpaid_flag_minutes?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "store_settings_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: true;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      stores: {
        Row: {
          accent_color: string;
          active: boolean;
          contact: string | null;
          created_at: string;
          facebook_url: string | null;
          id: string;
          logo_url: string | null;
          name: string;
          slug: string;
          sort_order: number;
          tagline: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          accent_color?: string;
          active?: boolean;
          contact?: string | null;
          created_at?: string;
          facebook_url?: string | null;
          id?: string;
          logo_url?: string | null;
          name: string;
          slug: string;
          sort_order?: number;
          tagline?: string | null;
          updated_at?: string;
        };
        Update: {
          accent_color?: string;
          active?: boolean;
          contact?: string | null;
          created_at?: string;
          facebook_url?: string | null;
          id?: string;
          logo_url?: string | null;
          name?: string;
          slug?: string;
          sort_order?: number;
          tagline?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      web_orders: {
        Row: {
          access_token: string;
          availability_result: Json | null;
          created_at: string;
          customer_decision: Database["store"]["Enums"]["customer_decision"] | null;
          customer_id: string | null;
          delivery_fee: number;
          discount_amount: number;
          fulfillment: Database["store"]["Enums"]["fulfillment"];
          id: string;
          is_estimate: boolean;
          order: NonNullable<Json>;
          order_code: string;
          payment_status: Database["store"]["Enums"]["payment_status"];
          payment_submission: Json | null;
          rider_name: string | null;
          scheduled_for: string;
          status: Database["store"]["Enums"]["order_status"];
          status_note: string | null;
          store_id: string;
          subtotal: number;
          total: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          access_token?: string;
          availability_result?: Json | null;
          created_at?: string;
          customer_decision?: Database["store"]["Enums"]["customer_decision"] | null;
          customer_id?: string | null;
          delivery_fee?: number;
          discount_amount?: number;
          fulfillment: Database["store"]["Enums"]["fulfillment"];
          id?: string;
          is_estimate?: boolean;
          order: NonNullable<Json>;
          order_code?: string;
          payment_status?: Database["store"]["Enums"]["payment_status"];
          payment_submission?: Json | null;
          rider_name?: string | null;
          scheduled_for: string;
          status?: Database["store"]["Enums"]["order_status"];
          status_note?: string | null;
          store_id: string;
          subtotal: number;
          total: number;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          availability_result?: Json | null;
          created_at?: string;
          customer_decision?: Database["store"]["Enums"]["customer_decision"] | null;
          customer_id?: string | null;
          delivery_fee?: number;
          discount_amount?: number;
          fulfillment?: Database["store"]["Enums"]["fulfillment"];
          id?: string;
          is_estimate?: boolean;
          order?: NonNullable<Json>;
          order_code?: string;
          payment_status?: Database["store"]["Enums"]["payment_status"];
          payment_submission?: Json | null;
          rider_name?: string | null;
          scheduled_for?: string;
          status?: Database["store"]["Enums"]["order_status"];
          status_note?: string | null;
          store_id?: string;
          subtotal?: number;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "web_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "customers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "web_orders_store_id_fkey";
            columns: ["store_id"];
            isOneToOne: false;
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      webhook_inbox: {
        Row: {
          error: string | null;
          event_id: string;
          event_type: string;
          payload: NonNullable<Json>;
          processed_at: string | null;
          received_at: string;
        };
        ComputedFields: never;
        Insert: {
          error?: string | null;
          event_id: string;
          event_type: string;
          payload: NonNullable<Json>;
          processed_at?: string | null;
          received_at?: string;
        };
        Update: {
          error?: string | null;
          event_id?: string;
          event_type?: string;
          payload?: NonNullable<Json>;
          processed_at?: string | null;
          received_at?: string;
        };
        Relationships: [];
      };
      webhook_outbox: {
        Row: {
          attempts: number;
          created_at: string;
          event_id: string;
          event_type: string;
          id: number;
          last_error: string | null;
          next_attempt_at: string;
          payload: NonNullable<Json>;
          sent_at: string | null;
          status: Database["store"]["Enums"]["webhook_status"];
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          created_at?: string;
          event_id: string;
          event_type: string;
          id?: never;
          last_error?: string | null;
          next_attempt_at?: string;
          payload: NonNullable<Json>;
          sent_at?: string | null;
          status?: Database["store"]["Enums"]["webhook_status"];
        };
        Update: {
          attempts?: number;
          created_at?: string;
          event_id?: string;
          event_type?: string;
          id?: never;
          last_error?: string | null;
          next_attempt_at?: string;
          payload?: NonNullable<Json>;
          sent_at?: string | null;
          status?: Database["store"]["Enums"]["webhook_status"];
        };
        Relationships: [];
      };
    };
    Views: {
      ingredient_availability_today: {
        Row: {
          ingredient_id: string;
          market_price: number | null;
          qty_available: number | null;
          status: Database["store"]["Enums"]["daily_status"];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          ingredient_id?: string | null;
          market_price?: number | null;
          qty_available?: number | null;
          status?: Database["store"]["Enums"]["daily_status"] | null;
          updated_at?: string | null;
        };
        Update: {
          ingredient_id?: string | null;
          market_price?: number | null;
          qty_available?: number | null;
          status?: Database["store"]["Enums"]["daily_status"] | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "ingredient_availability_ingredient_id_fkey";
            columns: ["ingredient_id"];
            isOneToOne: false;
            referencedRelation: "ingredients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      booked_qty: {
        Args: { p_from: string; p_store: string; p_to: string };
        Returns: {
          day: string;
          qty: number;
          sku: string;
        }[];
      };
    };
    Enums: {
      availability_mode: "always" | "subject_to_availability";
      customer_decision: "continue" | "cancel" | "expired";
      daily_status: "available" | "out" | "unknown";
      fulfillment: "pickup" | "delivery";
      order_status:
        | "received"
        | "awaiting_availability"
        | "awaiting_customer"
        | "pending_payment"
        | "queued"
        | "preparing"
        | "ready"
        | "out_for_delivery"
        | "delivered"
        | "picked_up"
        | "completed"
        | "denied"
        | "rejected"
        | "cancelled"
        | "expired";
      payment_method: "gcash" | "cash";
      payment_status:
        "not_requested" | "awaiting_payment" | "submitted" | "partial" | "confirmed" | "rejected";
      price_mode: "fixed" | "market";
      product_type: "made_to_order" | "ready_made" | "frozen" | "bundle";
      promotion_trigger: "welcome" | "code" | "auto";
      promotion_type: "fixed" | "percent";
      sold_by: "unit" | "weight";
      webhook_status: "pending" | "sent" | "failed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "ops">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  ops: {
    Enums: {
      customer_decision: ["continue", "cancel", "expired"],
      daily_status: ["available", "out", "unknown"],
      distance_method: ["road", "straight_line"],
      fee_source: ["formula", "barangay_override", "free_threshold", "manual"],
      fulfillment: ["pickup", "delivery"],
      item_availability: ["pending", "ready_to_cook", "cant_source"],
      item_status: ["pending", "queued", "ready", "handed_over", "removed"],
      label_kind: ["item", "delivery_slip"],
      order_source: ["web", "walk_in", "phone", "messenger"],
      order_status: [
        "received",
        "awaiting_availability",
        "awaiting_customer",
        "pending_payment",
        "queued",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "picked_up",
        "completed",
        "denied",
        "rejected",
        "cancelled",
        "expired",
      ],
      payment_decision: ["confirmed", "partial", "rejected"],
      payment_method: ["gcash", "cash"],
      payment_status: [
        "not_requested",
        "awaiting_payment",
        "submitted",
        "partial",
        "confirmed",
        "rejected",
      ],
      price_mode: ["fixed", "market"],
      printer_connection: ["lan", "bluetooth", "usb"],
      printer_language: ["escpos", "tspl", "zpl"],
      staff_role: ["owner", "verifier", "kitchen", "counter", "rider"],
      stock_reason: ["sale", "restock", "correction", "cancel_return"],
      webhook_status: ["pending", "sent", "failed"],
    },
  },
  store: {
    Enums: {
      availability_mode: ["always", "subject_to_availability"],
      customer_decision: ["continue", "cancel", "expired"],
      daily_status: ["available", "out", "unknown"],
      fulfillment: ["pickup", "delivery"],
      order_status: [
        "received",
        "awaiting_availability",
        "awaiting_customer",
        "pending_payment",
        "queued",
        "preparing",
        "ready",
        "out_for_delivery",
        "delivered",
        "picked_up",
        "completed",
        "denied",
        "rejected",
        "cancelled",
        "expired",
      ],
      payment_method: ["gcash", "cash"],
      payment_status: [
        "not_requested",
        "awaiting_payment",
        "submitted",
        "partial",
        "confirmed",
        "rejected",
      ],
      price_mode: ["fixed", "market"],
      product_type: ["made_to_order", "ready_made", "frozen", "bundle"],
      promotion_trigger: ["welcome", "code", "auto"],
      promotion_type: ["fixed", "percent"],
      sold_by: ["unit", "weight"],
      webhook_status: ["pending", "sent", "failed"],
    },
  },
} as const;
