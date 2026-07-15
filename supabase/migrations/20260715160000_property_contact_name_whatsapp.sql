-- Contact person name + WhatsApp inquiry channel for admin-uploaded listings
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS contact_name text;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS whatsapp_inquiries boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.properties.contact_name IS
  'Display name for listing contact (e.g. admin-uploaded listings)';
COMMENT ON COLUMN public.properties.whatsapp_inquiries IS
  'When true, tenant Message CTA opens WhatsApp to contact_phone instead of in-app inquiry';

-- Existing admin-owned listings with a contact phone should use WhatsApp inquiries
UPDATE public.properties p
SET whatsapp_inquiries = true
WHERE COALESCE(p.whatsapp_inquiries, false) = false
  AND p.contact_phone IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.owner_id
      AND ur.role = 'admin'
  );
