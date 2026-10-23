"use client";

import { useActionState } from "react";
import { IDLE_FORM_STATE } from "@/lib/admin-form";
import { saveModel } from "./actions";

export function ModelForm({
  userId,
  currentModel,
  models,
  defaultModel,
  disabled,
}: {
  userId: string;
  currentModel: string | null;
  models: string[];
  defaultModel: string;
  disabled: boolean;
}) {
  const [state, formAction, pending] = useActionState(saveModel, IDLE_FORM_STATE);

  return (
    <form action={formAction} className="style-form">
      <input type="hidden" name="userId" value={userId} />
      <select
        key={currentModel ?? ""}
        className="field"
        name="model"
        defaultValue={currentModel ?? ""}
        disabled={disabled}
      >
        <option value="">沿用系統預設（{defaultModel}）</option>
        {currentModel && !models.includes(currentModel) && (
          <option value={currentModel}>{currentModel}（已不在可用清單）</option>
        )}
        {models.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <div className="form-actions">
        <button className="btn btn-inline" type="submit" disabled={pending || disabled}>
          {pending ? "儲存中" : "儲存模型"}
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
