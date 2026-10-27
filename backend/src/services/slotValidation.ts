import type { FulfillmentType } from "../models/Order.js";

/*
|--------------------------------------------------------------------------
| BAKERY OPERATING HOURS (Asia/Kolkata)
|--------------------------------------------------------------------------
| Source of truth for slot validation.
| Monday–Friday: 7:00 AM – 9:00 PM
| Saturday: 7:00 AM – 10:00 PM
| Sunday: 8:00 AM – 8:00 PM
|--------------------------------------------------------------------------
*/

type DayHours = { open: number; close: number };

const BUSINESS_HOURS: Record<string, DayHours> = {
  monday: { open: 7, close: 21 },
  tuesday: { open: 7, close: 21 },
  wednesday: { open: 7, close: 21 },
  thursday: { open: 7, close: 21 },
  friday: { open: 7, close: 21 },
  saturday: { open: 7, close: 22 },
  sunday: { open: 8, close: 20 },
};

const KOLKATA_OFFSET_MINUTES = 5 * 60 + 30; // UTC+5:30

function getKolkataDayAndTime(date: Date): {
  day: string;
  hour: number;
  minute: number;
} {
  const utcMinutes = date.getUTCHours() * 60 + date.getUTCMinutes();
  const totalMinutes = utcMinutes + KOLKATA_OFFSET_MINUTES;
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const kolkataHour = Math.floor(normalizedMinutes / 60);
  const kolkataMinute = normalizedMinutes % 60;

  const kolkataDate = new Date(date.getTime() + KOLKATA_OFFSET_MINUTES * 60 * 1000);
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
  const day = days[kolkataDate.getUTCDay()]!;

  return { day, hour: kolkataHour, minute: kolkataMinute };
}

export interface SlotValidationResult {
  valid: boolean;
  error?: string;
}

export function validateSlot(
  slotTime: Date,
  fulfillmentType: FulfillmentType,
): SlotValidationResult {
  if (!slotTime || isNaN(slotTime.getTime())) {
    return { valid: false, error: "Invalid slot time." };
  }

  const now = new Date();
  if (slotTime.getTime() <= now.getTime()) {
    return { valid: false, error: "Slot must be in the future." };
  }

  const { day, hour, minute } = getKolkataDayAndTime(slotTime);
  const hours = BUSINESS_HOURS[day];

  if (!hours) {
    return { valid: false, error: "Bakery is closed on this day." };
  }

  const slotMinutes = hour * 60 + minute;
  if (slotMinutes < hours.open * 60 || slotMinutes > hours.close * 60) {
    return {
      valid: false,
      error: `Bakery hours on ${day.charAt(0).toUpperCase() + day.slice(1)} are ${hours.open}:00 AM – ${hours.close > 12 ? hours.close - 12 : hours.close}:00 ${hours.close >= 12 ? "PM" : "AM"}.`,
    };
  }

  return { valid: true };
}

export function formatSlotTime(slotTime: Date): string {
  const { hour, minute } = getKolkataDayAndTime(slotTime);
  const period = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  const displayMinute = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMinute} ${period}`;
}

export function formatSlotDate(slotTime: Date): string {
  const kolkataDate = new Date(
    slotTime.getTime() + KOLKATA_OFFSET_MINUTES * 60 * 1000,
  );
  return kolkataDate.toISOString().split("T")[0]!;
}

export function DEFAULT_PROPOSAL_EXPIRY_MS(): number {
  return 2 * 60 * 60 * 1000; // 2 hours
}

/*
|--------------------------------------------------------------------------
| PARSE CHECKOUT SLOT
|--------------------------------------------------------------------------
| Parses the checkout's scheduledDate ("YYYY-MM-DD") and scheduledTime
| ("H:MM AM/PM - H:MM AM/PM") into a Date representing the start of the
| slot in Asia/Kolkata timezone. The returned Date stores the equivalent
| UTC instant so that getKolkataDayAndTime() reads back the correct
| local day/time.
|
| The client sends only date + time-slot strings; the backend constructs
| the authoritative Date and validates it. Browser time is never trusted.
|--------------------------------------------------------------------------
*/

export function parseCheckoutSlot(
  scheduledDate: string,
  scheduledTime: string,
): Date | null {
  const dateMatch = scheduledDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) return null;
  const year = parseInt(dateMatch[1]!, 10);
  const month = parseInt(dateMatch[2]!, 10) - 1; // 0-indexed
  const day = parseInt(dateMatch[3]!, 10);

  // Parse start time from "H:MM AM/PM - H:MM AM/PM"
  const timeMatch = scheduledTime.match(
    /^(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*/i,
  );
  if (!timeMatch) return null;
  let hour = parseInt(timeMatch[1]!, 10);
  const minute = parseInt(timeMatch[2]!, 10);
  const ampm = timeMatch[3]!.toUpperCase();
  if (ampm === "PM" && hour !== 12) hour += 12;
  if (ampm === "AM" && hour === 12) hour = 0;

  // Construct as if UTC, then subtract the IST offset so the stored
  // UTC instant represents the same local time in Asia/Kolkata.
  const localAsUtc = Date.UTC(year, month, day, hour, minute, 0, 0);
  const utcTime = localAsUtc - KOLKATA_OFFSET_MINUTES * 60 * 1000;
  const result = new Date(utcTime);

  if (isNaN(result.getTime())) return null;
  return result;
}

