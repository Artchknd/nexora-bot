"use client";

import { useActionState } from "react";
import { IDLE_FORM_STATE, type FormState } from "@/lib/admin-form";

type StyleAction = (prev: FormState, formData: FormData) => Promise<FormState>;

export function StyleForm({
  action,
  userId,
  initialStyle,
  placeholder,
}: {
  action: StyleAction;
  userId?: string;
  initialStyle: string | null;
  placeholder: string;
}) {
  const [state, formAction, pending] = useActionState(action, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="style-form">
      {userId && <input type="hidden" name="userId" value={userId} />}
      <textarea
        key={initialStyle ?? ""}
        className="field"
        name="style"
        defaultValue={initialStyle ?? ""}
        placeholder={placeholder}
        maxLength={500}
        rows={3}
      />
      <div className="form-actions">
        <button
          className="btn btn-inline"
          type="submit"
          name="intent"
          value="save"
          disabled={pending}
        >
          {pending ? "儲存中" : "儲存風格"}
        </button>
        <button
          className="btn btn-inline btn-ghost"
          type="submit"
          name="intent"
          value="clear"
          disabled={pending || !initialStyle}
        >
          清除
        </button>
        {state.status !== "idle" && (
          <span
            className={`form-msg ${state.status === "ok" ? "ok-text" : "error-text"}`}
            role="status"
          >
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}
