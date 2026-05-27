import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShieldAlert,
  Calculator,
  Users,
  Link2,
  Pencil,
  UserX,
  UserCheck,
  KeyRound,
  Megaphone,
  Building2,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPhone } from "@/lib/format";
import { normalizeAssetUrl } from "@/lib/normalizeAssetUrl";
import {
  readAppNotificationSettings,
  updateAppNotificationSettings,
  type AppNotificationSettings,
} from "@/lib/notificationSettings";
import type {
  PublicFormUiConfig,
  PublicFormFieldConfig,
} from "@/types/publicFormUi";
import { createDefaultPublicFormUiConfig } from "@/lib/publicFormUi";
import FormDesignEditor from "@/components/forms/FormDesignEditor";
import FullScreenFormCanvasEditor from "@/components/forms/canvas/FullScreenFormCanvasEditor";
import type { UiConfig } from "@/lib/formDesign/shared";
import { createDefaultCompanyCanvasConfig } from "@/lib/formDesign/canvasTypes";

type TabKey =
  | "settlement"
  | "users"
  | "landingForms"
  | "adForms"
  | "settings";


type UserTabKey = "create" | "list" | "role" | "password" | "organization";
type UserRole = "staff" | "admin" | "host" | "superhost";

function isProtectedSuperhost(userLike: any) {
  if (!userLike) return false;
  return userLike.role === "superhost";
}

function canManageProtectedSuperhost(_currentUser: any) {
  return false;
}

function roleLabel(role?: UserRole | string) {
  switch (role) {
    case "staff":
      return "직원";
    case "admin":
      return "관리자";
    case "host":
      return "호스트";
    case "superhost":
      return "슈퍼호스트";
    default:
      return role || "-";
  }
}

function shallowEqualStringRecord(
  a: Record<string, string>,
  b: Record<string, string>
) {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;

  for (const key of aKeys) {
    if (a[key] !== b[key]) return false;
  }

  return true;
}



export default function System() {
 const { user } = useAuth();
 const [tab, setTab] = useState<TabKey>("users");

  if (user?.role !== "host" && user?.role !== "superhost") {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">
          호스트만 접근할 수 있습니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">시스템 관리</h1>
        <p className="mt-1 text-muted-foreground">
          정산 기준, 직원 계정, 조직 설정, 랜딩폼 링크, 광고폼 링크를
          관리합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === "settlement" ? "default" : "outline"}
         onClick={() => setTab("settlement")}
          className="gap-2"
        >
          <Calculator className="h-4 w-4" />
          정산 시스템 관리
        </Button>

        <Button
          variant={tab === "users" ? "default" : "outline"}
          onClick={() => setTab("users")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          직원 계정 관리
        </Button>

        <Button
          variant={tab === "landingForms" ? "default" : "outline"}
          onClick={() => setTab("landingForms")}
          className="gap-2"
        >
          <Link2 className="h-4 w-4" />
          랜딩폼 관리
        </Button>

        <Button
          variant={tab === "adForms" ? "default" : "outline"}
          onClick={() => setTab("adForms")}
          className="gap-2"
        >
          <Megaphone className="h-4 w-4" />
          광고폼 관리
        </Button>
	<Button
  variant={tab === "settings" ? "default" : "outline"}
  onClick={() => setTab("settings")}
  className="gap-2"
>
  <Building2 className="h-4 w-4" />
  설정
</Button>
      </div>

      {tab === "settlement" && <SettlementSystemSection />}
      {tab === "users" && <UserManagementSection />}
      {tab === "landingForms" && <LeadFormManagementSection />}
      {tab === "adForms" && <AdFormManagementSection />}
	{tab === "settings" && <SettingsSection />}
    </div>
  );
}

