import {
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Bot,
  CheckCircle2,
  Copy,
  FileScan,
  GraduationCap,
  Loader2,
  MessageCircle,
  RefreshCw,
  Save,
  UserRoundSearch,
  Users,
  WalletCards,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

type KakaoAiSettingsForm = {
  enabled: boolean;

  newConsultationEnabled: boolean;
  registeredStudentEnabled: boolean;

  ocrEnabled: boolean;
  practiceSupportEnabled: boolean;
  assigneeRecommendationEnabled: boolean;

  aiDisplayName: string;

  welcomeMessage: string;
defaultGuideMessage: string;
consultationHoursMessage: string;

companyIntroduction: string;
companyBenefits: string;
salesPoints: string;
registeredAiBenefits: string;
classManagementPolicy: string;
practicePolicy: string;
administrativeSupportPolicy: string;
  consultationPolicy: string;

  priceDisclosureEnabled: boolean;

  kakaoBotId: string;
};

const DEFAULT_FORM: KakaoAiSettingsForm = {
  enabled: false,

  newConsultationEnabled: true,
  registeredStudentEnabled: true,

  ocrEnabled: true,
  practiceSupportEnabled: true,
  assigneeRecommendationEnabled: true,

  aiDisplayName: "EduCanvas AI",

  welcomeMessage: "",
defaultGuideMessage: "",
consultationHoursMessage: "",

companyIntroduction: "",
companyBenefits: "",
salesPoints: "",
registeredAiBenefits: "",
classManagementPolicy: "",
practicePolicy: "",
administrativeSupportPolicy: "",
consultationPolicy: "",

  priceDisclosureEnabled: false,

  kakaoBotId: "",
};

export default function KakaoAISettings() {
  const utils = trpc.useUtils();

  const [form, setForm] =
    useState<KakaoAiSettingsForm>(
      DEFAULT_FORM
    );

  const [initialized, setInitialized] =
    useState(false);

  /**
   * Webhook 원본 Token은 서버가 DB에 저장하지 않는다.
   *
   * regenerateWebhookToken 호출 직후에만
   * 이 화면에서 URL을 표시한다.
   */
  const [
    generatedWebhookPath,
    setGeneratedWebhookPath,
  ] = useState("");

  const [
    generatedWebhookUrl,
    setGeneratedWebhookUrl,
  ] = useState("");

  const settingsQuery =
    trpc.kakaoAi.settings.get.useQuery(
      undefined,
      {
        refetchOnWindowFocus: false,
      }
    );

  const updateMutation =
    trpc.kakaoAi.settings.update.useMutation({
      onSuccess: async () => {
        toast.success(
          "카카오 AI 설정을 저장했습니다."
        );

        await utils.kakaoAi.settings.get.invalidate();
      },

      onError: (error) => {
        toast.error(
          error.message ||
            "카카오 AI 설정 저장에 실패했습니다."
        );
      },
    });

  const regenerateWebhookTokenMutation =
    trpc.kakaoAi.settings
      .regenerateWebhookToken
      .useMutation({
        onSuccess: (data) => {
          const webhookPath =
            String(
              data.webhookPath || ""
            ).trim();

          setGeneratedWebhookPath(
            webhookPath
          );

          /**
           * 현재 CRM 도메인과 API 도메인이
           * 동일하게 노출되는 구조라면
           * origin + path가 최종 Skill URL이 된다.
           */
          const webhookUrl =
            webhookPath &&
            typeof window !==
              "undefined"
              ? `${window.location.origin}${webhookPath}`
              : webhookPath;

          setGeneratedWebhookUrl(
            webhookUrl
          );

          toast.success(
            "카카오 Webhook URL을 새로 발급했습니다."
          );
        },

        onError: (error) => {
          toast.error(
            error.message ||
              "카카오 Webhook URL 발급에 실패했습니다."
          );
        },
      });

  useEffect(() => {
    if (
      !settingsQuery.data ||
      initialized
    ) {
      return;
    }

    const data = settingsQuery.data;

    setForm({
      enabled:
        data.enabled === true,

      newConsultationEnabled:
        data.newConsultationEnabled === true,

      registeredStudentEnabled:
        data.registeredStudentEnabled === true,

      ocrEnabled:
        data.ocrEnabled === true,

      practiceSupportEnabled:
        data.practiceSupportEnabled === true,

      assigneeRecommendationEnabled:
        data.assigneeRecommendationEnabled ===
        true,

      aiDisplayName:
        String(
          data.aiDisplayName ||
            "EduCanvas AI"
        ),

      welcomeMessage:
        String(
          data.welcomeMessage || ""
        ),

      defaultGuideMessage:
        String(
          data.defaultGuideMessage || ""
        ),

      consultationHoursMessage:
        String(
          data.consultationHoursMessage || ""
        ),

companyIntroduction:
  String(
    data.companyIntroduction || ""
  ),

companyBenefits:
  String(
    data.companyBenefits || ""
  ),

salesPoints:
  String(
    data.salesPoints || ""
  ),

registeredAiBenefits:
  String(
    data.registeredAiBenefits || ""
  ),

classManagementPolicy:
  String(
    data.classManagementPolicy || ""
  ),

practicePolicy:
  String(
    data.practicePolicy || ""
  ),

administrativeSupportPolicy:
  String(
    data.administrativeSupportPolicy || ""
  ),

consultationPolicy:
  String(
    data.consultationPolicy || ""
  ),

            priceDisclosureEnabled:
        data.priceDisclosureEnabled === true,

      kakaoBotId:
        String(
          data.kakaoBotId || ""
        ),
    });

    setInitialized(true);
  }, [
    settingsQuery.data,
    initialized,
  ]);

  const setBooleanField = (
    field:
      | "enabled"
      | "newConsultationEnabled"
      | "registeredStudentEnabled"
      | "ocrEnabled"
      | "practiceSupportEnabled"
      | "assigneeRecommendationEnabled"
      | "priceDisclosureEnabled",
    value: boolean
  ) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = () => {
    const aiDisplayName =
      form.aiDisplayName.trim();

    if (!aiDisplayName) {
      toast.error(
        "AI 표시 이름을 입력해주세요."
      );
      return;
    }

    if (aiDisplayName.length > 100) {
      toast.error(
        "AI 표시 이름은 100자를 초과할 수 없습니다."
      );
      return;
    }

    const kakaoBotId =
      form.kakaoBotId.trim();

    if (
      kakaoBotId.length >
      191
    ) {
      toast.error(
        "카카오 Bot ID는 191자를 초과할 수 없습니다."
      );

      return;
    }

    updateMutation.mutate({
      enabled: form.enabled,

      newConsultationEnabled:
        form.newConsultationEnabled,

      registeredStudentEnabled:
        form.registeredStudentEnabled,

      ocrEnabled:
        form.ocrEnabled,

      practiceSupportEnabled:
        form.practiceSupportEnabled,

      assigneeRecommendationEnabled:
        form.assigneeRecommendationEnabled,

      aiDisplayName,

      welcomeMessage:
        form.welcomeMessage.trim() ||
        null,

      defaultGuideMessage:
        form.defaultGuideMessage.trim() ||
        null,

      consultationHoursMessage:
        form.consultationHoursMessage.trim() ||
        null,

companyIntroduction:
  form.companyIntroduction.trim() ||
  null,

companyBenefits:
  form.companyBenefits.trim() ||
  null,

salesPoints:
  form.salesPoints.trim() ||
  null,

registeredAiBenefits:
  form.registeredAiBenefits.trim() ||
  null,

classManagementPolicy:
  form.classManagementPolicy.trim() ||
  null,

practicePolicy:
  form.practicePolicy.trim() ||
  null,

administrativeSupportPolicy:
  form.administrativeSupportPolicy.trim() ||
  null,

consultationPolicy:
  form.consultationPolicy.trim() ||
  null,

            priceDisclosureEnabled:
        form.priceDisclosureEnabled,

      kakaoBotId:
        kakaoBotId ||
        null,
    });
  };

  const handleCopyWebhookUrl =
    async () => {
      const webhookUrl =
        generatedWebhookUrl.trim();

      if (
        !webhookUrl
      ) {
        toast.error(
          "먼저 Webhook URL을 발급해주세요."
        );

        return;
      }

      try {
        await navigator.clipboard.writeText(
          webhookUrl
        );

        toast.success(
          "Webhook URL을 복사했습니다."
        );
      } catch {
        toast.error(
          "Webhook URL 복사에 실패했습니다."
        );
      }
    };

  if (settingsQuery.isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>
            카카오 AI 설정을 불러오는 중입니다.
          </span>
        </div>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <Card>
          <CardHeader>
            <CardTitle>
              카카오 AI 설정을 불러올 수 없습니다.
            </CardTitle>

            <CardDescription>
              {settingsQuery.error.message}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                settingsQuery.refetch();
              }}
            >
              다시 시도
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <MessageCircle className="h-6 w-6" />

            <h1 className="text-2xl font-bold tracking-tight">
              카카오 AI
            </h1>
          </div>

          <p className="mt-2 text-sm text-muted-foreground">
            카카오톡 고객 상담에 사용할
            회사별 AI 운영 정책을 설정합니다.
          </p>
        </div>

        <Button
          type="button"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}

          설정 저장
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            카카오 AI 운영
          </CardTitle>

          <CardDescription>
            회사의 카카오 AI 고객 상담을
            실제로 운영할지 설정합니다.
          </CardDescription>
        </CardHeader>

                <CardContent className="space-y-6">
          <SettingSwitch
            title="카카오 AI 운영"
            description={
              form.enabled
                ? "카카오 AI 운영이 활성화되어 있습니다."
                : "현재 카카오 AI 운영이 중지되어 있습니다."
            }
            checked={form.enabled}
            onCheckedChange={(value) =>
              setBooleanField(
                "enabled",
                value
              )
            }
          />

          <div className="border-t pt-6">
            <div className="mb-4">
              <p className="text-sm font-medium">
                카카오 채널 연결
              </p>

              <p className="mt-1 text-sm text-muted-foreground">
                현재 회사에서 사용할 카카오 챗봇의 Bot ID와
                Skill Webhook URL을 설정합니다.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="kakaoBotId">
                  카카오 Bot ID
                </Label>

                <Input
                  id="kakaoBotId"
                  value={
                    form.kakaoBotId
                  }
                  maxLength={191}
                  placeholder="카카오 챗봇 관리자센터의 Bot ID를 입력하세요."
                  onChange={(event) =>
                    setForm(
                      (prev) => ({
                        ...prev,

                        kakaoBotId:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                />

                <p className="text-xs text-muted-foreground">
                  카카오 챗봇 관리자센터에서 확인한
                  해당 회사 챗봇의 Bot ID를 입력합니다.
                  다른 회사 Bot ID와 공유하지 않습니다.
                </p>
              </div>

              <div className="space-y-2">
                <Label>
                  Skill Webhook URL
                </Label>

                <div className="flex flex-col gap-2 md:flex-row">
                  <Input
                    value={
                      generatedWebhookUrl
                    }
                    readOnly
                    placeholder="아직 Webhook URL이 발급되지 않았습니다."
                    className="font-mono text-xs"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    onClick={
                      handleCopyWebhookUrl
                    }
                    disabled={
                      !generatedWebhookUrl
                    }
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    복사
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={
                      regenerateWebhookTokenMutation
                        .isPending
                    }
                    onClick={() => {
                      regenerateWebhookTokenMutation
                        .mutate();
                    }}
                  >
                    {regenerateWebhookTokenMutation
                      .isPending ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}

                    {generatedWebhookUrl
                      ? "URL 재발급"
                      : "URL 발급"}
                  </Button>
                </div>

                <p className="text-xs leading-5 text-muted-foreground">
                  이 URL을 카카오 챗봇 관리자센터의
                  Skill URL에 등록합니다.
                  URL을 재발급하면 기존 URL은 즉시 사용할 수 없습니다.
                </p>
              </div>

              <div className="rounded-md border bg-muted/30 p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      Bot ID
                    </span>

                    <span className="font-medium">
                      {form.kakaoBotId.trim()
                        ? "등록됨"
                        : "미등록"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="text-muted-foreground">
                      Webhook URL
                    </span>

                    <span className="font-medium">
                      {generatedWebhookPath
                        ? "발급됨"
                        : "현재 화면에서 미발급"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              상담 대상
            </CardTitle>

            <CardDescription>
              AI가 어떤 고객의 상담을
              담당할지 설정합니다.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <SettingSwitch
              icon={
                <MessageCircle className="h-5 w-5" />
              }
              title="신규 고객 상담"
              description="상담DB에 아직 등록되지 않은 신규 고객의 문의를 AI가 상담합니다."
              checked={
                form.newConsultationEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "newConsultationEnabled",
                  value
                )
              }
            />

            <SettingSwitch
              icon={
                <Users className="h-5 w-5" />
              }
              title="기존 등록자 상담"
              description="인증된 기존 학생의 학기, 플랜, 일정 및 행정 관련 상담을 지원합니다."
              checked={
                form.registeredStudentEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "registeredStudentEnabled",
                  value
                )
              }
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              AI 기능
            </CardTitle>

            <CardDescription>
              카카오 상담에서 사용할
              세부 AI 기능을 설정합니다.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <SettingSwitch
              icon={
                <FileScan className="h-5 w-5" />
              }
              title="이미지 · OCR 분석"
              description="고객이 전송한 이미지와 서류를 AI가 분석할 수 있도록 허용합니다."
              checked={form.ocrEnabled}
              onCheckedChange={(value) =>
                setBooleanField(
                  "ocrEnabled",
                  value
                )
              }
            />

            <SettingSwitch
              icon={
                <GraduationCap className="h-5 w-5" />
              }
              title="실습 지원"
              description="실습배정지원센터 데이터를 활용한 실습 안내 및 추천 기능을 사용합니다."
              checked={
                form.practiceSupportEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "practiceSupportEnabled",
                  value
                )
              }
            />

            <SettingSwitch
              icon={
                <UserRoundSearch className="h-5 w-5" />
              }
              title="담당자 추천"
              description="신규 고객에게 회사 소속 상담 담당자를 선택하거나 추천할 수 있도록 합니다."
              checked={
                form.assigneeRecommendationEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "assigneeRecommendationEnabled",
                  value
                )
              }
            />

            <SettingSwitch
              icon={
                <WalletCards className="h-5 w-5" />
              }
              title="비용 안내"
              description="카카오 AI가 회사에서 등록한 비용 및 수강료 정보를 고객에게 안내할 수 있도록 허용합니다."
              checked={
                form.priceDisclosureEnabled
              }
              onCheckedChange={(value) =>
                setBooleanField(
                  "priceDisclosureEnabled",
                  value
                )
              }
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            AI 기본 정보
          </CardTitle>

          <CardDescription>
            고객에게 표시되는 AI 이름과
            기본 상담 문구를 설정합니다.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="aiDisplayName">
              AI 표시 이름
            </Label>

            <Input
              id="aiDisplayName"
              value={form.aiDisplayName}
              maxLength={100}
              placeholder="EduCanvas AI"
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  aiDisplayName:
                    event.target.value,
                }))
              }
            />

            <p className="text-xs text-muted-foreground">
              카카오톡 상담에서 고객에게
              표시할 AI 이름입니다.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="welcomeMessage">
              첫 인사말
            </Label>

            <Textarea
              id="welcomeMessage"
              value={form.welcomeMessage}
              maxLength={5000}
              rows={5}
              placeholder="고객이 처음 상담을 시작했을 때 보여줄 인사말을 입력하세요."
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  welcomeMessage:
                    event.target.value,
                }))
              }
            />

            <div className="text-right text-xs text-muted-foreground">
              {form.welcomeMessage.length}
              /5000
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="defaultGuideMessage">
              기본 상담 안내
            </Label>

            <Textarea
              id="defaultGuideMessage"
              value={
                form.defaultGuideMessage
              }
              maxLength={10000}
              rows={7}
              placeholder="모든 고객 상담에 공통으로 적용할 회사의 기본 안내 내용을 입력하세요."
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  defaultGuideMessage:
                    event.target.value,
                }))
              }
            />

            <div className="text-right text-xs text-muted-foreground">
              {
                form.defaultGuideMessage
                  .length
              }
              /10000
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="consultationHoursMessage">
              상담 가능 시간 안내
            </Label>

            <Textarea
              id="consultationHoursMessage"
              value={
                form.consultationHoursMessage
              }
              maxLength={5000}
              rows={4}
              placeholder="담당자 상담 가능 시간 또는 운영시간 안내를 입력하세요."
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  consultationHoursMessage:
                    event.target.value,
                }))
              }
            />

            <div className="text-right text-xs text-muted-foreground">
              {
                form
                  .consultationHoursMessage
                  .length
              }
              /5000
            </div>
          </div>
        </CardContent>
      </Card>

