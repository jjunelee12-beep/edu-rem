export type ApprovalFieldSetting = {
  id?: number;
  formType: "attendance" | "business_trip" | "general";
  fieldKey: string;
  label: string;
  isVisible: boolean;
  isRequired: boolean;
  sortOrder: number;
};

export function getFieldSetting(
  settings: ApprovalFieldSetting[] | undefined,
  fieldKey: string,
  fallbackLabel: string
) {
  const found = (settings || []).find((x) => x.fieldKey === fieldKey);

  return {
    label: found?.label || fallbackLabel,
    isVisible: found?.isVisible ?? true,
    isRequired: found?.isRequired ?? false,
  };
}