import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin } from "lucide-react";
import { format } from "date-fns";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  created_at: string;
}

export function EventsList() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("events")
      .select("*")
      .order("event_date", { ascending: true });

    if (!error && data) {
      setEvents(data);
    }
    setLoading(false);
  };

  if (loading) {
    return <div className="text-center py-8">Loading events...</div>;
  }

  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No events scheduled yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => (
        <Card key={event.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{event.title}</CardTitle>
          </CardHeader>
          <CardContent>
            {event.description && (
              <p className="text-muted-foreground mb-3">{event.description}</p>
            )}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4 text-primary" />
                <span>{format(new Date(event.event_date), "PPP")}</span>
              </div>
              {event.event_time && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{event.event_time}</span>
                </div>
              )}
              {event.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-4 w-4 text-primary" />
                  <span>{event.location}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
