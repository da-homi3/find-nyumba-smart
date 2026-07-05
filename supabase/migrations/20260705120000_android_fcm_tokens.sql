-- FCM push tokens for NyumbaSearch Android app (inactive until server sending is enabled)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS fcm_token_updated_at TIMESTAMPTZ;
