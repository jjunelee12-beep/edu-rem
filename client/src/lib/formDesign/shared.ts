import type { FormCanvasConfig } from "./canvasTypes";

export type UiField = {
  fieldKey: string;
  label: string;
  placeholder?: string;
  required: boolean;
  hidden: boolean;
  order: number;
  type: "text" | "phone" | "select" | "textarea" | "checkbox";
  options?: Array<{ label: string; value: string }>;
};

export type UiConfig = {
  title: string;
  subtitle: string;
  logoUrl: string;
  heroImageUrl: string;
  primaryColor: string;
  submitButtonText: string;
  agreementText: string;
  layoutType: "card" | "bottomSheet";
  fields: UiField[];
  mapping?: Record<string, string>;
  description?: string;
  tags?: string;
  isPinned?: boolean;
  lastUsedAt?: string;
canvas?: FormCanvasConfig;
};

export function formatTemplateDate(value?: string | Date | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")} ${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes()
  ).padStart(2, "0")}`;
}