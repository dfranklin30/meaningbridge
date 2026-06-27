import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useListChatSessions, useCreateChatSession, getListChatSessionsQueryKey, useListDeceasedProfiles } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Anchor, Plus } from "lucide-react";
import { format } from "date-fns";

export default function CompanionList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: sessions } = useListChatSessions();
  const { data: deceasedList } = useListDeceasedProfiles();
  const { mutateAsync: createSession } = useCreateChatSession();
  const [isCreating, setIsCreating] = useState(false);

  const startSession = async (mode: string) => {
    setIsCreating(true);
    try {
      const deceasedId = deceasedList?.[0]?.id;
      const session = await createSession({
        data: {
          mode,
          title: `Session - ${format(new Date(), "MMM d, yyyy")}`,
          deceasedId
        }
      });
      queryClient.invalidateQueries({ queryKey: getListChatSessionsQueryKey() });
      setLocation(`/companion/${session.id}`);
    } catch (e) {
      console.error(e);
      setIsCreating(false);
    }
  };

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
          onClick={() => !isCreating && startSession('continuing-bonds')}
          className="group relative bg-card border border-border p-6 rounded-xl hover:border-primary/30 transition-all cursor-pointer overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <div className="relative space-y-4">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <Anchor className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-serif">Continuing Bonds</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Maintain a sense of relationship with the person who died. A gentle voice that helps you remember and connect.
            </p>
            <div className="pt-2 flex items-center text-sm font-medium text-primary">
              <Plus className="w-4 h-4 mr-1" /> Start session
            </div>
          </div>
        </div>

        <div 
          onClick={() => !isCreating && startSession('meaning')}
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
            {sessions.map(session => (
              <Link key={session.id} href={`/companion/${session.id}`}>
                <div className="bg-card border border-border p-4 rounded-lg flex items-center justify-between hover:bg-secondary/20 transition-colors cursor-pointer group">
                  <div>
                    <h3 className="font-medium group-hover:text-primary transition-colors">{session.title}</h3>
                    <p className="text-xs text-muted-foreground mt-1 capitalize tracking-wider">
                      {session.mode.replace('-', ' ')} • {format(new Date(session.createdAt), "MMM d")}
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