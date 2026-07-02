import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2, HeartHandshake, Users, Check } from "lucide-react";
import {
  useGetMe,
  useUpdateMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "@/components/logo";

type Role = "seeker" | "professional";

const fadeIn = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
};

export default function SelectRole() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: me, isLoading } = useGetMe();
  const updateMe = useUpdateMe();
  const [selected, setSelected] = useState<Set<Role>>(new Set());

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Already set up — send them into whichever space is active.
  if (me?.isSeeker || me?.isProfessional) {
    const target =
      me.activeSpace ?? (me.isProfessional && !me.isSeeker ? "professional" : "seeker");
    return <Redirect to={target === "professional" ? "/care/account" : "/app"} />;
  }

  const toggle = (role: Role) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(role)) next.delete(role);
      else next.add(role);
      return next;
    });
  };

  const proceed = () => {
    if (updateMe.isPending || selected.size === 0) return;
    const roles = Array.from(selected);
    // Default the active space to the grief experience when both are chosen.
    const activeSpace: Role = selected.has("seeker") ? "seeker" : "professional";
    updateMe.mutate(
      { data: { roles, activeSpace } },
      {
        onSuccess: async (updated) => {
          queryClient.setQueryData(getGetMeQueryKey(), updated);
          await queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          setLocation(activeSpace === "professional" ? "/care/account" : "/app");
        },
      },
    );
  };

  const cardCls = (role: Role) =>
    `group relative text-left rounded-2xl border p-6 transition-colors disabled:opacity-60 ${
      selected.has(role)
        ? "border-primary bg-accent/50"
        : "border-border bg-card hover:border-primary/50 hover:bg-accent/40"
    }`;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 py-16 font-sans text-foreground">
      <motion.div {...fadeIn} className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center mb-10">
          <Logo variant="lockup" size={44} className="mb-8 opacity-90" />
          <h1 className="font-serif text-3xl tracking-tight mb-3">
            How will you be using MeaningBridge
          </h1>
          <p className="text-muted-foreground max-w-md">
            Choose the experience that fits you. You can select both, and you can
            switch between them at any time.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => toggle("seeker")}
            disabled={updateMe.isPending}
            aria-pressed={selected.has("seeker")}
            className={cardCls("seeker")}
          >
            {selected.has("seeker") && (
              <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </span>
            )}
            <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary mb-4">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <h2 className="font-serif text-xl mb-2">I am grieving</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A private space to remember someone you love, reflect through
              journaling, and find gentle support.
            </p>
          </button>

          <button
            type="button"
            onClick={() => toggle("professional")}
            disabled={updateMe.isPending}
            aria-pressed={selected.has("professional")}
            className={cardCls("professional")}
          >
            {selected.has("professional") && (
              <span className="absolute top-4 right-4 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                <Check className="w-3.5 h-3.5" />
              </span>
            )}
            <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="font-serif text-xl mb-2">I am a professional</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Support those in your care with a clinician portal designed around
              the work of grief and meaning.
            </p>
          </button>
        </div>

        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={proceed}
            disabled={updateMe.isPending || selected.size === 0}
            className="inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground px-6 py-2.5 text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {updateMe.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            Continue
          </button>
        </div>
      </motion.div>
    </div>
  );
}