function SettlementSystemSection() {
  const utils = trpc.useUtils();

  const { data: institutions = [], isLoading: institutionsLoading } =
    trpc.educationInstitution.list.useQuery();

  const { data: positions = [], isLoading: positionsLoading } =
    trpc.org.positions.list.useQuery();

  const { data: privateCertificateMasters = [], isLoading: certificateLoading } =
    trpc.privateCertificateMaster.list.useQuery({
      activeOnly: false,
    });

  const { data: settlementSettings, isLoading: settlementSettingsLoading } =
    trpc.settlementSystem.getSettings.useQuery();

  const saveSettlementSettingsMutation =
    trpc.settlementSystem.saveSettings.useMutation({
      onSuccess: async () => {
        toast.success("정산 공통 설정이 저장되었습니다.");
        await utils.settlementSystem.getSettings.invalidate();
      },
      onError: (e) => toast.error(e.message),
    });

  const [selectedInstitutionId, setSelectedInstitutionId] = useState<string | undefined>(undefined);
  const [payoutDay, setPayoutDay] = useState<string>("25");

const [institutionDraft, setInstitutionDraft] = useState<{
  settlementType: "subject";
  normalSubjectPrice: string;
  unitCostAmount: string;
}>({
  settlementType: "subject",
  normalSubjectPrice: "75000",
  unitCostAmount: "0",
});

function shallowEqualInstitutionDraft(
  a: {
    settlementType: "subject";
    normalSubjectPrice: string;
    unitCostAmount: string;
  },
  b: {
    settlementType: "subject";
    normalSubjectPrice: string;
    unitCostAmount: string;
  }
) {
  return (
    a.settlementType === b.settlementType &&
    a.normalSubjectPrice === b.normalSubjectPrice &&
    a.unitCostAmount === b.unitCostAmount
  );
}

const [bulkCertificateFeeAmount, setBulkCertificateFeeAmount] =
  useState<string>("");

const [bulkCertificateCompanyShareAmount, setBulkCertificateCompanyShareAmount] =
  useState<string>("");

const [bulkCertificateFreelancerAmount, setBulkCertificateFreelancerAmount] =
  useState<string>("");

const [bulkCertificateEnabled, setBulkCertificateEnabled] =
  useState<boolean>(true);

  const { data: institutionRates = [], isLoading: ratesLoading } =
    trpc.settlementSystem.listInstitutionPositionRates.useQuery(
      selectedInstitutionId
        ? { educationInstitutionId: Number(selectedInstitutionId) }
        : undefined,
      {
        enabled: !!selectedInstitutionId,
      }
    );

  const upsertRateMutation =
    trpc.settlementSystem.upsertInstitutionPositionRate.useMutation({
      onSuccess: async () => {
        toast.success("교육원별 직급 단가가 저장되었습니다.");
        await utils.settlementSystem.listInstitutionPositionRates.invalidate();
      },
      onError: (e) => toast.error(e.message),
    });

const updateInstitutionMutation =
  trpc.educationInstitution.update.useMutation({
    onSuccess: async () => {
      toast.success("교육원 기본 정산 설정이 저장되었습니다.");
      await utils.educationInstitution.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePrivateCertificateMasterMutation =
    trpc.privateCertificateMaster.update.useMutation({
      onSuccess: async () => {
        toast.success("민간자격증 정산 기준이 저장되었습니다.");
        await utils.privateCertificateMaster.list.invalidate();
      },
      onError: (e) => toast.error(e.message),
    });

  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
  const next: Record<string, string> = {};

  if (institutionRates?.length) {
    institutionRates.forEach((row: any) => {
      next[String(row.positionId)] = String(row.freelancerUnitAmount ?? "0");
    });
  }

  setRateDrafts((prev) =>
    shallowEqualStringRecord(prev, next) ? prev : next
  );
}, [institutionRates]);

 useEffect(() => {
  if (!settlementSettings) return;

  const nextPayoutDay = String((settlementSettings as any)?.payoutDay ?? 25);

  setPayoutDay((prev) => (prev === nextPayoutDay ? prev : nextPayoutDay));
}, [settlementSettings]);

useEffect(() => {
  const fallbackDraft = {
    settlementType: "subject" as const,
    normalSubjectPrice: "75000",
    unitCostAmount: "0",
  };

  if (!selectedInstitutionId) {
    setInstitutionDraft((prev) =>
      shallowEqualInstitutionDraft(prev, fallbackDraft) ? prev : fallbackDraft
    );
    return;
  }

  const selected = institutions.find(
    (item: any) => Number(item.id) === Number(selectedInstitutionId)
  );

  if (!selected) return;

  const nextDraft = {
    settlementType:
      "subject",
    normalSubjectPrice: String(selected.normalSubjectPrice ?? "75000"),
    unitCostAmount: String(selected.unitCostAmount ?? "0"),
  };

  setInstitutionDraft((prev) =>
    shallowEqualInstitutionDraft(prev, nextDraft) ? prev : nextDraft
  );
}, [selectedInstitutionId, institutions]);

useEffect(() => {
  if (!privateCertificateMasters.length) return;

  const first = privateCertificateMasters[0];

  const nextFeeAmount = String(first?.defaultFeeAmount ?? "0");
const nextCompanyShareAmount = String(
  (first as any)?.defaultCompanyShareAmount ?? "0"
);
const nextFreelancerAmount = String(first?.defaultFreelancerAmount ?? "0");

  const nextEnabled =
    first?.isSettlementEnabled === undefined
      ? true
      : Boolean(first.isSettlementEnabled);

  setBulkCertificateFeeAmount((prev) =>
    prev === nextFeeAmount ? prev : nextFeeAmount
  );

setBulkCertificateCompanyShareAmount((prev) =>
  prev === nextCompanyShareAmount ? prev : nextCompanyShareAmount
);

  setBulkCertificateFreelancerAmount((prev) =>
    prev === nextFreelancerAmount ? prev : nextFreelancerAmount
  );

  setBulkCertificateEnabled((prev) =>
    prev === nextEnabled ? prev : nextEnabled
  );
}, [privateCertificateMasters]);

  const sortedInstitutions = useMemo(
    () =>
      [...institutions].sort(
        (a: any, b: any) =>
          Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
          String(a.name ?? "").localeCompare(String(b.name ?? ""))
      ),
    [institutions]
  );

  const sortedPositions = useMemo(
    () =>
      [...positions].sort(
        (a: any, b: any) =>
          Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) ||
          String(a.name ?? "").localeCompare(String(b.name ?? ""))
      ),
    [positions]
  );

  const handleSaveInstitutionRate = (positionId: number) => {
  if (!selectedInstitutionId) {
    toast.error("교육원을 먼저 선택해주세요.");
    return;
  }

  const freelancerUnitAmount = Number(rateDrafts[String(positionId)] || 0);
  const normalSubjectPrice = Number(institutionDraft.normalSubjectPrice || 0);
  const unitCostAmount = Number(institutionDraft.unitCostAmount || 0);

  if (normalSubjectPrice <= 0) {
    toast.error("과목 기본 가격을 먼저 입력해주세요.");
    return;
  }

  if (unitCostAmount < 0) {
    toast.error("교육원 정산 금액이 올바르지 않습니다.");
    return;
  }

  if (freelancerUnitAmount <= 0) {
    toast.error("직급별 프리랜서 단가를 입력해주세요.");
    return;
  }

  const companySharePerUnit = normalSubjectPrice - unitCostAmount;

  if (companySharePerUnit <= 0) {
    toast.error(
      "정산 설정값이 잘못되었습니다. 과목 기본 가격보다 교육원 정산 금액이 크거나 같습니다."
    );
    return;
  }

  if (freelancerUnitAmount > companySharePerUnit) {
    toast.error(
      `정산 설정값이 잘못되었습니다. 프리랜서 단가(${freelancerUnitAmount.toLocaleString()}원)가 회사 몫(${companySharePerUnit.toLocaleString()}원)을 초과합니다.`
    );
    return;
  }

  upsertRateMutation.mutate({
    educationInstitutionId: Number(selectedInstitutionId),
    positionId: Number(positionId),
    freelancerUnitAmount: String(freelancerUnitAmount),
    isActive: true,
  });
};

  const handleSaveSettlementSettings = () => {
    const nextPayoutDay = Number(String(payoutDay || "").replace(/[^0-9]/g, ""));

    if (!nextPayoutDay || nextPayoutDay < 1 || nextPayoutDay > 31) {
      toast.error("지급일은 1일부터 31일 사이로 입력해주세요.");
      return;
    }

    saveSettlementSettingsMutation.mutate({
      payoutDay: nextPayoutDay,
    });
  };

const handleSaveInstitutionBaseSettings = () => {
  if (!selectedInstitutionId) {
    toast.error("교육원을 먼저 선택해주세요.");
    return;
  }

  updateInstitutionMutation.mutate({
    id: Number(selectedInstitutionId),
    settlementType: "subject",
    normalSubjectPrice: institutionDraft.normalSubjectPrice || "75000",
    unitCostAmount: institutionDraft.unitCostAmount || "0",
  });
};

const handleApplyBulkCertificateSettings = async () => {
  if (!privateCertificateMasters.length) {
    toast.error("민간자격증 마스터가 없습니다.");
    return;
  }

  const feeAmount = bulkCertificateFeeAmount.trim();
const companyShareAmount = bulkCertificateCompanyShareAmount.trim();
const freelancerAmount = bulkCertificateFreelancerAmount.trim();

  if (!feeAmount) {
    toast.error("기본 결제금액을 입력해주세요.");
    return;
  }

if (!companyShareAmount) {
  toast.error("우리회사 몫 원금을 입력해주세요.");
  return;
}

  if (!freelancerAmount) {
    toast.error("기본 프리랜서 배분금액을 입력해주세요.");
    return;
  }

  try {
    await Promise.all(
      privateCertificateMasters.map((item: any) =>
        updatePrivateCertificateMasterMutation.mutateAsync({
  id: Number(item.id),
  defaultFeeAmount: feeAmount,
  defaultCompanyShareAmount: companyShareAmount,
  defaultFreelancerAmount: freelancerAmount,
  isSettlementEnabled: bulkCertificateEnabled,
})
      )
    );

    toast.success("민간자격증 공통 정산 기준이 저장되었습니다.");
    await utils.privateCertificateMaster.list.invalidate();
  } catch (e: any) {
    toast.error(e.message || "민간자격증 공통 저장 중 오류가 발생했습니다.");
  }
};

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>정산 시스템 관리 안내</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
  여기서 교육원 기본 정산 기준, 교육원별 직급 프리랜서 단가, 민간자격증 기본 정산 기준을 관리합니다.
</p>
<p>
  일반과목 정산은 총매출에서 교육원 몫을 먼저 차감하여 우리 회사 몫을 계산하고,
  그 이후 우리 회사 몫 기준으로 프리랜서 배분이 계산됩니다.
</p>
<p>
  교육원 기본 가격(과목당), 교육원 정산 금액, 직급별 프리랜서 단가를 함께 맞춰야 실제 정산 결과가 정확하게 계산됩니다.
</p>
          <p>
            민간자격증 정산은 민간자격증 마스터의 기본 금액 / 기본 프리랜서
            배분금액을 기준으로 자동 계산됩니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>정산 공통 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {settlementSettingsLoading ? (
            <div className="text-sm text-muted-foreground">불러오는 중...</div>
          ) : (
            <>
              <div className="max-w-sm space-y-2">
                <p className="text-sm font-medium">고정 지급일</p>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={payoutDay}
                  onChange={(e) =>
                    setPayoutDay(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  placeholder="예: 25"
                />
                <p className="text-xs text-muted-foreground">
                  매월 명세서 지급일로 사용할 날짜입니다. 예: 25 입력 시 해당 월 25일로 자동 반영됩니다.
                </p>
              </div>

              <div>
                <Button
                  onClick={handleSaveSettlementSettings}
                  disabled={saveSettlementSettingsMutation.isPending}
                >
                  {saveSettlementSettingsMutation.isPending
                    ? "저장 중..."
                    : "정산 공통 설정 저장"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

<Card>
  <CardHeader>
    <CardTitle>교육원 기본 정산 설정</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="max-w-md space-y-2">
      <p className="text-sm font-medium">교육원 선택</p>
      <Select
  value={selectedInstitutionId ?? undefined}
  onValueChange={setSelectedInstitutionId}
>
        <SelectTrigger>
          <SelectValue placeholder="교육원을 선택하세요" />
        </SelectTrigger>
        <SelectContent>
          {sortedInstitutions.map((institution: any) => (
            <SelectItem key={institution.id} value={String(institution.id)}>
              {institution.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>

    {!selectedInstitutionId ? (
      <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
        교육원을 먼저 선택하면 과목 기본 가격과 교육원 원가를 설정할 수 있습니다.
      </div>
    ) : (
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-2">
  <p className="text-sm font-medium">정산 방식</p>

  <Input
    value="과목 기준"
    disabled
    className="bg-muted"
  />
</div>

        <div className="space-y-2">
          <p className="text-sm font-medium">과목 기본 가격</p>
          <Input
            value={institutionDraft.normalSubjectPrice}
            onChange={(e) =>
              setInstitutionDraft((prev) => ({
                ...prev,
                normalSubjectPrice: e.target.value.replace(/[^0-9]/g, ""),
              }))
            }
            placeholder="예: 75000"
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">교육원 정산 금액</p>
          <Input
            value={institutionDraft.unitCostAmount}
            onChange={(e) =>
              setInstitutionDraft((prev) => ({
                ...prev,
                unitCostAmount: e.target.value.replace(/[^0-9]/g, ""),
              }))
            }
            placeholder="예: 24000"
          />
        </div>
      </div>
    )}

    <div>
      <Button
        onClick={handleSaveInstitutionBaseSettings}
        disabled={!selectedInstitutionId || updateInstitutionMutation.isPending}
      >
        {updateInstitutionMutation.isPending
          ? "저장 중..."
          : "교육원 기본 정산 저장"}
      </Button>
    </div>
  </CardContent>
</Card>

      <Card>
        <CardHeader>
          <CardTitle>교육원별 직급 프리랜서 단가 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md space-y-2">
            <p className="text-sm font-medium">교육원 선택</p>
            <Select
  value={selectedInstitutionId ?? undefined}
  onValueChange={setSelectedInstitutionId}
>
              <SelectTrigger>
                <SelectValue placeholder="교육원을 선택하세요" />
              </SelectTrigger>
              <SelectContent>
                {sortedInstitutions.map((institution: any) => (
                  <SelectItem
                    key={institution.id}
                    value={String(institution.id)}
                  >
                    {institution.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!selectedInstitutionId ? (
            <div className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
              교육원을 먼저 선택하면 직급별 프리랜서 단가를 입력할 수 있습니다.
            </div>
          ) : institutionsLoading || positionsLoading || ratesLoading ? (
            <div className="text-sm text-muted-foreground">불러오는 중...</div>
          ) : sortedPositions.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              등록된 직급이 없습니다. 먼저 조직 설정에서 직급을 추가해주세요.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left">직급</th>
                    <th className="px-4 py-3 text-left">직급별 프리랜서 단가</th>
                    <th className="px-4 py-3 text-right">저장</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPositions.map((position: any) => (
                    <tr key={position.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{position.name}</td>
                      <td className="px-4 py-3">
                        <Input
                          value={rateDrafts[String(position.id)] ?? "0"}
                          onChange={(e) =>
                            setRateDrafts((prev) => ({
                              ...prev,
                              [String(position.id)]: e.target.value.replace(
                                /[^0-9]/g,
                                ""
                              ),
                            }))
                          }
                          placeholder="예: 18000"
                          className="max-w-[220px]"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          onClick={() =>
                            handleSaveInstitutionRate(Number(position.id))
                          }
                          disabled={upsertRateMutation.isPending}
                        >
                          저장
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
  <CardHeader>
    <CardTitle>민간자격증 기본 정산 설정</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    {certificateLoading ? (
      <div className="text-sm text-muted-foreground">불러오는 중...</div>
    ) : !privateCertificateMasters.length ? (
      <div className="text-sm text-muted-foreground">
        등록된 민간자격증 마스터가 없습니다.
      </div>
    ) : (
      <>
        <div className="grid gap-4 md:grid-cols-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">기본 결제금액</p>
            <Input
              value={bulkCertificateFeeAmount}
              onChange={(e) =>
                setBulkCertificateFeeAmount(
                  e.target.value.replace(/[^0-9]/g, "")
                )
              }
              placeholder="예: 100000"
            />
          </div>

<div className="space-y-2">
  <p className="text-sm font-medium">우리회사 몫 원금</p>
  <Input
    value={bulkCertificateCompanyShareAmount}
    onChange={(e) =>
      setBulkCertificateCompanyShareAmount(
        e.target.value.replace(/[^0-9]/g, "")
      )
    }
    placeholder="예: 38000"
  />
</div>

          <div className="space-y-2">
            <p className="text-sm font-medium">기본 프리랜서 배분금액</p>
            <Input
              value={bulkCertificateFreelancerAmount}
              onChange={(e) =>
                setBulkCertificateFreelancerAmount(
                  e.target.value.replace(/[^0-9]/g, "")
                )
              }
              placeholder="예: 20000"
            />
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium">정산 사용</p>
            <Select
              value={bulkCertificateEnabled ? "true" : "false"}
              onValueChange={(value) =>
                setBulkCertificateEnabled(value === "true")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">사용</SelectItem>
                <SelectItem value="false">미사용</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Button
            onClick={handleApplyBulkCertificateSettings}
            disabled={updatePrivateCertificateMasterMutation.isPending}
          >
            {updatePrivateCertificateMasterMutation.isPending
              ? "저장 중..."
              : "민간자격증 기본 정산 저장"}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          민간자격증은 종류별 개별 금액이 아니라 공통 기본 금액으로 운영되며,
          저장 시 전체 민간자격증 마스터에 동일하게 반영됩니다.
        </p>
      </>
    )}
  </CardContent>
</Card>
    </div>
  );
}

function UserManagementSection() {
  const { user, refresh } = useAuth();
  const canManageOrganization =
  user?.role === "host" || user?.role === "superhost";
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();

const refreshUserOrganizationViews = async () => {
  await Promise.all([
    utils.users.list.invalidate(),
    utils.users.me.invalidate(),
    refresh(),
  ]);

  window.dispatchEvent(new Event("auth:user-updated"));
  window.dispatchEvent(new Event("profile-image-updated"));
};

const [selectedPersonnelUserId, setSelectedPersonnelUserId] = useState<number | null>(null);

const { data: personnelDetail, isLoading: personnelDetailLoading } =
  trpc.users.personnelDetail.useQuery(
    { userId: selectedPersonnelUserId || 0 },
    { enabled: !!selectedPersonnelUserId }
  );

const formatMoney = (value: any) =>
  `${Number(value || 0).toLocaleString()}원`;

const formatDate = (value: any) => {
  if (!value) return "-";
  return String(value).slice(0, 10);
};

const calcWorkDays = (createdAt: any) => {
  if (!createdAt) return "-";
  const start = new Date(createdAt);
  const now = new Date();
  const diff = now.getTime() - start.getTime();
  if (!Number.isFinite(diff) || diff < 0) return "-";
  return `${Math.floor(diff / 86400000) + 1}일`;
};

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("직원 계정이 생성되었습니다.");
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("직원 정보가 수정되었습니다.");
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("권한이 변경되었습니다.");
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const updateActiveMutation = trpc.users.updateActive.useMutation({
    onSuccess: () => {
      toast.success("활성 상태가 변경되었습니다.");
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createTeamMutation = trpc.org.teams.create.useMutation({
  onSuccess: async () => {
    toast.success("팀이 추가되었습니다.");
    await utils.org.teams.list.invalidate();
    setNewTeamName("");
    await refreshUserOrganizationViews();
  },
  onError: (e) => toast.error(e.message),
});

  const updateTeamMutation = trpc.org.teams.update.useMutation({
  onSuccess: async () => {
    toast.success("팀 정보가 수정되었습니다.");
    await utils.org.teams.list.invalidate();
    await refreshUserOrganizationViews();
  },
  onError: (e) => toast.error(e.message),
});

  const deleteTeamMutation = trpc.org.teams.delete.useMutation({
  onSuccess: async () => {
    toast.success("팀이 삭제되었습니다.");
    await utils.org.teams.list.invalidate();
    await refreshUserOrganizationViews();
  },
  onError: (e) => toast.error(e.message),
});

  const createPositionMutation = trpc.org.positions.create.useMutation({
  onSuccess: async () => {
    toast.success("직급이 추가되었습니다.");
    await utils.org.positions.list.invalidate();
    setNewPositionName("");
    await refreshUserOrganizationViews();
  },
  onError: (e) => toast.error(e.message),
});

  const updatePositionMutation = trpc.org.positions.update.useMutation({
  onSuccess: async () => {
    toast.success("직급 정보가 수정되었습니다.");
    await utils.org.positions.list.invalidate();
    await refreshUserOrganizationViews();
  },
  onError: (e) => toast.error(e.message),
});

  const deletePositionMutation = trpc.org.positions.delete.useMutation({
  onSuccess: async () => {
    toast.success("직급이 삭제되었습니다.");
    await utils.org.positions.list.invalidate();
    await refreshUserOrganizationViews();
  },
  onError: (e) => toast.error(e.message),
});

  const upsertUserMappingMutation = trpc.org.userMappings.upsert.useMutation({
  onSuccess: async () => {
    toast.success("유저 조직 정보가 저장되었습니다.");
    await refreshUserOrganizationViews();
  },
  onError: (e) => toast.error(e.message),
});

 const deleteUserMappingMutation = trpc.org.userMappings.delete.useMutation({
  onSuccess: async () => {
    toast.success("유저 조직 정보가 제거되었습니다.");
    await refreshUserOrganizationViews();
  },
  onError: (e) => toast.error(e.message),
});

  const bulkReassignMutation = trpc.consultation.bulkReassign.useMutation({
    onSuccess: () => {
      toast.success("담당자 일괄 변경 완료");
      utils.consultation.list.invalidate();
      utils.student.list.invalidate();
      utils.semester.listAll.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const [userTab, setUserTab] = useState<UserTabKey>("create");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");

  const [searchTerm, setSearchTerm] = useState("");
  const [roleSearchTerm, setRoleSearchTerm] = useState("");
  const [passwordSearch, setPasswordSearch] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");

const normalizedUsernameForCheck = username.trim();

const usernameCheckQuery =
  trpc.users.checkUsernameAvailable.useQuery(
    {
      username: normalizedUsernameForCheck,
    },
    {
      enabled: normalizedUsernameForCheck.length >= 3,
    }
  );

const usernameCheckStatus =
  normalizedUsernameForCheck.length < 3
    ? "idle"
    : usernameCheckQuery.isFetching
    ? "checking"
    : usernameCheckQuery.data?.available === true
    ? "available"
    : usernameCheckQuery.data?.available === false
    ? "taken"
    : "idle";

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
const [birthday, setBirthday] = useState("");
const [password, setPassword] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("staff");

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBankAccount, setEditBankAccount] = useState("");

  const [roleDrafts, setRoleDrafts] = useState<Record<number, UserRole>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>(
    {}
  );

  const [fromAssigneeId, setFromAssigneeId] = useState("");
  const [toAssigneeId, setToAssigneeId] = useState("");

  const { data: teams = [] } = trpc.org.teams.list.useQuery();
  const { data: positions = [] } = trpc.org.positions.list.useQuery();

  const [newTeamName, setNewTeamName] = useState("");
  const [newPositionName, setNewPositionName] = useState("");

  const handlePhoneInput = (value: string) =>
    value.replace(/\D/g, "").slice(0, 11);

  const visibleUsers = useMemo(() => {
  return (users ?? []).filter((u: any) => u.role !== "superhost");
}, [users]);

const roleFilteredUsers = useMemo(() => {
  const list = visibleUsers;
  if (roleFilter === "all") return list;
  return list.filter((u: any) => u.role === roleFilter);
}, [visibleUsers, roleFilter]);

  const filteredUsers = useMemo(() => {
    if (!searchTerm.trim()) return roleFilteredUsers;

    const term = searchTerm.trim().toLowerCase();
    return roleFilteredUsers.filter((u: any) => {
      const displayNo = String(u.displayNo ?? u.id ?? "");
      const username = String(u.username ?? "").toLowerCase();
      const name = String(u.name ?? "").toLowerCase();
      const email = String(u.email ?? "").toLowerCase();
      const phone = String(u.phone ?? "");
      return (
        displayNo.includes(term) ||
        username.includes(term) ||
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term.replace(/\D/g, ""))
      );
    });
  }, [roleFilteredUsers, searchTerm]);

  const roleTabUsers = useMemo(() => {
    if (!roleSearchTerm.trim()) return roleFilteredUsers;

    const term = roleSearchTerm.trim().toLowerCase();
    return roleFilteredUsers.filter((u: any) => {
      const displayNo = String(u.displayNo ?? u.id ?? "");
      const username = String(u.username ?? "").toLowerCase();
      const name = String(u.name ?? "").toLowerCase();
      const phone = String(u.phone ?? "");
      return (
        displayNo.includes(term) ||
        username.includes(term) ||
        name.includes(term) ||
        phone.includes(term.replace(/\D/g, ""))
      );
    });
  }, [roleFilteredUsers, roleSearchTerm]);

  const passwordFilteredUsers = useMemo(() => {
  const list = visibleUsers;
    if (!passwordSearch.trim()) return list;

    const term = passwordSearch.trim().toLowerCase();
    return list.filter((u: any) => {
      const displayNo = String(u.displayNo ?? u.id ?? "");
      const username = String(u.username ?? "").toLowerCase();
      const name = String(u.name ?? "").toLowerCase();
      const phone = String(u.phone ?? "");
      return (
        displayNo.includes(term) ||
        username.includes(term) ||
        name.includes(term) ||
        phone.includes(term.replace(/\D/g, ""))
      );
    });
  }, [users, passwordSearch]);

  const sortedTeams = useMemo(
    () =>
      [...teams].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      ),
    [teams]
  );

  const sortedPositions = useMemo(
    () =>
      [...positions].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      ),
    [positions]
  );

  const positionMap = useMemo(
    () => new Map(positions.map((item: any) => [String(item.id), item])),
    [positions]
  );

  const resetCreateForm = () => {
    setUsername("");
    setName("");
    setEmail("");
    setPhone("");
setBirthday("");
setPassword("");
setBankName("");
    setBankAccount("");
    setCreateRole("staff");
  };

  const handleCreate = () => {
  const normalizedUsername = username.trim();

  if (!normalizedUsername) return toast.error("아이디를 입력해주세요.");

  if (normalizedUsername.length < 3) {
    return toast.error("아이디는 3자 이상 입력해주세요.");
  }

  if (usernameCheckQuery.isFetching) {
    return toast.error("아이디 중복 확인 중입니다. 잠시 후 다시 시도해주세요.");
  }

  if (usernameCheckQuery.data?.available === false) {
    return toast.error("이미 사용 중인 아이디입니다.");
  }

  if (!name.trim()) return toast.error("이름을 입력해주세요.");
    if (!password.trim()) return toast.error("비밀번호를 입력해주세요.");

    createMutation.mutate(
      {
        username: normalizedUsername,
        password: password.trim(),
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
birthday: birthday || undefined,
role: createRole,
        bankName: bankName.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
      },
      {
        onSuccess: () => {
          resetCreateForm();
        },
      }
    );
  };

  const startEdit = (u: any) => {
    if (isProtectedSuperhost(u)) {
      toast.error("superhost 계정은 수정할 수 없습니다.");
      return;
    }

    setEditingUserId(u.id);
    setEditUsername(u.username ?? "");
    setEditName(u.name ?? "");
    setEditEmail(u.email ?? "");
    setEditPhone(u.phone ?? "");
    setEditBankName(u.bankName ?? "");
    setEditBankAccount(u.bankAccount ?? "");
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditUsername("");
    setEditName("");
    setEditEmail("");
    setEditPhone("");
    setEditBankName("");
    setEditBankAccount("");
  };

  const saveEdit = () => {
    if (!editingUserId) return;

    const target = users?.find((item: any) => item.id === editingUserId);
    if (isProtectedSuperhost(target)) {
      toast.error("superhost 계정은 수정할 수 없습니다.");
      return;
    }

    updateMutation.mutate(
      {
        id: editingUserId,
        username: editUsername.trim() || undefined,
        name: editName.trim() || undefined,
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        bankName: editBankName.trim() || undefined,
        bankAccount: editBankAccount.trim() || undefined,
      },
      {
        onSuccess: () => {
          cancelEdit();
        },
      }
    );
  };

  const handleChangeRole = (targetUser: any) => {
    if (isProtectedSuperhost(targetUser)) {
      toast.error("superhost 계정은 권한 변경할 수 없습니다.");
      return;
    }

    const nextRole = roleDrafts[targetUser.id];
    if (!nextRole) return toast.error("변경할 권한을 선택해주세요.");
    if (nextRole === targetUser.role) {
      return toast.error("현재 권한과 동일합니다.");
    }

    const ok = window.confirm(
      `권한을 ${targetUser.role} → ${nextRole} 로 변경하시겠습니까?`
    );
    if (!ok) return;

    updateRoleMutation.mutate({
      id: targetUser.id,
      role: nextRole,
    });
  };

  const handleToggleActive = (u: any) => {
    if (isProtectedSuperhost(u)) {
      toast.error("superhost 계정은 비활성화할 수 없습니다.");
      return;
    }

    const nextActive = !u.isActive;
    const ok = window.confirm(
      nextActive
        ? `${u.name ?? "-"} 계정을 다시 활성화하시겠습니까?`
        : `${u.name ?? "-"} 계정을 비활성화하시겠습니까?\n비활성화 시 로그인할 수 없습니다.`
    );
    if (!ok) return;

    updateActiveMutation.mutate({
      id: u.id,
      isActive: nextActive,
    });
  };

  const handleBulkReassign = () => {
    if (!fromAssigneeId) return toast.error("기존 담당자를 선택해주세요.");
    if (!toAssigneeId) return toast.error("변경할 담당자를 선택해주세요.");
    if (fromAssigneeId === toAssigneeId) {
      return toast.error("같은 담당자로는 변경할 수 없습니다.");
    }

    const fromUser = users?.find((u: any) => String(u.id) === fromAssigneeId);
    const toUser = users?.find((u: any) => String(u.id) === toAssigneeId);

    const ok = window.confirm(
      `${fromUser?.name || "-"} 담당의 상담 DB / 학생 담당자를 ${
        toUser?.name || "-"
      }(으)로 일괄 변경하시겠습니까?`
    );
    if (!ok) return;

    bulkReassignMutation.mutate({
      fromAssigneeId: Number(fromAssigneeId),
      toAssigneeId: Number(toAssigneeId),
    });
  };

  const handleResetPassword = (u: any) => {
    if (isProtectedSuperhost(u)) {
      toast.error("superhost 계정은 비밀번호 재설정할 수 없습니다.");
      return;
    }

    const newPassword = (passwordDrafts[u.id] || "").trim();

    if (!newPassword) return toast.error("새 비밀번호를 입력해주세요.");
    if (newPassword.length < 4) {
      return toast.error("비밀번호는 4자 이상이어야 합니다.");
    }

    const ok = window.confirm(
      `${u.name || u.username || "사용자"} 계정의 비밀번호를 재설정하시겠습니까?`
    );
    if (!ok) return;

    updateMutation.mutate(
      {
        id: u.id,
        password: newPassword,
      },
      {
        onSuccess: () => {
          toast.success("비밀번호가 재설정되었습니다.");
          setPasswordDrafts((prev) => ({ ...prev, [u.id]: "" }));
        },
      }
    );
  };

  const addTeam = () => {
    const value = newTeamName.trim();
    if (!value) return toast.error("팀명을 입력해주세요.");
    if (teams.some((item: any) => String(item.name).trim() === value)) {
      return toast.error("이미 같은 팀명이 있습니다.");
    }

    createTeamMutation.mutate({
      name: value,
      sortOrder: teams.length + 1,
      isActive: true,
    });
  };

  const addPosition = () => {
    const value = newPositionName.trim();
    if (!value) return toast.error("직급명을 입력해주세요.");
    if (positions.some((item: any) => String(item.name).trim() === value)) {
      return toast.error("이미 같은 직급명이 있습니다.");
    }

    createPositionMutation.mutate({
      name: value,
      sortOrder: positions.length + 1,
      isActive: true,
    });
  };

  const removeTeam = (id: string) => {
    const target = teams.find((item: any) => String(item.id) === id);
    if (!target) return;

    const ok = window.confirm(`${target.name} 팀을 삭제하시겠습니까?`);
    if (!ok) return;

    deleteTeamMutation.mutate({ id: Number(id) });
  };

  const removePosition = (id: string | number) => {
    const target = positions.find((item: any) => String(item.id) === id);
    if (!target) return;

    const ok = window.confirm(`${target.name} 직급을 삭제하시겠습니까?`);
    if (!ok) return;

    deletePositionMutation.mutate({ id: Number(id) });
  };

  const updateUserMapping = (
    targetUser: any,
    field: "teamId" | "positionId",
    value: string | null
  ) => {
    if (isProtectedSuperhost(targetUser)) {
      toast.error("superhost 계정의 조직 정보는 수정할 수 없습니다.");
      return;
    }

    const currentTeamId = targetUser.teamId ? String(targetUser.teamId) : null;
    const currentPositionId = targetUser.positionId
      ? String(targetUser.positionId)
      : null;

    const nextTeamId = field === "teamId" ? value : currentTeamId;
    const nextPositionId =
      field === "positionId" ? value : currentPositionId;

    if (!nextTeamId && !nextPositionId) {
      deleteUserMappingMutation.mutate({
        userId: Number(targetUser.id),
      });
      return;
    }

    upsertUserMappingMutation.mutate({
      userId: Number(targetUser.id),
      teamId: nextTeamId ? Number(nextTeamId) : null,
      positionId: nextPositionId ? Number(nextPositionId) : null,
      sortOrder: Number(targetUser.orgSortOrder ?? 0),
    });
  };

  const getMapping = (userId: number) => {
    const target = users?.find((item: any) => Number(item.id) === Number(userId));
    if (!target) return null;

    return {
      userId: Number(target.id),
      teamId: target.teamId ? String(target.teamId) : null,
      positionId: target.positionId ? String(target.positionId) : null,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={userTab === "create" ? "default" : "outline"}
          onClick={() => setUserTab("create")}
        >
          직원 생성
        </Button>
        <Button
          variant={userTab === "list" ? "default" : "outline"}
          onClick={() => setUserTab("list")}
        >
          직원 목록
        </Button>
        <Button
          variant={userTab === "role" ? "default" : "outline"}
          onClick={() => setUserTab("role")}
        >
          권한 변경
        </Button>
        <Button
          variant={userTab === "password" ? "default" : "outline"}
          onClick={() => setUserTab("password")}
          className="gap-2"
        >
          <KeyRound className="h-4 w-4" />
          비밀번호 재설정
        </Button>
        <Button
          variant={userTab === "organization" ? "default" : "outline"}
          onClick={() => setUserTab("organization")}
          className="gap-2"
        >
          <Building2 className="h-4 w-4" />
          조직 설정
        </Button>
      </div>

      {userTab === "create" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>직원 계정 생성</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
  <Input
    placeholder="아이디(username)"
    value={username}
    onChange={(e) => setUsername(e.target.value.trim())}
  />

  {usernameCheckStatus === "checking" && (
    <p className="text-xs text-muted-foreground">
      아이디 중복 확인 중...
    </p>
  )}

  {usernameCheckStatus === "available" && (
    <p className="text-xs text-emerald-600">
      사용 가능한 아이디입니다.
    </p>
  )}

  {usernameCheckStatus === "taken" && (
    <p className="text-xs text-red-500">
      이미 사용 중인 아이디입니다.
    </p>
  )}

  {username.trim() && username.trim().length < 3 && (
    <p className="text-xs text-amber-600">
      아이디는 3자 이상 입력해주세요.
    </p>
  )}
</div>
                <Input
                  placeholder="이름"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <Input
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Input
                  placeholder="전화번호"
                  value={phone}
                  onChange={(e) => setPhone(handlePhoneInput(e.target.value))}
                />
<Input
  type="date"
  placeholder="생년월일"
  value={birthday}
  onChange={(e) => setBirthday(e.target.value)}
/>
                <Input
                  type="password"
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Select
                  value={createRole}
                  onValueChange={(v: UserRole) => setCreateRole(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="권한 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="staff">직원</SelectItem>
                    <SelectItem value="admin">관리자</SelectItem>
                    <SelectItem value="host">호스트</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  placeholder="은행명"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
                <Input
                  placeholder="계좌번호"
                  value={bankAccount}
                  onChange={(e) => setBankAccount(e.target.value)}
                />
              </div>

              <div>
                <Button
                  onClick={handleCreate}
                 disabled={
  createMutation.isPending ||
  usernameCheckQuery.isFetching ||
  usernameCheckStatus === "taken"
}
                >
                  {createMutation.isPending ? "생성 중..." : "직원 계정 생성"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>담당자 일괄 변경</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                상담 DB에서 담당자를 일괄 변경하면 연결된 학생 담당자도 함께
                변경됩니다. 잠수 퇴사자 DB 이관용으로 사용하세요.
              </p>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">기존 담당자</p>
                  <Select
                    value={fromAssigneeId}
                    onValueChange={setFromAssigneeId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="기존 담당자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleUsers.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name || u.username || `#${u.id}`} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">변경할 담당자</p>
                  <Select value={toAssigneeId} onValueChange={setToAssigneeId}>
                    <SelectTrigger>
                      <SelectValue placeholder="변경할 담당자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      {visibleUsers.map((u: any) => (
                        <SelectItem key={u.id} value={String(u.id)}>
                          {u.name || u.username || `#${u.id}`} ({u.role})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Button
                  variant="destructive"
                  onClick={handleBulkReassign}
                  disabled={bulkReassignMutation.isPending}
                >
                  {bulkReassignMutation.isPending
                    ? "변경 중..."
                    : "담당자 일괄 변경"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {userTab === "list" && (
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>직원 목록</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={roleFilter === "all" ? "default" : "outline"}
                onClick={() => setRoleFilter("all")}
              >
                전체
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "host" ? "default" : "outline"}
                onClick={() => setRoleFilter("host")}
              >
                host
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "admin" ? "default" : "outline"}
                onClick={() => setRoleFilter("admin")}
              >
                admin
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "staff" ? "default" : "outline"}
                onClick={() => setRoleFilter("staff")}
              >
                staff
              </Button>
            </div>

            <Input
              placeholder="표시번호, 이름, 아이디, 이메일, 전화번호 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">
                불러오는 중...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                표시할 계정이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left">번호</th>
                      <th className="px-4 py-3 text-left">아이디</th>
                      <th className="px-4 py-3 text-left">이름</th>
                      <th className="px-4 py-3 text-left">이메일</th>
                      <th className="px-4 py-3 text-left">전화번호</th>
                      <th className="px-4 py-3 text-left">은행명</th>
                      <th className="px-4 py-3 text-left">계좌번호</th>
                      <th className="px-4 py-3 text-left">권한</th>
                      <th className="px-4 py-3 text-left">상태</th>
                      <th className="px-4 py-3 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u: any) => {
                      const isEditing = editingUserId === u.id;
                      const isProtected = isProtectedSuperhost(u);
                      const canEditProtected = canManageProtectedSuperhost(user);
                      const locked = isProtected && !canEditProtected;

                      return (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="px-4 py-3">{u.displayNo ?? u.id}</td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                              />
                            ) : (
                              u.username || "-"
                            )}
                          </td>

                          <td className="px-4 py-3">
  {isEditing ? (
    <Input
      value={editName}
      onChange={(e) => setEditName(e.target.value)}
    />
  ) : (
    <button
      type="button"
      className="font-medium text-blue-600 underline-offset-2 hover:underline"
      onClick={() => setSelectedPersonnelUserId(Number(u.id))}
    >
      {u.name || u.username || `#${u.id}`}
    </button>
  )}
</td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                              />
                            ) : (
                              u.email || "-"
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editPhone}
                                onChange={(e) =>
                                  setEditPhone(handlePhoneInput(e.target.value))
                                }
                              />
                            ) : (
                              formatPhone(u.phone || "")
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editBankName}
                                onChange={(e) =>
                                  setEditBankName(e.target.value)
                                }
                              />
                            ) : (
                              u.bankName || "-"
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editBankAccount}
                                onChange={(e) =>
                                  setEditBankAccount(e.target.value)
                                }
                              />
                            ) : (
                              u.bankAccount || "-"
                            )}
                          </td>

                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <span>{u.role || "-"}</span>
                              {isProtected ? (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                                  보호계정
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            {u.isActive ? (
                              <span className="font-medium text-emerald-600">
                                활성
                              </span>
                            ) : (
                              <span className="font-medium text-red-600">
                                비활성
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <Button
                                    size="sm"
                                    onClick={saveEdit}
                                    disabled={updateMutation.isPending}
                                  >
                                    저장
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                  >
                                    취소
                                  </Button>
                                </>
                              ) : locked ? (
                                <span className="text-xs text-muted-foreground">
                                  superhost 보호 계정
                                </span>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => startEdit(u)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    수정
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => handleToggleActive(u)}
                                  >
                                    {u.isActive ? (
                                      <>
                                        <UserX className="h-3.5 w-3.5" />
                                        비활성화
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="h-3.5 w-3.5" />
                                        활성화
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

{selectedPersonnelUserId ? (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">직원 상세 정보</h2>
          <p className="text-sm text-muted-foreground">
            직원 생성 정보, 조직 정보, 근속 기간, 월별 매출 이력을 확인합니다.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => setSelectedPersonnelUserId(null)}
        >
          닫기
        </Button>
      </div>

      {personnelDetailLoading ? (
        <div className="text-sm text-muted-foreground">불러오는 중...</div>
      ) : !personnelDetail?.profile ? (
        <div className="text-sm text-muted-foreground">
          직원 정보를 찾을 수 없습니다.
        </div>
      ) : (
        <>
          {(() => {
            const profile = (personnelDetail as any).profile;
            const total = (personnelDetail as any).totalRevenue || {};
            const monthly = (personnelDetail as any).monthlyRevenue || [];

            return (
              <div className="space-y-6">
                <div className="grid gap-4 md:grid-cols-[220px_1fr]">
                  <Card>
                    <CardContent className="flex flex-col items-center p-5 text-center">
                      {profile.profileImageUrl ? (
                        <img
                          src={normalizeAssetUrl(profile.profileImageUrl)}
                          alt="직원 프로필"
                          className="h-28 w-28 rounded-full border object-cover"
                        />
                      ) : (
                        <div className="flex h-28 w-28 items-center justify-center rounded-full bg-slate-100 text-3xl font-bold text-slate-500">
                          {profile.name?.[0] || profile.username?.[0] || "U"}
                        </div>
                      )}

                      <div className="mt-3 text-lg font-bold">
                        {profile.name || "-"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {profile.teamName || "부서 미지정"} /{" "}
                        {profile.positionName || "직급 미지정"}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        입사일 {formatDate(profile.createdAt)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        근속 {calcWorkDays(profile.createdAt)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="grid gap-3 p-5 md:grid-cols-2">
                      <InfoRow label="표시번호" value={profile.displayNo ?? profile.id} />
                      <InfoRow label="아이디" value={profile.username} />
                      <InfoRow label="이름" value={profile.name} />
                      <InfoRow label="이메일" value={profile.email} />
                      <InfoRow label="전화번호" value={formatPhone(profile.phone || "")} />
                      <InfoRow label="생년월일" value={formatDate(profile.birthday)} />
                      <InfoRow label="권한" value={roleLabel(profile.role)} />
                      <InfoRow label="상태" value={profile.isActive ? "활성" : "비활성"} />
                      <InfoRow label="은행명" value={profile.bankName} />
                      <InfoRow label="계좌번호" value={profile.bankAccount} />
                    </CardContent>
                  </Card>
                </div>

                <div className="grid gap-3 md:grid-cols-4">
                  <SummaryBox label="총매출" value={formatMoney(total.grossAmount)} />
                  <SummaryBox label="회사순이익" value={formatMoney(total.companyProfit)} />
                  <SummaryBox label="프리랜서금액" value={formatMoney(total.freelancerAmount)} />
                  <SummaryBox label="최종지급액" value={formatMoney(total.finalPayoutAmount)} />
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>월별 매출 이력</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {monthly.length === 0 ? (
                      <div className="text-sm text-muted-foreground">
                        매출 이력이 없습니다.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-muted/50">
                              <th className="px-3 py-2 text-left">월</th>
                              <th className="px-3 py-2 text-right">건수</th>
                              <th className="px-3 py-2 text-right">총매출</th>
                              <th className="px-3 py-2 text-right">회사몫</th>
                              <th className="px-3 py-2 text-right">회사순이익</th>
                              <th className="px-3 py-2 text-right">프리랜서</th>
                              <th className="px-3 py-2 text-right">세금</th>
                              <th className="px-3 py-2 text-right">최종지급</th>
                              <th className="px-3 py-2 text-right">환불</th>
                            </tr>
                          </thead>
                          <tbody>
                            {monthly.map((row: any) => (
                              <tr key={row.month} className="border-b last:border-0">
                                <td className="px-3 py-2">{row.month}</td>
                                <td className="px-3 py-2 text-right">
                                  {Number(row.itemCount || 0).toLocaleString()}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatMoney(row.grossAmount)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatMoney(row.companyAmount)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatMoney(row.companyProfit)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatMoney(row.freelancerAmount)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatMoney(row.taxAmount)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatMoney(row.finalPayoutAmount)}
                                </td>
                                <td className="px-3 py-2 text-right">
                                  {formatMoney(row.refundAmount)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            );
          })()}
        </>
      )}
    </div>
  </div>
) : null}

      {userTab === "role" && (
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>권한 변경</CardTitle>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={roleFilter === "all" ? "default" : "outline"}
                onClick={() => setRoleFilter("all")}
              >
                전체
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "host" ? "default" : "outline"}
                onClick={() => setRoleFilter("host")}
              >
                host
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "admin" ? "default" : "outline"}
                onClick={() => setRoleFilter("admin")}
              >
                admin
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "staff" ? "default" : "outline"}
                onClick={() => setRoleFilter("staff")}
              >
                staff
              </Button>
            </div>

            <Input
              placeholder="표시번호, 이름, 아이디, 전화번호 검색"
              value={roleSearchTerm}
              onChange={(e) => setRoleSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">
                불러오는 중...
              </div>
            ) : roleTabUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                표시할 계정이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left">번호</th>
                      <th className="px-4 py-3 text-left">이름</th>
                      <th className="px-4 py-3 text-left">아이디</th>
                      <th className="px-4 py-3 text-left">전화번호</th>
                      <th className="px-4 py-3 text-left">현재 권한</th>
                      <th className="px-4 py-3 text-left">변경 권한</th>
                      <th className="px-4 py-3 text-right">처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roleTabUsers.map((u: any) => {
                      const isProtected = isProtectedSuperhost(u);
                      const canEditProtected = canManageProtectedSuperhost(user);
                      const locked = isProtected && !canEditProtected;

                      return (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="px-4 py-3">{u.displayNo ?? u.id}</td>
                          <td className="px-4 py-3">{u.name || "-"}</td>
                          <td className="px-4 py-3">{u.username || "-"}</td>
                          <td className="px-4 py-3">
                            {formatPhone(u.phone || "") || "-"}
                          </td>
                          <td className="px-4 py-3">{u.role || "-"}</td>
                          <td className="px-4 py-3">
                            {locked ? (
                              <span className="text-xs text-muted-foreground">
                                superhost 보호 계정
                              </span>
                            ) : (
                              <Select
                                value={roleDrafts[u.id] ?? u.role}
                                onValueChange={(v: UserRole) =>
                                  setRoleDrafts((prev) => ({
                                    ...prev,
                                    [u.id]: v,
                                  }))
                                }
                              >
                                <SelectTrigger className="w-[160px]">
                                  <SelectValue placeholder="권한 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="staff">직원</SelectItem>
                                  <SelectItem value="admin">관리자</SelectItem>
                                  <SelectItem value="host">호스트</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => handleChangeRole(u)}
                              disabled={locked || updateRoleMutation.isPending}
                            >
                              변경
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {userTab === "password" && (
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>비밀번호 재설정</CardTitle>
            <p className="text-sm text-muted-foreground">
              기존 비밀번호는 확인할 수 없고, 새 비밀번호 입력 후 재설정만
              가능합니다.
            </p>

            <Input
              placeholder="표시번호, 이름, 아이디, 전화번호 검색"
              value={passwordSearch}
              onChange={(e) => setPasswordSearch(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">
                불러오는 중...
              </div>
            ) : passwordFilteredUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                검색 결과가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left">번호</th>
                      <th className="px-4 py-3 text-left">이름</th>
                      <th className="px-4 py-3 text-left">아이디</th>
                      <th className="px-4 py-3 text-left">전화번호</th>
                      <th className="px-4 py-3 text-left">권한</th>
                      <th className="px-4 py-3 text-left">새 비밀번호</th>
                      <th className="px-4 py-3 text-right">처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passwordFilteredUsers.map((u: any) => {
                      const isProtected = isProtectedSuperhost(u);
                      const canEditProtected = canManageProtectedSuperhost(user);
                      const locked = isProtected && !canEditProtected;

                      return (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="px-4 py-3">{u.displayNo ?? u.id}</td>
                          <td className="px-4 py-3">{u.name || "-"}</td>
                          <td className="px-4 py-3">{u.username || "-"}</td>
                          <td className="px-4 py-3">
                            {formatPhone(u.phone || "") || "-"}
                          </td>
                          <td className="px-4 py-3">{u.role || "-"}</td>
                          <td className="px-4 py-3">
                            {locked ? (
                              <span className="text-xs text-muted-foreground">
                                superhost 보호 계정
                              </span>
                            ) : (
                              <Input
                                type="password"
                                placeholder="새 비밀번호 입력"
                                value={passwordDrafts[u.id] || ""}
                                onChange={(e) =>
                                  setPasswordDrafts((prev) => ({
                                    ...prev,
                                    [u.id]: e.target.value,
                                  }))
                                }
                              />
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => handleResetPassword(u)}
                              disabled={locked || updateMutation.isPending}
                            >
                              변경
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {userTab === "organization" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>조직 설정 안내</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>조직 설정은 이제 서버 DB 기준으로 저장됩니다.</p>
              <p>
                팀 / 직급 / 유저별 조직 매핑은 즉시 반영되며, 메신저와
                조직도에서 공통으로 사용됩니다.
              </p>
              <p>
                조직 개편과 팀 구조 변경은 회사 호스트가 직접 관리합니다.
              </p>

              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
  팀 / 직급 / 유저 매핑은 호스트가 직접 수정할 수 있습니다.
</div>
            </CardContent>
          </Card>

          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>팀 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="예: 1팀, 2팀, 운영팀"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    disabled={!canManageOrganization}
                  />
                  <Button
                    type="button"
                    onClick={addTeam}
                    className="gap-2"
                    disabled={!canManageOrganization}
                  >
                    <Plus className="h-4 w-4" />
                    추가
                  </Button>
                </div>

                <div className="space-y-3">
                  {sortedTeams.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      등록된 팀이 없습니다.
                    </div>
                  ) : (
                    sortedTeams.map((team, index) => (
                      <div key={team.id} className="flex items-center gap-2">
                        <div className="w-12 text-sm text-muted-foreground">
                          {index + 1}
                        </div>
                        <Input
                          defaultValue={team.name}
                          disabled={!canManageOrganization}
                          onBlur={(e) => {
                            if (!canManageOrganization) return;
                            const nextName = e.target.value.trim();
                            if (!nextName || nextName === team.name) return;
                            updateTeamMutation.mutate({
                              id: Number(team.id),
                              name: nextName,
                              sortOrder: team.sortOrder,
                              isActive: team.isActive,
                            });
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeTeam(team.id)}
                          disabled={!canManageOrganization}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>직급 설정</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="예: 사원, 주임, 대리"
                    value={newPositionName}
                    onChange={(e) => setNewPositionName(e.target.value)}
                    disabled={!canManageOrganization}
                  />
                  <Button
                    type="button"
                    onClick={addPosition}
                    className="gap-2"
                    disabled={!canManageOrganization}
                  >
                    <Plus className="h-4 w-4" />
                    추가
                  </Button>
                </div>

                <div className="space-y-3">
                  {sortedPositions.length === 0 ? (
                    <div className="text-sm text-muted-foreground">
                      등록된 직급이 없습니다.
                    </div>
                  ) : (
                    sortedPositions.map((position, index) => (
                      <div
                        key={position.id}
                        className="flex items-center gap-2"
                      >
                        <div className="w-12 text-sm text-muted-foreground">
                          {index + 1}
                        </div>
                        <Input
                          defaultValue={position.name}
                          disabled={!canManageOrganization}
                          onBlur={(e) => {
                            if (!canManageOrganization) return;
                            const nextName = e.target.value.trim();
                            if (!nextName || nextName === position.name) return;
                            updatePositionMutation.mutate({
                              id: Number(position.id),
                              name: nextName,
                              sortOrder: position.sortOrder,
                              isActive: position.isActive,
                            });
                          }}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removePosition(position.id)}
                          disabled={!canManageOrganization}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>유저별 팀 / 직급 매핑</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-sm text-muted-foreground">
                  불러오는 중...
                </div>
              ) : !users || users.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  표시할 직원이 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="px-4 py-3 text-left">번호</th>
                        <th className="px-4 py-3 text-left">이름</th>
                        <th className="px-4 py-3 text-left">아이디</th>
                        <th className="px-4 py-3 text-left">권한</th>
                        <th className="px-4 py-3 text-left">팀</th>
                        <th className="px-4 py-3 text-left">직급</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleUsers.map((u: any) => {
                        const mapping = getMapping(u.id);
                        const rowLocked =
                          !canManageOrganization || isProtectedSuperhost(u);

                        return (
                          <tr key={u.id} className="border-b last:border-0">
                            <td className="px-4 py-3">{u.displayNo ?? u.id}</td>
                            <td className="px-4 py-3">{u.name || "-"}</td>
                            <td className="px-4 py-3">{u.username || "-"}</td>
                            <td className="px-4 py-3">{roleLabel(u.role)}</td>
                            <td className="px-4 py-3">
                              <Select
                                value={mapping?.teamId ?? "none"}
                                onValueChange={(value) => {
                                  if (rowLocked) return;
                                  updateUserMapping(
                                    u,
                                    "teamId",
                                    value === "none" ? null : value
                                  );
                                }}
                                disabled={rowLocked}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue placeholder="팀 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">미지정</SelectItem>
                                  {sortedTeams.map((team) => (
                                    <SelectItem
                                      key={team.id}
                                      value={String(team.id)}
                                    >
                                      {team.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                            <td className="px-4 py-3">
                              <Select
                                value={mapping?.positionId ?? "none"}
                                onValueChange={(value) => {
                                  if (rowLocked) return;
                                  updateUserMapping(
                                    u,
                                    "positionId",
                                    value === "none" ? null : value
                                  );
                                }}
                                disabled={rowLocked}
                              >
                                <SelectTrigger className="w-[180px]">
                                  <SelectValue placeholder="직급 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">미지정</SelectItem>
                                  {sortedPositions.map((position) => (
                                    <SelectItem
                                      key={position.id}
                                      value={String(position.id)}
                                    >
                                      {position.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="mt-4 flex justify-end text-sm text-muted-foreground">
                팀 / 직급 / 유저 매핑은 변경 즉시 서버에 저장됩니다.
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>조직표 미리보기</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {sortedTeams.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  팀이 없습니다.
                </div>
              ) : (
                sortedTeams.map((team) => {
                  const members = (users ?? [])
                    .filter((u: any) => getMapping(u.id)?.teamId === team.id)
                    .sort((a: any, b: any) => {
                      const aSort =
                        positionMap.get(getMapping(a.id)?.positionId ?? "")
                          ?.sortOrder ?? 999;
                      const bSort =
                        positionMap.get(getMapping(b.id)?.positionId ?? "")
                          ?.sortOrder ?? 999;
                      return (
                        aSort -
                          bSort ||
                        String(a.name ?? "").localeCompare(
                          String(b.name ?? "")
                        )
                      );
                    });

                  return (
                    <div key={team.id} className="rounded-xl border p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <h3 className="font-semibold">{team.name}</h3>
                        <span className="text-xs text-muted-foreground">
                          {members.length}명
                        </span>
                      </div>

                      {members.length === 0 ? (
                        <div className="text-sm text-muted-foreground">
                          배정된 인원이 없습니다.
                        </div>
                      ) : (
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {members.map((member: any) => {
                            const mapping = getMapping(member.id);
                            const positionName = mapping?.positionId
                              ? positionMap.get(mapping.positionId)?.name
                              : null;

                            return (
                              <div
                                key={member.id}
                                className="rounded-lg border bg-muted/20 px-3 py-2 text-sm"
                              >
                                <div className="font-medium">
                                  {member.name ||
                                    member.username ||
                                    `#${member.id}`}
                                </div>
                                <div className="text-muted-foreground">
                                  {positionName || "직급 미지정"} /{" "}
                                  {roleLabel(member.role)}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value || "-"}</div>
    </div>
  );
}

function SummaryBox({ label, value }: { label: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-lg font-bold">{value || "0원"}</div>
      </CardContent>
    </Card>
  );
}

function LeadFormManagementSection() {
  return (
    <BaseFormManagementSection
      title="랜딩폼"
      formType="landing"
      pathPrefix="/form"
    />
  );
}

function AdFormManagementSection() {
  return (
    <BaseFormManagementSection
      title="광고폼"
      formType="ad"
      pathPrefix="/ad-form"
    />
  );
}

function BaseFormManagementSection({
  title,
  formType,
  pathPrefix,
}: {
  title: string;
  formType: "landing" | "ad";
  pathPrefix: "/form" | "/ad-form";
}) {
  const utils = trpc.useUtils();

  const { data: forms = [], isLoading } = trpc.formAdmin.list.useQuery({
    formType,
  });

  const { data: users = [] } = trpc.users.list.useQuery();

  const { data: templateData, isLoading: templateLoading } =
    trpc.formAdmin.getTemplate.useQuery(
      { formType },
      { staleTime: 0 }
    );

  const [assigneeId, setAssigneeId] = useState("");
  const [defaultEditorOpen, setDefaultEditorOpen] = useState(false);

  const [defaultDraft, setDefaultDraft] = useState<UiConfig>(() => {
    const base = createDefaultPublicFormUiConfig(formType) as unknown as UiConfig;

    return {
      ...base,
      canvas: createDefaultCompanyCanvasConfig(),
    };
  });

  useEffect(() => {
    const base = createDefaultPublicFormUiConfig(formType) as unknown as UiConfig;
    const saved = (templateData?.uiConfig || {}) as Partial<UiConfig>;

    setDefaultDraft({
      ...base,
      ...saved,
      canvas:
        saved.canvas &&
        Array.isArray(saved.canvas.elements) &&
        saved.canvas.elements.length > 0
          ? {
              ...createDefaultCompanyCanvasConfig(),
              ...saved.canvas,
              enabled: true,
              elements: saved.canvas.elements,
            }
          : createDefaultCompanyCanvasConfig(),
      fields: Array.isArray(saved.fields) && saved.fields.length > 0
        ? saved.fields
        : base.fields,
      mapping:
        saved.mapping && typeof saved.mapping === "object"
          ? saved.mapping
          : base.mapping,
    });
  }, [templateData?.uiConfig, formType]);

  const createMutation = trpc.formAdmin.create.useMutation({
    onSuccess: async () => {
      toast.success(`${title} 링크가 생성되었습니다.`);
      setAssigneeId("");
      await utils.formAdmin.list.invalidate({ formType });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateActiveMutation = trpc.formAdmin.updateActive.useMutation({
    onSuccess: async () => {
      await utils.formAdmin.list.invalidate({ formType });
    },
    onError: (e) => toast.error(e.message),
  });

  const saveTemplateMutation = trpc.formAdmin.saveTemplate.useMutation({
    onSuccess: async () => {
      toast.success(
        title === "랜딩폼"
          ? "랜딩폼 기본 디자인이 저장되었습니다."
          : "광고폼 기본 디자인이 저장되었습니다."
      );

      await utils.formAdmin.getTemplate.invalidate({ formType });
      setDefaultEditorOpen(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const sortedUsers = useMemo(() => {
    return [...users].sort((a: any, b: any) =>
      String(a.name || a.username || "").localeCompare(
        String(b.name || b.username || "")
      )
    );
  }, [users]);

  const sortedForms = useMemo(() => {
    return [...forms].sort(
      (a: any, b: any) => Number(b.id || 0) - Number(a.id || 0)
    );
  }, [forms]);

  const getAssigneeName = (id: any) => {
    const found = users.find((u: any) => Number(u.id) === Number(id));
    return found?.name || found?.username || `#${id}`;
  };

const getAssignee = (id: any) => {
  return users.find((u: any) => Number(u.id) === Number(id));
};

  const handleCreate = () => {
    if (!assigneeId) {
      toast.error("담당자를 선택해주세요.");
      return;
    }

    createMutation.mutate({
      assigneeId: Number(assigneeId),
      formType,
    });
  };

  const handleUploadCanvasImage = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      throw new Error("이미지는 5MB 이하만 업로드할 수 있습니다.");
    }

    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch("/api/upload", {
  method: "POST",
  body: formData,
  credentials: "include",
});

    if (!uploadRes.ok) {
      throw new Error("이미지 업로드에 실패했습니다.");
    }

    const uploaded = await uploadRes.json();
    const uploadedUrl = uploaded?.fileUrl || uploaded?.url || "";

    if (!uploadedUrl) {
      throw new Error("업로드 URL을 찾을 수 없습니다.");
    }

    return uploadedUrl;
  };

  const handleSaveDefaultDesign = () => {
  const canvas =
    defaultDraft.canvas &&
    Array.isArray(defaultDraft.canvas.elements) &&
    defaultDraft.canvas.elements.length > 0
      ? defaultDraft.canvas
      : createDefaultCompanyCanvasConfig();

  const titleElement = canvas.elements.find((el: any) =>
    String(el.id || "").includes("title")
  );

  const subtitleElement = canvas.elements.find((el: any) =>
    String(el.id || "").includes("subtitle")
  );

  saveTemplateMutation.mutate({
    formType,
    uiConfig: {
      ...defaultDraft,
      title:
        String((titleElement as any)?.text || "").trim() ||
        defaultDraft.title ||
        "학점은행제 맞춤 상담 신청",
      subtitle:
        String((subtitleElement as any)?.text || "").trim() ||
        defaultDraft.subtitle ||
        "전문 담당자가 학습 상황에 맞춰 무료로 안내드립니다.",
      canvas,
    } as any,
  });
};

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{title} 기본 디자인</CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="font-semibold">
  학점은행제 맞춤 상담 신청
</div>
            <p className="text-sm text-muted-foreground">
              새 {title} 링크를 만들 때 기본으로 복사되는 디자인입니다.
            </p>
            <p className="text-xs text-muted-foreground">
              담당자가 자기 페이지를 수정해도 이 기본 디자인은 변경되지 않습니다.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => setDefaultEditorOpen(true)}
            disabled={templateLoading}
          >
            기본 디자인 꾸미기
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{title} 링크 생성</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_auto]">
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger>
                <SelectValue placeholder="담당자 선택" />
              </SelectTrigger>

              <SelectContent>
                {sortedUsers.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>
  {u.name || "-"} / {u.username || u.openId || `#${u.id}`} ({u.role})
</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              type="button"
              onClick={handleCreate}
              disabled={!assigneeId || createMutation.isPending}
            >
              {createMutation.isPending ? "생성 중..." : `${title} 링크 생성`}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground">
            생성된 링크는 현재 저장된 기본 디자인을 복사해서 담당자 전용 페이지로 만들어집니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>생성된 {title} 링크</CardTitle>
        </CardHeader>

        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">불러오는 중...</div>
          ) : sortedForms.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              생성된 {title} 링크가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left">담당자</th>
<th className="px-4 py-3 text-left">아이디</th>
<th className="px-4 py-3 text-left">전화번호</th>
<th className="px-4 py-3 text-left">직급/권한</th>
<th className="px-4 py-3 text-left">링크</th>
<th className="px-4 py-3 text-left">상태</th>
<th className="px-4 py-3 text-right">관리</th>
                  </tr>
                </thead>

                <tbody>
                  {sortedForms.map((form: any) => {
  const url = `${window.location.origin}${pathPrefix}/${form.token}`;
  const assignee = getAssignee(form.assigneeId);

  return (
                      <tr key={form.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          {getAssigneeName(form.assigneeId)}
                        </td>

<td className="px-4 py-3">
  {assignee?.username || "-"}
</td>

<td className="px-4 py-3">
  {formatPhone(assignee?.phone || "") || "-"}
</td>

<td className="px-4 py-3">
  <div className="flex flex-col">
    <span>{assignee?.positionName || assignee?.position || "-"}</span>
    <span className="text-xs text-muted-foreground">
      {assignee?.role || "-"}
    </span>
  </div>
</td>

                        <td className="px-4 py-3">
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 underline"
                          >
                            {url}
                          </a>
                        </td>

                        <td className="px-4 py-3">
                          {form.isActive ? (
                            <span className="font-medium text-emerald-600">
                              활성
                            </span>
                          ) : (
                            <span className="font-medium text-red-600">
                              비활성
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              updateActiveMutation.mutate({
                                id: Number(form.id),
                                isActive: !form.isActive,
                              })
                            }
                            disabled={updateActiveMutation.isPending}
                          >
                            {form.isActive ? "비활성화" : "활성화"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {defaultEditorOpen ? (
        <FullScreenFormCanvasEditor
  value={defaultDraft}
  onChange={setDefaultDraft}
  onSave={handleSaveDefaultDesign}
  onClose={() => setDefaultEditorOpen(false)}
  onUploadCanvasImage={handleUploadCanvasImage}
  isHostEditor
  renderFormPreview={() => {
    const fields = Array.isArray(defaultDraft.fields)
      ? defaultDraft.fields
      : [];

    const sortedFields = [...fields]
      .filter((field: any) => !field.hidden)
      .sort((a: any, b: any) => Number(a.order || 0) - Number(b.order || 0));

    const safeColor =
      /^#([0-9A-F]{3}){1,2}$/i.test(defaultDraft.primaryColor || "")
        ? defaultDraft.primaryColor
        : "#5fc065";

    const isAd = formType === "ad";

    const renderPreviewField = (field: any) => {
      if (field.type === "checkbox") {
        return (
          <label
            key={field.fieldKey}
            className={isAd ? "ad-form-agree" : "lead-form-agree"}
          >
            <input type="checkbox" readOnly checked={false} />
            <span>{defaultDraft.agreementText || field.label}</span>
          </label>
        );
      }

      if (field.type === "textarea") {
        return (
          <textarea
            key={field.fieldKey}
            className={isAd ? "ad-form-textarea" : "lead-form-textarea"}
            value=""
            readOnly
            placeholder={field.placeholder || field.label}
          />
        );
      }

      if (field.type === "select") {
        if (isAd) {
          return (
            <select
              key={field.fieldKey}
              className="premium-select"
              value=""
              disabled
            >
              <option value="">
                {field.placeholder || `${field.label} 선택`}
              </option>
            </select>
          );
        }

        return (
          <div key={field.fieldKey} className="lead-form-select-wrap">
            <select className="lead-form-select" value="" disabled>
              <option value="">
                {field.placeholder || `${field.label} 선택`}
              </option>
            </select>
            <span className="lead-form-select-arrow">⌄</span>
          </div>
        );
      }

      return (
        <input
          key={field.fieldKey}
          className="premium-input"
          value=""
          readOnly
          placeholder={field.placeholder || field.label}
        />
      );
    };

    return (
      <form
        className={isAd ? "premium-form-card" : "lead-form-body"}
        style={{
          width: "100%",
          minHeight: "100%",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 0,
          margin: 0,
        }}
      >
        {sortedFields.map(renderPreviewField)}

        <button
          type="button"
          className="premium-submit-button"
          style={{ backgroundColor: safeColor }}
        >
          {defaultDraft.submitButtonText || "무료 상담 신청하기"}
        </button>
      </form>
    );
  }}
/>
      ) : null}
    </div>
  );
}

function SettingsSection() {

const { user } = useAuth();
const isSuperhostBackupBlocked = user?.role === "superhost";
const { data: organizationFeatures } =
  trpc.organizationFeatures.useQuery(undefined, {
    enabled: user?.role !== "superhost",
  });

const canUseBackup =
  user?.role !== "superhost" && organizationFeatures?.allowBackup !== false;

const canUseAuditLog =
  user?.role === "superhost" || organizationFeatures?.allowAuditLog !== false;
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.branding.get.useQuery();

  const saveMutation = trpc.branding.save.useMutation({
  onSuccess: async () => {
    toast.success("브랜딩 설정이 저장되었습니다.");
    

await Promise.all([
  utils.branding.get.invalidate(),
  utils.branding.getPublic.invalidate(),
]);

    window.dispatchEvent(
      new CustomEvent("branding:updated", {
        detail: {
          companyName,
          companyLogoUrl,
          messengerSubtitle,
        },
      })
    );
  },
  onError: (e) => {
    toast.error(e.message || "브랜딩 저장 중 오류가 발생했습니다.");
  },
});

  const [companyName, setCompanyName] = useState("");
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [messengerSubtitle, setMessengerSubtitle] = useState("");
const fileInputRef = useRef<HTMLInputElement | null>(null);
const [isUploadingLogo, setIsUploadingLogo] = useState(false);
const previewLogoUrl = normalizeAssetUrl(companyLogoUrl || "");
const [notificationSettings, setNotificationSettings] =
  useState<AppNotificationSettings>(() => readAppNotificationSettings());

const backupExcelExportMut = trpc.backup.exportExcel.useMutation();

const downloadBase64File = (params: {
  base64: string;
  fileName: string;
  mimeType: string;
}) => {
  const binary = window.atob(params.base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  const blob = new Blob([bytes], {
    type: params.mimeType,
  });

  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = params.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();

  window.URL.revokeObjectURL(url);
};

const [auditActionFilter, setAuditActionFilter] = useState("");
const [auditTargetTypeFilter, setAuditTargetTypeFilter] = useState("");

const auditLogsQuery = trpc.audit.list.useQuery(
  {
    action: auditActionFilter || undefined,
    targetType: auditTargetTypeFilter || undefined,
limit: 100,
  },
  {
    enabled: canUseAuditLog,
  }
);

const deletedConsultationsQuery = trpc.consultation.listDeleted.useQuery({
  limit: 100,
});

const restoreConsultationMut = trpc.consultation.restore.useMutation({
  onSuccess: async () => {
  toast.success("상담DB가 복구되었습니다.");

  await utils.consultation.list.invalidate();
  await utils.consultation.listDeleted.invalidate();
},
  onError: (e) => toast.error(e.message),
});

const updateNotificationSetting = (
  key: keyof AppNotificationSettings,
  value: any
) => {
  const next = updateAppNotificationSettings({ [key]: value });
  setNotificationSettings(next);
};

  useEffect(() => {
    if (!data) return;
    setCompanyName(data.companyName || "");
    setCompanyLogoUrl(data.companyLogoUrl || "");
    setMessengerSubtitle(data.messengerSubtitle || "사내 메신저");
  }, [data]);

useEffect(() => {
  const syncNotificationSettings = () => {
    setNotificationSettings(readAppNotificationSettings());
  };

  syncNotificationSettings();
  window.addEventListener(
    "app:notification-settings-changed",
    syncNotificationSettings
  );

  return () => {
    window.removeEventListener(
      "app:notification-settings-changed",
      syncNotificationSettings
    );
  };
}, []);

const handleUploadLogo = async (e: ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;

  try {
    setIsUploadingLogo(true);

    const formData = new FormData();
    formData.append("file", file);

    const uploadRes = await fetch("/api/upload", {
  method: "POST",
  body: formData,
  credentials: "include",
});

    if (!uploadRes.ok) {
      throw new Error("로고 업로드에 실패했습니다.");
    }

    const uploaded = await uploadRes.json();
    const uploadedUrl = uploaded?.fileUrl || uploaded?.url || "";

    if (!uploadedUrl) {
      throw new Error("업로드 URL을 찾을 수 없습니다.");
    }

    setCompanyLogoUrl(uploadedUrl);

saveMutation.mutate({
  companyName: companyName.trim() || "위드원 교육",
  companyLogoUrl: uploadedUrl,
  messengerSubtitle: messengerSubtitle.trim() || "사내 메신저",
});

toast.success("로고 업로드 완료");
  } catch (err: any) {
    toast.error(err?.message || "로고 업로드 중 오류가 발생했습니다.");
  } finally {
    setIsUploadingLogo(false);
    if (e.target) e.target.value = "";
  }
};

  const handleSave = () => {
    if (!companyName.trim()) {
      toast.error("회사명을 입력해주세요.");
      return;
    }

    if (!messengerSubtitle.trim()) {
      toast.error("메신저 부제목을 입력해주세요.");
      return;
    }

    saveMutation.mutate({
      companyName: companyName.trim(),
      companyLogoUrl: companyLogoUrl.trim() || null,
      messengerSubtitle: messengerSubtitle.trim(),
    });
  };

const handleExportExcelBackup = async () => {
  const ok = window.confirm(
    "현재 회사 업무 데이터를 엑셀 파일로 다운로드하시겠습니까?"
  );

  if (!ok) return;

  try {
    const result = await backupExcelExportMut.mutateAsync();

    if (!result?.base64 || !result?.fileName) {
      toast.error("엑셀 파일 생성 결과가 올바르지 않습니다.");
      return;
    }

    downloadBase64File({
      base64: result.base64,
      fileName: result.fileName,
      mimeType:
        result.mimeType ||
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    toast.success("회사 데이터 엑셀 다운로드 완료");
  } catch (e: any) {
    toast.error(e?.message || "엑셀 백업 다운로드 중 오류가 발생했습니다.");
  }
};

const getAuditActionLabel = (action: string | null | undefined) => {
  switch (action) {
    case "organization.excel_export.download":
      return "회사 데이터 엑셀 다운로드";

    case "organization.backup.download":
      return "회사 데이터 다운로드";

    case "organization.backup.create":
      return "회사 데이터 생성";

    case "organization.backup.restore":
      return "회사 데이터 복구";

    case "upload":
      return "파일 업로드";

    default:
      return action || "-";
  }
};

const getAuditTargetLabel = (targetType: string | null | undefined) => {
  switch (targetType) {
    case "organization":
      return "회사";

    case "organization_backup":
      return "회사 운영 데이터";

    case "student":
      return "학생";

    case "consultation":
      return "상담DB";

    case "refund":
      return "환불";

    case "settlement":
    case "settlement_item":
      return "정산";

    default:
      return targetType || "-";
  }
};

const getAuditRoleLabel = (role: string | null | undefined) => {
  switch (role) {
    case "host":
      return "호스트";

    case "admin":
      return "관리자";

    case "staff":
      return "직원";

    case "superhost":
      return "운영자";

    default:
      return role || "-";
  }
};

const getAuditMemoLabel = (memo: string | null | undefined) => {
  const text = String(memo || "").trim();

  if (!text) return "-";

  if (text.includes("회사 데이터 엑셀 내보내기")) {
    return "회사 운영 데이터를 엑셀로 다운로드했습니다.";
  }

  if (text.includes("회사 백업 다운로드 URL 발급")) {
    return "회사 운영 데이터를 다운로드했습니다.";
  }

  if (text.includes("회사 백업 생성")) {
    return "회사 운영 데이터 파일을 생성했습니다.";
  }

  if (text.includes("회사 백업 복구 완료")) {
    return "회사 운영 데이터 복구를 실행했습니다.";
  }

  return text;
};
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>브랜딩 관리</CardTitle>
        </CardHeader>

        <CardContent className="space-y-5">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">
              브랜딩 정보를 불러오는 중...
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm font-medium">회사명</p>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="예: 위드원 교육"
                  />
                </div>

                <div className="space-y-2">
                  <p className="text-sm font-medium">메신저 부제목</p>
                  <Input
                    value={messengerSubtitle}
                    onChange={(e) => setMessengerSubtitle(e.target.value)}
                    placeholder="예: 사내 메신저"
                  />
                </div>
              </div>

              <div className="space-y-3">
  <p className="text-sm font-medium">회사 로고</p>

  <div className="flex flex-wrap items-center gap-2">
    <Input
      value={companyLogoUrl}
      onChange={(e) => setCompanyLogoUrl(e.target.value)}
      placeholder="예: /uploads/company-logo.png 또는 https://..."
      className="max-w-[420px]"
    />

    <input
      ref={fileInputRef}
      type="file"
      accept="image/*"
      className="hidden"
      onChange={handleUploadLogo}
    />

    <Button
      type="button"
      variant="outline"
      onClick={() => fileInputRef.current?.click()}
      disabled={isUploadingLogo}
    >
      {isUploadingLogo ? "업로드 중..." : "로고 업로드"}
    </Button>
  </div>

  <p className="text-xs text-muted-foreground">
    이미지 업로드 또는 URL 직접 입력 둘 다 가능합니다.
  </p>
</div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-sm font-semibold text-slate-900">
                  미리보기
                </p>

                <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-yellow-300 text-slate-900">
                   {previewLogoUrl ? (
  <img
    src={previewLogoUrl}
    alt={companyName || "company-logo"}
    className="h-full w-full object-cover"
  />
) : (
  <Building2 className="h-5 w-5" />
)}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {companyName || "회사명"}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      {messengerSubtitle || "사내 메신저"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <Button
                  onClick={handleSave}
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "저장 중..." : "브랜딩 저장"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
            <Card>
        <CardHeader>
          <CardTitle>알림 설정</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-sm font-medium text-slate-900">
              메신저, 전자결재, 공지, 일정 알림과 방해금지 시간을 설정합니다.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              설정값은 현재 브라우저에 저장되며, 우하단 토스트 알림과 종벨 알림
              표시 조건에 함께 반영됩니다.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              알림 항목 ON / OFF
            </p>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {[
                {
                  key: "enabled",
                  label: "전체 알림",
                  desc: "모든 앱 알림의 전체 허용 여부",
                  value: notificationSettings.enabled,
                },
                {
                  key: "messenger",
                  label: "메신저 알림",
                  desc: "새 메시지 토스트 알림 표시",
                  value: notificationSettings.messenger,
                },
                {
                  key: "approval",
                  label: "전자결재 알림",
                  desc: "결재 요청 / 승인 / 반려 알림 표시",
                  value: notificationSettings.approval,
                },
                {
                  key: "notice",
                  label: "공지 알림",
                  desc: "일반 / 중요 / 긴급 공지 알림 표시",
                  value: notificationSettings.notice,
                },
                {
                  key: "schedule",
                  label: "일정 알림",
                  desc: "개인 / 전체 일정 알림 표시",
                  value: notificationSettings.schedule,
                },
                {
                  key: "sound",
                  label: "알림 소리",
                  desc: "지원되는 알림 소리 사용 여부",
                  value: notificationSettings.sound,
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() =>
                    updateNotificationSetting(
                      item.key as keyof AppNotificationSettings,
                      !item.value
                    )
                  }
                  className={`rounded-2xl border px-4 py-4 text-left transition ${
                    item.value
                      ? "border-primary/20 bg-primary/5"
                      : "border-slate-200 bg-white hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">
                        {item.label}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        {item.desc}
                      </p>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                        item.value
                          ? "bg-primary text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {item.value ? "ON" : "OFF"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  방해금지 모드
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  설정된 시간에는 우하단 토스트 알림을 띄우지 않습니다.
                  메신저 실시간 알림 차단 조건에도 함께 사용됩니다.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  updateNotificationSetting(
                    "dndEnabled",
                    !notificationSettings.dndEnabled
                  )
                }
                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                  notificationSettings.dndEnabled
                    ? "bg-primary text-white"
                    : "bg-slate-200 text-slate-700"
                }`}
              >
                {notificationSettings.dndEnabled ? "ON" : "OFF"}
              </button>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2">
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600">시작 시간</p>
                <Input
                  type="time"
                  value={notificationSettings.dndStart}
                  onChange={(e) =>
                    updateNotificationSetting("dndStart", e.target.value)
                  }
                  disabled={!notificationSettings.dndEnabled}
                />
              </div>

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-slate-600">종료 시간</p>
                <Input
                  type="time"
                  value={notificationSettings.dndEnd}
                  onChange={(e) =>
                    updateNotificationSetting("dndEnd", e.target.value)
                  }
                  disabled={!notificationSettings.dndEnabled}
                />
              </div>
            </div>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <p className="text-xs leading-5 text-slate-600">
                예: 시작 22:00, 종료 07:00 으로 설정하면 밤 10시부터 다음 날 오전
                7시까지 토스트 알림이 표시되지 않습니다.
              </p>
            </div>
          </div>
        </CardContent>
            </Card>

     <Card>
  <CardHeader>
    <CardTitle>회사 데이터 다운로드</CardTitle>
  </CardHeader>

  <CardContent className="space-y-4">
    {!canUseBackup ? (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
        현재 회사는 데이터 다운로드 기능을 사용할 수 없습니다.
        기능이 활성화된 회사 HOST 계정에서만 이용할 수 있습니다.
      </div>
    ) : (
      <>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
          <p className="text-sm font-medium text-slate-900">
            회사 운영 데이터 엑셀 다운로드
          </p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            상담DB, 학생관리, 학기/결제, 플랜과목, 전적대과목, 환불,
            실습배정, 민간자격증, 정산내역, 직원목록을 엑셀 파일로 다운로드합니다.
            내부 DB 테이블명, 컬럼명, 비밀번호 정보, 시스템 복구용 원문 데이터는 포함하지 않습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            onClick={handleExportExcelBackup}
            disabled={backupExcelExportMut.isPending}
          >
            {backupExcelExportMut.isPending
              ? "엑셀 생성 중..."
              : "회사 데이터 엑셀 다운로드"}
          </Button>
        </div>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-4 text-xs leading-5 text-blue-900">
          이 기능은 고객 보관용 데이터 내보내기입니다.
        </div>
      </>
    )}
  </CardContent>
</Card>

{!canUseAuditLog ? (
  <Card>
    <CardHeader>
      <CardTitle>감사 로그</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        현재 회사는 감사로그 기능을 사용할 수 없습니다.
      </p>
    </CardContent>
  </Card>
) : (
<Card>
  <CardHeader>
    <CardTitle>감사 로그</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="grid gap-3 md:grid-cols-3">
      <Input
        value={auditActionFilter}
        onChange={(e) => setAuditActionFilter(e.target.value)}
        placeholder="활동 검색 예: 다운로드, 업로드"
      />
      <Input
        value={auditTargetTypeFilter}
        onChange={(e) => setAuditTargetTypeFilter(e.target.value)}
        placeholder="대상 검색 예: 학생, 상담DB, 회사"
      />
      <Button onClick={() => auditLogsQuery.refetch()}>
        조회
      </Button>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left">시간</th>
            <th className="px-3 py-2 text-left">사용자</th>
            <th className="px-3 py-2 text-left">역할</th>
            <th className="px-3 py-2 text-left">액션</th>
            <th className="px-3 py-2 text-left">대상</th>
            <th className="px-3 py-2 text-left">메모</th>
          </tr>
        </thead>
        <tbody>
          {(auditLogsQuery.data || []).map((log: any) => (
            <tr key={log.id} className="border-b last:border-0">
              <td className="px-3 py-2 whitespace-nowrap">
                {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
              </td>
              <td className="px-3 py-2">{log.actorUserId || "-"}</td>
              <td className="px-3 py-2">{getAuditRoleLabel(log.actorRole)}</td>
<td className="px-3 py-2">{getAuditActionLabel(log.action)}</td>
<td className="px-3 py-2">{getAuditTargetLabel(log.targetType)}</td>
<td className="px-3 py-2">{getAuditMemoLabel(log.memo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </CardContent>
</Card>
)}

<Card>
  <CardHeader>
    <CardTitle>삭제된 상담DB</CardTitle>
  </CardHeader>
  <CardContent className="space-y-4">
    <div className="flex justify-end">
      <Button
        variant="outline"
        onClick={() => deletedConsultationsQuery.refetch()}
      >
        새로고침
      </Button>
    </div>

    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/50">
            <th className="px-3 py-2 text-left">삭제일</th>
            <th className="px-3 py-2 text-left">이름</th>
            <th className="px-3 py-2 text-left">연락처</th>
            <th className="px-3 py-2 text-left">희망과정</th>
            <th className="px-3 py-2 text-left">삭제자</th>
	<th className="px-3 py-2 text-right">관리</th>
          </tr>
        </thead>
        <tbody>
          {(deletedConsultationsQuery.data || []).map((item: any) => (
            <tr key={item.id} className="border-b last:border-0">
              <td className="px-3 py-2 whitespace-nowrap">
                {item.deletedAt
                  ? new Date(item.deletedAt).toLocaleString()
                  : "-"}
              </td>
              <td className="px-3 py-2">{item.clientName || "-"}</td>
              <td className="px-3 py-2">{item.phone || "-"}</td>
              <td className="px-3 py-2">{item.desiredCourse || "-"}</td>
<td className="px-3 py-2">{item.deletedBy || "-"}</td>

<td className="px-3 py-2 text-right">
  <Button
    size="sm"
    variant="outline"
    disabled={restoreConsultationMut.isPending}
    onClick={() => {
      const ok = window.confirm(
        `${item.clientName || "상담DB"} 데이터를 복구하시겠습니까?`
      );

      if (!ok) return;

      restoreConsultationMut.mutate({
        id: Number(item.id),
      });
    }}
  >
    복구
  </Button>
</td>
            </tr>
          ))}

          {!deletedConsultationsQuery.isLoading &&
            (deletedConsultationsQuery.data || []).length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-3 py-6 text-center text-muted-foreground"
                >
                  삭제된 상담DB가 없습니다.
                </td>
              </tr>
            )}
        </tbody>
      </table>
    </div>
  </CardContent>
</Card>
    </div>
  );
}