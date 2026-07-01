import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListChatSessions,
  useCreateChatSession,
  getListChatSessionsQueryKey,
  useListDeceasedProfiles,
  useListDeceasedPhotos,
  getListDeceasedPhotosQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Anchor, Plus, ArrowLeft, Check, User } from "lucide-react";
import { format } from "date-fns";

type DeceasedProfile = { id: number; name: string; relationship: string };

const CONVERSATION_TYPES: { id: string; label: string; desc: string }[] = [
  { id: "open", label: "An open conversation", desc: "Follow wherever your thoughts lead today." },
  { id: "final", label: "Something left unsaid", desc: "Say what you did not get the chance to say." },
  { id: "gratitude", label: "Remembering with gratitude", desc: "Hold what you were grateful for in them." },
  { id: "forgiveness", label: "Forgiveness", desc: "Approach what is hard to let rest, at your own pace." },
  { id: "unfinished", label: "Unfinished business", desc: "Name what still feels left undone." },
  { id: "legacy", label: "Their legacy in you", desc: "Notice what of them you carry forward." },
  { id: "meaning", label: "Making meaning", desc: "Reflect on the meaning of the life you shared." },
];

function LovedOneCard({
  person,
  selected,
  onSelect,
}: {
  person: DeceasedProfile;
  selected: boolean;
  onSelect: () => void;
}) {
  const { data: photos } = useListDeceasedPhotos(person.id, {
    query: { queryKey: getListDeceasedPhotosQueryKey(person.id) },
  });
  const photo = photos?.[0];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex items-center gap-3 text-left rounded-lg border p-3 transition-colors ${
        selected ? "border-primary/40 bg-primary/5" : "border-border hover:bg-secondary/30"
      }`}
    >
      <div className="w-11 h-11 rounded-full overflow-hidden bg-secondary flex items-center justify-center text-muted-foreground shrink-0">
        {photo ? (
          <img
            src={`${import.meta.env.BASE_URL}api/storage${photo.objectPath}`}
            alt={person.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <User className="w-5 h-5" />
        )}
      </div>
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{person.name}</div>
        <div className="text-xs text-muted-foreground truncate">{person.relationship}</div>
      </div>
      {selected && <Check className="w-4 h-4 text-primary ml-auto shrink-0" />}
    </button>
  );
}

export default function CompanionList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: sessions } = useListChatSessions();
  const { data: deceasedList } = useListDeceasedProfiles();
  const { mutateAsync: createSession } = useCreateChatSession();
  const [isCreating, setIsCreating] = useState(false);

  const [cbOpen, setCbOpen] = useState(false);
  const [selectedDeceasedId, setSelectedDeceasedId] = useState<number | null>(null);
  const [conversationType, setConversationType] = useState<string>("open");

  const openContinuingBonds = () => {
    setSelectedDeceasedId(deceasedList?.[0]?.id ?? null);
    setConversationType("open");
    setCbOpen(true);
  };

  const startSession = async (
    mode: string,
    opts?: { deceasedId?: number | null; conversationType?: string | null },
  ) => {
    setIsCreating(true);
    try {
      const session = await createSession({
        data: {
          mode,
          title: `Session - ${format(new Date(), "MMM d, yyyy")}`,
          deceasedId: opts?.deceasedId ?? undefined,
          conversationType: opts?.conversationType ?? null,
        },
      });
      queryClient.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
      setLocation(`/companion/${session.id}`);
    } catch (e) {
      console.error(e);
      setIsCreating(false);
    }
  };

  if (cbOpen) {
    return (
      <div className="max-w-3xl mx-auto space-y-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCbOpen(false)}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/50 text-muted-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="text-2xl font-serif text-foreground">Continuing Bonds</h1>
            <p className="text-sm text-muted-foreground">A gentle way to tend a relationship that continues.</p>
          </div>
        </div>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">Who are you holding in mind?</h2>
          {deceasedList && deceasedList.length > 0 ? (
            <div className="grid sm:grid-cols-2 gap-3">
              {deceasedList.map((person) => (
                <LovedOneCard
                  key={person.id}
                  person={person}
                  selected={selectedDeceasedId === person.id}
                  onSelect={() => setSelectedDeceasedId(person.id)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
              You have not added anyone yet. You can{" "}
              <Link href="/loved-one" className="text-primary underline underline-offset-4">
                create a profile for the person you are remembering
              </Link>
              , or continue with an open conversation for now.
            </div>
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-medium text-muted-foreground">What would you like this conversation to hold?</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {CONVERSATION_TYPES.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setConversationType(type.id)}
                className={`text-left rounded-lg border p-4 transition-colors ${
                  conversationType === type.id
                    ? "border-primary/40 bg-primary/5"
                    : "border-border hover:bg-secondary/30"
                }`}
              >
                <div className="text-sm font-medium">{type.label}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-snug">{type.desc}</div>
              </button>
            ))}
          </div>
        </section>

        <div className="rounded-lg border border-border bg-muted/40 p-4 text-xs text-muted-foreground leading-relaxed">
          This companion offers reflection grounded in Dr. Robert Neimeyer's meaning reconstruction and continuing-bonds work. It is a support alongside human care, not a therapist or a replacement for one. It will not speak as the person who died unless you ask for an imagined message. You can pause or leave at any time, and the crisis link stays one tap away.
        </div>

        <button
          onClick={() =>
            !isCreating &&
            startSession("continuing-bonds", { deceasedId: selectedDeceasedId, conversationType })
          }
          disabled={isCreating}
          className="w-full bg-primary text-primary-foreground py-3 rounded-md font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isCreating ? "Preparing a quiet space..." : "Begin"}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      <div className="space-y-4">
        <h1 className="text-3xl font-serif text-foreground">Companion</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          A reflective space to explore your grief or maintain a sense of connection.
          Choose how you would like to be supported today.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div
          onClick={() => !isCreating && openContinuingBonds()}
          className="group relative bg-card border border-border p-6 rounded-xl hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative space-y-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Anchor className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-serif">Continuing Bonds</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Maintain a sense of relationship with the person who died. Choose who you are holding in mind and what the conversation should hold.
            </p>
            <div className="pt-2 flex items-center text-sm font-medium text-primary">
              <Plus className="w-4 h-4 mr-1" /> Start session
            </div>
          </div>
        </div>

        <div
          onClick={() => !isCreating && startSession("meaning")}
          className="group relative bg-card border border-border p-6 rounded-xl hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative space-y-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <MessageSquare className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-serif">Meaning Reconstruction</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              A reflective guide to help you rebuild your narrative, identity, and worldview after loss.
            </p>
            <div className="pt-2 flex items-center text-sm font-medium text-primary">
              <Plus className="w-4 h-4 mr-1" /> Start session
            </div>
          </div>
        </div>
      </div>

      {sessions && sessions.length > 0 && (
        <div className="space-y-6 pt-8 border-t border-border/50">
          <h2 className="text-xl font-serif">Past Sessions</h2>
          <div className="grid gap-3">
            {sessions.map((session) => (
              <Link key={session.id} href={`/companion/${session.id}`}>
                <div className="bg-card border border-border p-4 rounded-lg flex items-center justify-between hover:bg-secondary/20 transition-colors cursor-pointer group">
                  <div>
                    <h3 className="font-medium group-hover:text-primary transition-colors">{session.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 capitalize tracking-wider">
                      {session.mode.replace("-", " ")}, {format(new Date(session.createdAt), "MMM d")}
                    </p>
                  </div>
                  <MessageSquare className="w-4 h-4 text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