<Card>
  <CardHeader>
    <CardTitle>
      회사 상담 정보
    </CardTitle>

    <CardDescription>
      카카오 AI가 고객에게 안내할
      회사 공통 정책과 상담 기준을 설정합니다.
    </CardDescription>
  </CardHeader>

  <CardContent className="space-y-6">
    <div className="space-y-2">
      <Label htmlFor="companyIntroduction">
        회사 소개
      </Label>

      <Textarea
        id="companyIntroduction"
        value={form.companyIntroduction}
        maxLength={10000}
        rows={6}
        placeholder="회사가 어떤 서비스를 제공하는지, 어떤 방식으로 고객을 관리하는지 입력하세요."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            companyIntroduction:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.companyIntroduction.length}/10000
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="companyBenefits">
        회사 공통 혜택
      </Label>

      <Textarea
        id="companyBenefits"
        value={form.companyBenefits}
        maxLength={10000}
        rows={6}
        placeholder="1:1 학습관리, 일정관리, 실습지원 등 회사가 공통으로 제공하는 혜택을 입력하세요."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            companyBenefits:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.companyBenefits.length}/10000
      </div>
    </div>

<div className="space-y-2">
  <Label htmlFor="salesPoints">
    상담 강조 포인트
  </Label>

  <Textarea
    id="salesPoints"
    value={form.salesPoints}
    maxLength={10000}
    rows={7}
    placeholder="상담 중 고객의 관심사에 맞춰 AI가 자연스럽게 강조할 회사의 강점과 등록 포인트를 입력하세요. 답변 문구를 작성하는 곳이 아니라 AI가 참고할 사실을 입력합니다. AI는 매 답변마다 반복하지 않고 관련성이 있을 때만 자연스럽게 활용합니다."
    onChange={(event) =>
      setForm((prev) => ({
        ...prev,
        salesPoints:
          event.target.value,
      }))
    }
  />

  <div className="text-right text-xs text-muted-foreground">
    {form.salesPoints.length}/10000
  </div>
