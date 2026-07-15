-- WhatsApp bot: sessions, message log, link events, OTP tokens

CREATE TABLE IF NOT EXISTS whatsapp_sessions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  wa_phone TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  role TEXT NOT NULL DEFAULT 'unknown' CHECK (role IN ('unknown', 'tenant', 'landlord', 'agent', 'provider')),
  state TEXT NOT NULL DEFAULT 'start',
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON whatsapp_sessions(wa_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_user ON whatsapp_sessions(user_id);

CREATE TABLE IF NOT EXISTS whatsapp_message_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  wa_phone TEXT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type TEXT NOT NULL DEFAULT 'text',
  body TEXT,
  wa_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_log_phone ON whatsapp_message_log(wa_phone);
CREATE INDEX IF NOT EXISTS idx_whatsapp_log_wa_id ON whatsapp_message_log(wa_message_id);

CREATE TABLE IF NOT EXISTS whatsapp_link_events (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  wa_phone TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_link_phone ON whatsapp_link_events(wa_phone);

CREATE TABLE IF NOT EXISTS whatsapp_otp (
  wa_phone TEXT PRIMARY KEY,
  otp TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at TIMESTAMPTZ NOT NULL
);

-- Dedupe proactive WhatsApp reminders (viewing tomorrow, etc.)
CREATE TABLE IF NOT EXISTS whatsapp_reminder_log (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  reminder_type TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  wa_phone TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (reminder_type, reference_id)
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_reminder_ref ON whatsapp_reminder_log(reference_id);

-- Service role only (bot runs server-side)
ALTER TABLE whatsapp_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_message_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_link_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_otp ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_reminder_log ENABLE ROW LEVEL SECURITY;
