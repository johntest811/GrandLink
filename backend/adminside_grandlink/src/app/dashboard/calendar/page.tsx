"use client";
import { supabase } from '../../Clients/Supabase/SupabaseClients';
import { useState, useEffect } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";

type CalendarEvent = {
  id: string;
  title: string;
  description?: string;
  start: string;
  end?: string;
  location?: string;
};

export default function CalendarPage() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    start: "",
    end: "",
    location: "",
  });

  // ✅ Load events from Supabase
  useEffect(() => {
    const fetchEvents = async () => {
      const { data, error } = await supabase.from("calendar_events").select("*");
      if (error) {
        console.error("Error fetching events:", error);
      } else {
        setEvents(data || []);
      }
    };
    fetchEvents();
  }, []);

  // ✅ Open modal to create new event
  const handleDateClick = (arg: any) => {
    setFormData({
      title: "",
      description: "",
      start: arg.dateStr,
      end: arg.dateStr,
      location: "",
    });
    setSelectedEvent(null);
    setIsModalOpen(true);
  };

  // ✅ Open modal to edit existing event
  const handleEventClick = (clickInfo: any) => {
    const event = clickInfo.event;
    setSelectedEvent({
      id: event.id,
      title: event.title,
      description: event.extendedProps.description,
      start: event.startStr,
      end: event.endStr,
      location: event.extendedProps.location,
    });
    setFormData({
      title: event.title,
      description: event.extendedProps.description || "",
      start: event.startStr,
      end: event.endStr || "",
      location: event.extendedProps.location || "",
    });
    setIsModalOpen(true);
  };

  // ✅ Save event (Create or Update)
  const handleSaveEvent = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedEvent) {
      // update existing
      const { error } = await supabase
        .from("calendar_events")
        .update(formData)
        .eq("id", selectedEvent.id);
      if (error) console.error(error);
    } else {
      // create new
      const { error } = await supabase.from("calendar_events").insert([formData]);
      if (error) console.error(error);
    }

    setIsModalOpen(false);
    window.location.reload(); // refresh events
  };

  // ✅ Delete event
  const handleDeleteEvent = async () => {
    if (selectedEvent) {
      const { error } = await supabase
        .from("calendar_events")
        .delete()
        .eq("id", selectedEvent.id);
      if (error) console.error(error);

      setIsModalOpen(false);
      window.location.reload();
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-red-700 mb-4">📅 Calendar & Scheduling</h1>

      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        selectable={true}
        editable={false}
        events={events}
        dateClick={handleDateClick}
        eventClick={handleEventClick}
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,listWeek",
        }}
      />

      {/* ✅ Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 relative">
            <h2 className="text-xl font-bold text-red-700 mb-4">
              {selectedEvent ? "Edit Event" : "Add Event"}
            </h2>
            <form onSubmit={handleSaveEvent} className="flex flex-col gap-3">
              <input
                type="text"
                placeholder="Title"
                className="border rounded px-3 py-2"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
              <textarea
                placeholder="Description"
                className="border rounded px-3 py-2"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
              <input
                type="datetime-local"
                className="border rounded px-3 py-2"
                value={formData.start}
                onChange={(e) => setFormData({ ...formData, start: e.target.value })}
                required
              />
              <input
                type="datetime-local"
                className="border rounded px-3 py-2"
                value={formData.end}
                onChange={(e) => setFormData({ ...formData, end: e.target.value })}
              />
              <input
                type="text"
                placeholder="Location"
                className="border rounded px-3 py-2"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />

              <div className="flex justify-between mt-4">
                {selectedEvent && (
                  <button
                    type="button"
                    onClick={handleDeleteEvent}
                    className="bg-gray-300 text-black py-2 px-4 rounded-lg hover:bg-gray-400"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="submit"
                  className="bg-red-700 text-white py-2 px-4 rounded-lg hover:bg-red-800"
                >
                  Save Event
                </button>
              </div>
            </form>

            {/* Close Button */}
            <button
              onClick={() => setIsModalOpen(false)}
              className="absolute top-3 right-3 text-gray-600 hover:text-black"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}