type FormDesignEditorProps = {
  mode: "landing" | "ad";
  title: string;
  value: UiConfig;
  onChange: (next: UiConfig) => void;

  canManageTemplates?: boolean;
  templateList?: any[];
  selectedTemplateName?: string;
  onSelectedTemplateNameChange?: (value: string) => void;

  onSave?: () => void;
  onSaveAsTemplate?: (templateName: string) => void;
  onApplyTemplate?: (templateName: string) => void;
  onDeleteTemplate?: (templateName: string) => void;
  onRenameTemplate?: (oldName: string, newName: string) => void;
  onDuplicateTemplate?: (sourceName: string, newName: string) => void;
  onTogglePinTemplate?: (templateName: string) => void;

  isSaving?: boolean;
  isUploadingLogo?: boolean;
  isUploadingHero?: boolean;
  onUploadImage?: (file: File, target: "logoUrl" | "heroImageUrl") => Promise<void> | void;
};