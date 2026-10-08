"use client";

import { useActionState } from "react";

import { unlockVaultAction, type UnlockState } from "@/app/vault/actions";
import { IconLock } from "@/components/vault/icons";

export function UnlockForm() {
  const [state, action, pending] = useActionState<UnlockState, FormData>(unlockVaultAction, { error: null });
  return (
    <form action={action} className="fg-form">
      <label className="fg-field">
        PASSWORD
        <input type="password" name="password" autoComplete="current-password" required autoFocus disabled={pending || Boolean(state.lockedMinutes)} />
      </label>
      {state.error ? (
        <p className="fg-error" role="alert">
          {state.error}
          {state.lockedMinutes ? ` Try again in ${state.lockedMinutes} min.` : ""}
        </p>
      ) : null}
      <button type="submit" className="fg-btn is-primary" disabled={pending || Boolean(state.lockedMinutes)}>
        <IconLock size={16} /> {pending ? "Verifying…" : "Unlock vault"}
      </button>
    </form>
  );
}
