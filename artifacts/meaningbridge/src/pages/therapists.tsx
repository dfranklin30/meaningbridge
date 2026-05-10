import { useState } from "react";
import { useFindTherapists } from "@workspace/api-client-react";
import { Search, ExternalLink, MapPin, Award } from "lucide-react";

export default function Therapists() {
  const [zip, setZip] = useState("");
  const [searchZip, setSearchZip] = useState<string | undefined>(undefined);
  
  const { data: therapists, isLoading } = useFindTherapists({ zip: searchZip });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchZip(zip || undefined);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-serif text-foreground">Clinical Support</h1>
        <p className="text-muted-foreground max-w-2xl leading-relaxed">
          Sometimes grief requires more support than a self-guided app can provide. 
          Here you can find professionals who specialize in grief and trauma.
        </p>
      </div>

      <div className="bg-muted/50 border border-border rounded-lg p-4 text-sm text-muted-foreground text-center">
        Directory placeholder — not vetted clinical referrals. Please verify all credentials independently.
      </div>

      <form onSubmit={handleSearch} className="flex gap-2 max-w-md">
        <div className="relative flex-1">
          <MapPin className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by ZIP code..."
            className="w-full pl-9 pr-4 py-2 bg-background border border-border rounded-md text-sm focus:ring-1 focus:ring-primary/50 outline-none"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
          />
        </div>
        <button type="submit" className="bg-primary text-primary-foreground px-4 rounded-md text-sm font-medium hover:opacity-90 transition-opacity">
          Search
        </button>
      </form>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Searching...</div>
      ) : therapists?.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No professionals found in this area.
        </div>
      ) : (
        <div className="grid gap-6">
          {therapists?.map(therapist => (
            <div key={therapist.id} className="bg-card border border-border p-6 rounded-xl flex flex-col md:flex-row gap-6">
              <div className="flex-1 space-y-4">
                <div>
                  <h3 className="text-xl font-serif">{therapist.name}</h3>
                  <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><Award className="w-3.5 h-3.5" /> {therapist.credentials}</span>
                    <span>•</span>
                    <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {therapist.city}, {therapist.state} {therapist.zip}</span>
                  </div>
                </div>
                
                <p className="text-sm leading-relaxed">{therapist.bio}</p>
                
                <div className="inline-block px-3 py-1 bg-secondary/50 rounded-full text-xs font-medium text-secondary-foreground">
                  {therapist.modality}
                </div>
              </div>
              
              {therapist.website && (
                <div className="md:w-48 shrink-0 flex items-start md:justify-end">
                  <a 
                    href={therapist.website} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline underline-offset-4 transition-all"
                  >
                    Visit Website <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}