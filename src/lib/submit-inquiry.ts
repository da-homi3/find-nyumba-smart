import { submitPartnershipInquiry } from "@/lib/api/partnership.functions";
import { errorMessage } from "@/lib/utils";
import { toast } from "sonner";

type InquiryInput = Parameters<typeof submitPartnershipInquiry>[0]["data"];

export async function submitInquiry(
  data: InquiryInput,
  successMessage = "Request received — we'll contact you shortly.",
) {
  try {
    const res = await submitPartnershipInquiry({ data });
    if (!res.emailed && !res.stored) {
      throw new Error("Could not deliver your request. Please try again later.");
    }
    toast.success(successMessage);
    return true;
  } catch (err) {
    toast.error(errorMessage(err));
    return false;
  }
}
