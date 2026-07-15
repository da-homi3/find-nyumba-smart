import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  CONSENT_UPDATED_EVENT,
  identifyFullStoryUser,
  syncFullStoryWithConsent,
} from "@/lib/fullstory";

/** Boots FullStory when analytics cookies are allowed; identifies signed-in users. */
export function FullStoryBootstrap() {
  const { user } = useAuth();

  useEffect(() => {
    syncFullStoryWithConsent();
    const onConsent = () => syncFullStoryWithConsent();
    window.addEventListener(CONSENT_UPDATED_EVENT, onConsent);
    return () => window.removeEventListener(CONSENT_UPDATED_EVENT, onConsent);
  }, []);

  useEffect(() => {
    identifyFullStoryUser(user?.id ?? null, user?.email ? { email: user.email } : undefined);
  }, [user?.id, user?.email]);

  return null;
}
