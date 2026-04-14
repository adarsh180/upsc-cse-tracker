import { differenceInDays, format } from "date-fns";
import { clsx, type ClassValue } from "clsx";

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function examCountdown(dateString: string) {
  const target = new Date(dateString);
  const today = new Date();
  const days = Math.max(differenceInDays(target, today), 0);

  return {
    dateLabel: format(target, "do MMMM yyyy"),
    days,
  };
}
