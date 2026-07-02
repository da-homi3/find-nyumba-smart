export function whatsappApiVersion(): string {
  return process.env.WHATSAPP_API_VERSION ?? "v21.0";
}

export function whatsappPhoneId(): string | undefined {
  return process.env.WHATSAPP_PHONE_ID;
}

export function whatsappToken(): string | undefined {
  return process.env.WHATSAPP_TOKEN;
}

export function whatsappVerifyToken(): string | undefined {
  return process.env.WHATSAPP_VERIFY_TOKEN;
}

export function whatsappAppSecret(): string | undefined {
  return process.env.WHATSAPP_APP_SECRET;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(whatsappToken() && whatsappPhoneId());
}
