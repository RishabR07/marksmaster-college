import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Event {
  id: string;
  title: string;
  description: string | null;
  event_date: string;
  event_time: string | null;
  location: string | null;
  created_at: string;
}

interface AdminEventsManagerProps {
  userId: string;
}

export function AdminEventsManager({ userId }: AdminEventsManagerProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    event_date: "",
    event_time: "",
    location: "",
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { error } = await supabase.from("events").insert({
      title: formData.title,
      description: formData.description || null,
      event_date: formData.event_date,
      event_time: formData.event_time || null,
      location: formData.location || null,
      created_by: userId,
    });

    if (error) {
      toast.error("Failed to create event");
      return;
    }

    toast.success("Event created successfully");
    setDialogOpen(false);
    setFormData({ title: "", description: "", event_date: "", event_time: "", location: "" });
    fetchEvents();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("events").delete().eq("id", id);
    
    if (error) {
      toast.error("Failed to delete event");
      return;
    }

    toast.success("Event deleted");
    fetchEvents();
  };

  if (loading) {
    return <div className="text-center py-8">Loading events...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Manage Events</h3>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Event</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="event_date">Date *</Label>
                  <Input
                    id="event_date"
                    type="date"
                    value={formData.event_date}
                    onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="event_time">Time</Label>
                  <Input
                    id="event_time"
                    type="time"
                    value={formData.event_time}
                    onChange={(e) => setFormData({ ...formData, event_time: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Input
                  id="location"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                />
              </div>
              <Button type="submit" className="w-full">Create Event</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {events.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No events yet. Create your first event!
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Card key={event.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{event.title}</CardTitle>
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(event.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
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
      )}
    </div>
  );
}
