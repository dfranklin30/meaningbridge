import { useGetSafetyResources } from "@workspace/api-client-react";
import { Phone, Globe, ShieldAlert, HeartHandshake } from "lucide-react";

export default function Crisis() {
  const { data: resources } = useGetSafetyResources();

  return (
    <div className="max-w-3xl mx-auto space-y-12">
      <div className="bg-destructive/10 border-2 border-destructive/20 rounded-2xl p-8 md:p-12 text-center space-y-6">
        <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto text-destructive">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-serif text-destructive">You are not alone.</h1>
        <p className="text-lg text-destructive/90 max-w-lg mx-auto leading-relaxed">
          If you are in immediate danger or experiencing a crisis, please reach out right away. There are people waiting to help you.
        </p>
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-serif">Immediate Support</h2>
        <div className="grid gap-4">
          {resources?.map(resource => (
            <div key={resource.id} className="bg-card border border-border p-6 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2">
                <h3 className="font-serif text-xl">{resource.name}</h3>
                <p className="text-sm text-muted-foreground">{resource.description}</p>
                <div className="text-xs text-muted-foreground/70 uppercase tracking-wider">{resource.region}</div>
              </div>
              <div className="flex flex-col gap-3 md:items-end shrink-0">
                <a href={`tel:${resource.contact.replace(/[^0-9]/g, '')}`} className="flex items-center justify-center gap-2 bg-foreground text-background px-6 py-2.5 rounded-full text-sm font-medium hover:opacity-90 transition-opacity">
                  <Phone className="w-4 h-4" /> {resource.contact}
                </a>
                {resource.url && (
                  <a href={resource.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-6 py-2.5 rounded-full text-sm font-medium hover:bg-secondary/80 transition-colors">
                    <Globe className="w-4 h-4" /> Visit Website
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-secondary/30 rounded-2xl p-8 text-center space-y-6 mt-12">
        <HeartHandshake className="w-8 h-8 text-muted-foreground mx-auto" />
        <h3 className="font-serif text-xl">A gentle grounding moment</h3>
        <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
          If it feels safe to do so, try taking a slow breath in. Notice the feeling of the ground beneath you. You don't have to figure anything out right now. Just breathe.
        </p>
      </div>
    </div>
  );
}