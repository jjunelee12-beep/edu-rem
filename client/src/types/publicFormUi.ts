export type PublicFormFieldKey =
  | "clientName"
  | "phone"
  | "finalEducation"
  | "desiredCourse"
  | "channel"
  | "notes"
  | "agreed";

export type PublicFormFieldOption = {
  label: string;
  value: string;
};

export type PublicFormFieldConfig = {
  fieldKey: PublicFormFieldKey;
  label: string;
  placeholder?: string;
  required: boolean;
  hidden: boolean;
  order: number;
  type: "text" | "phone" | "select" | "textarea" | "checkbox";
  options?: PublicFormFieldOption[];
};

export type PublicFormUiConfig = {
  title: string;
  subtitle: string;
  logoUrl: string;
  heroImageUrl: string;
  primaryColor: string;
  submitButtonText: string;
  agreementText: string;
  layoutType: "card" | "bottomSheet";
  fields: PublicFormFieldConfig[];

  mapping?: Record<string, string>;
};