</div>

<div className="space-y-2">
  <Label htmlFor="registeredAiBenefits">
    등록회원 AI · 학습관리 혜택
  </Label>

  <Textarea
    id="registeredAiBenefits"
    value={form.registeredAiBenefits}
    maxLength={10000}
    rows={7}
    placeholder="등록 후 이용할 수 있는 개인 학습관리, 학점·과목 조회, 위험도 분석, 행정절차 지원, 실습배정지원센터 조회, 자격증 신청 지원, 취업컨설팅 등 실제 제공하는 혜택을 입력하세요. AI는 신규 고객에게 등록 전후의 차이를 설명할 때 이 정보를 활용합니다."
    onChange={(event) =>
      setForm((prev) => ({
        ...prev,
        registeredAiBenefits:
          event.target.value,
      }))
    }
  />

  <div className="text-right text-xs text-muted-foreground">
    {form.registeredAiBenefits.length}/10000
  </div>
</div>

    <div className="space-y-2">
      <Label htmlFor="classManagementPolicy">
  이론수업 안내
</Label>

      <Textarea
        id="classManagementPolicy"
        value={form.classManagementPolicy}
        maxLength={10000}
        rows={6}
        placeholder="온라인 이론수업 진행방법, 모바일/PC 이용, 출석, 시험, 과제, 토론, 퀴즈 등 고객에게 안내할 실제 수업 내용을 입력하세요. AI는 이 내용을 그대로 복사하지 않고 고객 질문과 대화 맥락에 맞게 자연스럽게 설명합니다."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            classManagementPolicy:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.classManagementPolicy.length}/10000
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="practicePolicy">
  실습 안내
