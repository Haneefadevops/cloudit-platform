-- OrbitOne Scheduling S4 integration events.

ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'booking_page_view';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'booking_slot_selected';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'booking_confirmed';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'booking_cancelled';
ALTER TYPE analytics_event_type ADD VALUE IF NOT EXISTS 'booking_rescheduled';
