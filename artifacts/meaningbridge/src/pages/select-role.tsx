import { useState } from "react";
import { Redirect, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Loader2, HeartHandshake, Users } from "lucide-react";
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
  const [choosing, setChoosing] = useState<Role | null>(null);

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (me?.role === "professional") {
    return <Redirect to="/caregiver" />;
  }
  if (me?.role === "seeker") {
    return <Redirect to="/app" />;
  }

  const choose = (role: Role) => {
    if (updateMe.isPending) return;
    setChoosing(role);
    updateMe.mutate(
      { data: { role } },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({
            queryKey: getGetMeQueryKey(),
          });
          setLocation(role === "professional" ? "/caregiver" : "/app");
        },
        onError: () => {
          setChoosing(null);
        },
      },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center px-4 py-16 font-sans text-foreground">
      <motion.div {...fadeIn} className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center mb-10">
          <Logo variant="lockup" size={44} className="mb-8 opacity-90" />
          <h1 className="font-serif text-3xl tracking-tight mb-3">
            How will you be using MeaningBridge
          </h1>
          <p className="text-muted-foreground max-w-md">
            Choose the experience that fits you. You can reach out to us later if
            this changes.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => choose("seeker")}
            disabled={updateMe.isPending}
            className="group text-left rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/40 disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary mb-4">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <h2 className="font-serif text-xl mb-2">I am grieving</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A private space to remember someone you love, reflect through
              journaling, and find gentle support.
            </p>
            {choosing === "seeker" && updateMe.isPending && (
              <span className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Preparing your space
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => choose("professional")}
            disabled={updateMe.isPending}
            className="group text-left rounded-2xl border border-border bg-card p-6 transition-colors hover:border-primary/50 hover:bg-accent/40 disabled:opacity-60"
          >
            <div className="w-11 h-11 rounded-full bg-accent flex items-center justify-center text-primary mb-4">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="font-serif text-xl mb-2">I am a professional</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Support those in your care with a clinician portal designed around
              the work of grief and meaning.
            </p>
            {choosing === "professional" && updateMe.isPending && (
              <span className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Preparing your portal
              </span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