</Label>

      <Textarea
        id="practicePolicy"
        value={form.practicePolicy}
        maxLength={10000}
        rows={6}
        placeholder="실습 진행방법과 회사의 실습 지원방식, 실습배정지원센터 운영 내용 등 고객에게 안내할 실제 내용을 입력하세요. AI는 고객 질문과 대화 맥락에 맞게 자연스럽게 설명하며, 신규 고객에게 실제 실습기관 내역은 제공하지 않습니다."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            practicePolicy:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.practicePolicy.length}/10000
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="administrativeSupportPolicy">
  행정절차 지원 안내
</Label>

      <Textarea
        id="administrativeSupportPolicy"
        value={
          form.administrativeSupportPolicy
        }
        maxLength={10000}
        rows={6}
        placeholder="학습자등록, 학점인정신청, 학위신청, 자격증 신청 등 회사가 등록 회원에게 제공하는 행정절차 지원 범위를 입력하세요. 신규 고객에게는 해당 절차의 존재와 개념까지만 안내됩니다."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            administrativeSupportPolicy:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {
          form.administrativeSupportPolicy
            .length
        }
        /10000
      </div>
    </div>

    <div className="space-y-2">
      <Label htmlFor="consultationPolicy">
  AI 내부 상담정책
</Label>

      <Textarea
        id="consultationPolicy"
        value={form.consultationPolicy}
        maxLength={10000}
        rows={8}
        placeholder="AI가 상담할 때 내부적으로 지켜야 할 회사 정책을 입력하세요. 고객에게 이 문구를 그대로 공개하지 않습니다. 예: 없는 혜택을 만들어내지 않기, 등록을 과도하게 반복 유도하지 않기, 확정되지 않은 비용·일정을 단정하지 않기, 필요한 정보가 부족하면 고객에게 질문하기."
        onChange={(event) =>
          setForm((prev) => ({
            ...prev,
            consultationPolicy:
              event.target.value,
          }))
        }
      />

      <div className="text-right text-xs text-muted-foreground">
        {form.consultationPolicy.length}/10000
      </div>
    </div>
  </CardContent>
</Card>

      <Card>
        <CardContent className="flex gap-3 pt-6">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />

          <div className="space-y-1">
            <p className="text-sm font-medium">
              회사별 독립 설정
            </p>

            <p className="text-sm text-muted-foreground">
              이 설정은 현재 회사에만
              적용되며 다른 회사의 카카오
              AI 설정에는 영향을 주지
              않습니다.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          size="lg"
          onClick={handleSave}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}

          설정 저장
        </Button>
      </div>
    </div>
  );
}

function SettingSwitch(props: {
  icon?: ReactNode;

  title: string;
  description: string;

  checked: boolean;

  onCheckedChange: (
    value: boolean
  ) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 gap-3">
        {props.icon ? (
          <div className="mt-0.5 shrink-0 text-muted-foreground">
            {props.icon}
          </div>
        ) : null}

        <div className="space-y-1">
          <Label className="text-sm font-medium">
            {props.title}
          </Label>

          <p className="text-sm leading-5 text-muted-foreground">
            {props.description}
          </p>
        </div>
      </div>

      <Switch
        checked={props.checked}
        onCheckedChange={
          props.onCheckedChange
        }
        className="shrink-0"
      />
    </div>
  );
}