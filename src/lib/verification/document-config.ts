export type VerificationType = "phone" | "identity" | "business" | "ownership";

export type VerificationDocumentConfig = {
  levelLabel: string;
  requiresUpload: boolean;
  uploadLabel: string;
  uploadHint: string;
  accept: string;
  maxFiles: number;
  maxMb: number;
};

export const VERIFICATION_DOCUMENT_CONFIG: Record<VerificationType, VerificationDocumentConfig> = {
  phone: {
    levelLabel: "Level 1: Phone Verification",
    requiresUpload: false,
    uploadLabel: "",
    uploadHint:
      "No document upload needed. Our team will verify the phone number saved on your profile.",
    accept: "",
    maxFiles: 0,
    maxMb: 0,
  },
  identity: {
    levelLabel: "Level 2: National ID Verification",
    requiresUpload: true,
    uploadLabel: "National ID photos",
    uploadHint: "Upload clear photos of your National ID — front and back if both sides apply.",
    accept: "image/jpeg,image/png,image/webp,image/heic,image/heif",
    maxFiles: 2,
    maxMb: 25,
  },
  business: {
    levelLabel: "Level 3: Business / Agency Verification",
    requiresUpload: true,
    uploadLabel: "Business or agency documents",
    uploadHint:
      "Upload business registration, agency license, CR12, or other official business proof.",
    accept: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf",
    maxFiles: 3,
    maxMb: 25,
  },
  ownership: {
    levelLabel: "Level 4: Land Ownership Verification",
    requiresUpload: true,
    uploadLabel: "Land ownership documents",
    uploadHint: "Upload title deed, lease, allotment letter, or other proof of ownership.",
    accept: "image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf",
    maxFiles: 3,
    maxMb: 25,
  },
};

export function verificationStoragePath(
  userId: string,
  verificationType: VerificationType,
  fileName: string,
): string {
  const ext = fileName.split(".").pop()?.toLowerCase() || "jpg";
  return `${userId}/${verificationType}/${crypto.randomUUID()}.${ext}`;
}
