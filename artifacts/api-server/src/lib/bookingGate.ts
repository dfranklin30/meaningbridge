import { healthieGraphQL } from "./healthie";

/**
 * Booking gate: a seeker may not book a first session until the required intake
 * and consent forms are signed. Signed forms live in Healthie (as completed
 * CustomModuleForms / FormAnswerGroups), so this checks Healthie — never our own
 * database — for completion.
 *
 * The set of gating forms is configured out of band via HEALTHIE_REQUIRED_FORM_IDS
 * (comma-separated Healthie CustomModuleForm ids). Until it is set AND the seeker
 * has completed them, booking is denied — deny-by-default is the safe posture for
 * a clinical gate.
 */

function requiredFormIds(): string[] {
  return (process.env.HEALTHIE_REQUIRED_FORM_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// Completed forms for a client. `finished: true` restricts to signed/submitted
// answer groups. NOTE: field names follow Healthie's documented schema; verify
// against the sandbox once HEALTHIE_API_KEY is provided.
const COMPLETED_FORMS = `
  query completedForms($clientId: ID) {
    formAnswerGroups(user_id: $clientId, finished: true) {
      id
      custom_module_form {
        id
      }
    }
  }
`;

interface CompletedFormsResult {
  formAnswerGroups: Array<{
    custom_module_form: { id: string } | null;
  }> | null;
}

export interface BookingEligibility {
  allowed: boolean;
  /** Configured form ids the seeker has not yet completed. */
  missingFormIds: string[];
}

export async function checkBookingEligibility(
  healthieUserId: string,
): Promise<BookingEligibility> {
  const required = requiredFormIds();
  if (required.length === 0) {
    // No gating forms configured yet → nothing can have been signed → deny.
    return { allowed: false, missingFormIds: [] };
  }

  const data = await healthieGraphQL<CompletedFormsResult>(COMPLETED_FORMS, {
    clientId: healthieUserId,
  });

  const signed = new Set(
    (data.formAnswerGroups ?? [])
      .map((g) => g.custom_module_form?.id)
      .filter((id): id is string => !!id),
  );
  const missingFormIds = required.filter((id) => !signed.has(id));
  return { allowed: missingFormIds.length === 0, missingFormIds };
}
