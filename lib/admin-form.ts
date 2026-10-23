export type FormState = {
  status: "idle" | "ok" | "error";
  message: string;
};

export const IDLE_FORM_STATE: FormState = { status: "idle", message: "" };

export const SNOWFLAKE = /^\d{15,25}$/;
