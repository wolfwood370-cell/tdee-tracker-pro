import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAppStore } from "@/stores";
import { ProgressEntryForm } from "@/components/ProgressEntryForm";
import { ProgressComparison } from "@/components/ProgressComparison";
import { ProgressPhotoUpload } from "@/components/ProgressPhotoUpload";
import { ProgressPhotoGallery } from "@/components/ProgressPhotoGallery";
import type { ProgressEntry } from "@/types/progress";
import { TrendingUp } from "lucide-react";

export default function Progress() {
  const { user } = useAppStore();
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("new");
  const [photoRefresh, setPhotoRefresh] = useState(0);

  const fetchEntries = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await supabase
      .from("progress_entries")
      .select("*")
      .eq("user_id", user.id)
      .order("entry_date", { ascending: false });
    setEntries(data ?? []);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  if (!user) return null;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-6 w-6 text-primary" />
        <h1 className="text-xl font-display font-bold text-foreground">Progressi</h1>
      </div>

      <Tabs defaultValue="charts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 bg-secondary">
          <TabsTrigger value="charts">Grafici</TabsTrigger>
          <TabsTrigger value="photos">Foto</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-6 mt-0">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2 bg-secondary">
              <TabsTrigger value="new">Nuovo Check-in</TabsTrigger>
              <TabsTrigger value="compare">Comparativa</TabsTrigger>
            </TabsList>

            <TabsContent value="new" className="mt-6">
              <ProgressEntryForm
                onSaved={() => {
                  fetchEntries();
                }}
              />
            </TabsContent>
          </Tabs>
        </TabsContent>

        <TabsContent value="photos" className="space-y-6 mt-0">
          <ProgressPhotoUpload onUploaded={() => setPhotoRefresh((n) => n + 1)} />
          {isLoading ? (
            <div className="text-center py-12 text-muted-foreground animate-pulse">Caricamento...</div>
          ) : (
            <ProgressComparison entries={entries} />
          )}
          <ProgressPhotoGallery userId={user.id} refreshKey={photoRefresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
