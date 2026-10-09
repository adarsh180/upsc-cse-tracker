"use client";

/** A submit button that asks first — for deletes that take topics or history with them. */
export function ConfirmSubmit({ message, children, className = "fg-btn is-sm", label }: { message: string; children: React.ReactNode; className?: string; label?: string }) {
  return (
    <button type="submit" className={className} aria-label={label} onClick={(e) => !window.confirm(message) && e.preventDefault()}>
      {children}
    </button>
  );
}
