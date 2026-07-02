import { useLocation } from "wouter";
import { useGetMe, useUpdateMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { HeartHandshake, Stethoscope, Loader2 } from "lucide-react";

type Space = "seeker" | "professional";

/**
 * Top-corner space switcher for accounts that can hold both roles. Rendered in
 * the seeker header (`current="seeker"`) and the clinician portal header
 * (`current="professional"`). If the account already has the other capability it
 * flips the active space; otherwise it grants the capability first, then opens
 * it. Capabilities are additive, so switching never removes the current one.
 */
export function PortalSwitcher({ current }: { current: Space }) {
  const { data: me } = useGetMe();
  const updateMe = useUpdateMe();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  if (!me) return null;

  const other: Space = current === "seeker" ? "professional" : "seeker";
  const hasOther = other === "seeker" ? me.isSeeker : me.isProfessional;

  const label =
    other === "professional"
      ? hasOther
        ? "Provider portal"
        : "Open provider portal"
      : hasOther
        ? "Grief space"
        : "Open a grief space";

  const Icon = other === "professional" ? Stethoscope : HeartHandshake;

  const switchTo = () => {
    if (updateMe.isPending) return;
    const roles = new Set<Space>();
    if (me.isSeeker) roles.add("seeker");
    if (me.isProfessional) roles.add("professional");
    roles.add(other);
    updateMe.mutate(
      { data: { roles: Array.from(roles), activeSpace: other } },
      {
        onSuccess: (updated) => {
          queryClient.setQueryData(getGetMeQueryKey(), updated);
          setLocation(other === "professional" ? "/care/account" : "/app");
        },
      },
    );
  };

  return (
    <button
      type="button"
      onClick={switchTo}
      disabled={updateMe.isPending}
      title={label}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors disabled:opacity-60"
    >
      {updateMe.isPending ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}
