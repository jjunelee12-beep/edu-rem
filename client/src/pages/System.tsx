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
          호스트 또는 슈퍼호스트만 접근할 수 있습니다.
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
  settlementType: "credit" | "subject" | "fixed";
  normalSubjectPrice: string;
  unitCostAmount: string;
}>({
  settlementType: "credit",
  normalSubjectPrice: "75000",
  unitCostAmount: "0",
});

function shallowEqualInstitutionDraft(
  a: {
    settlementType: "credit" | "subject" | "fixed";
    normalSubjectPrice: string;
    unitCostAmount: string;
  },
  b: {
    settlementType: "credit" | "subject" | "fixed";
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
    settlementType: "credit" as const,
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
      (selected.settlementType as "credit" | "subject" | "fixed") || "credit",
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

    const freelancerUnitAmount = rateDrafts[String(positionId)] ?? "0";

    upsertRateMutation.mutate({
      educationInstitutionId: Number(selectedInstitutionId),
      positionId: Number(positionId),
      freelancerUnitAmount,
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
    settlementType: institutionDraft.settlementType,
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
          <Select
            value={institutionDraft.settlementType}
            onValueChange={(value: "credit" | "subject" | "fixed") =>
              setInstitutionDraft((prev) => ({
                ...prev,
                settlementType: value,
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="credit">학점 기준</SelectItem>
              <SelectItem value="subject">과목 기준</SelectItem>
              <SelectItem value="fixed">고정 금액</SelectItem>
            </SelectContent>
          </Select>
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
  const { user } = useAuth();
  const isSuperhostOnly = user?.role === "superhost";
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();

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
    onSuccess: () => {
      toast.success("팀이 추가되었습니다.");
      utils.org.teams.list.invalidate();
      setNewTeamName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateTeamMutation = trpc.org.teams.update.useMutation({
    onSuccess: () => {
      toast.success("팀 정보가 수정되었습니다.");
      utils.org.teams.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTeamMutation = trpc.org.teams.delete.useMutation({
    onSuccess: () => {
      toast.success("팀이 삭제되었습니다.");
      utils.org.teams.list.invalidate();
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const createPositionMutation = trpc.org.positions.create.useMutation({
    onSuccess: () => {
      toast.success("직급이 추가되었습니다.");
      utils.org.positions.list.invalidate();
      setNewPositionName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updatePositionMutation = trpc.org.positions.update.useMutation({
    onSuccess: () => {
      toast.success("직급 정보가 수정되었습니다.");
      utils.org.positions.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deletePositionMutation = trpc.org.positions.delete.useMutation({
    onSuccess: () => {
      toast.success("직급이 삭제되었습니다.");
      utils.org.positions.list.invalidate();
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const upsertUserMappingMutation = trpc.org.userMappings.upsert.useMutation({
    onSuccess: () => {
      toast.success("유저 조직 정보가 저장되었습니다.");
      utils.users.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteUserMappingMutation = trpc.org.userMappings.delete.useMutation({
    onSuccess: () => {
      toast.success("유저 조직 정보가 제거되었습니다.");
      utils.users.list.invalidate();
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

  const [openId, setOpenId] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
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

  const roleFilteredUsers = useMemo(() => {
    const list = users ?? [];
    if (roleFilter === "all") return list;
    return list.filter((u: any) => u.role === roleFilter);
  }, [users, roleFilter]);

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
    const list = users ?? [];
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
    setOpenId("");
    setUsername("");
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setBankName("");
    setBankAccount("");
    setCreateRole("staff");
  };

  const handleCreate = () => {
    if (!openId.trim()) return toast.error("openId를 입력해주세요.");
    if (!username.trim()) return toast.error("아이디를 입력해주세요.");
    if (!name.trim()) return toast.error("이름을 입력해주세요.");
    if (!password.trim()) return toast.error("비밀번호를 입력해주세요.");

    createMutation.mutate(
      {
        openId: openId.trim(),
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
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
                <Input
                  placeholder="openId (고유 식별값)"
                  value={openId}
                  onChange={(e) => setOpenId(e.target.value)}
                />
                <Input
                  placeholder="아이디(username)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
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
                  disabled={createMutation.isPending}
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
                      {users?.map((u: any) => (
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
                      {users?.map((u: any) => (
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

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              superhost 계정은 기본 보호 대상입니다. 권한 변경 / 비활성화 /
              비밀번호 재설정이 불가합니다.
            </div>

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
                              u.name || "-"
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

      {userTab === "role" && (
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>권한 변경</CardTitle>

            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              superhost 계정은 권한 변경이 불가능합니다.
            </div>

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
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              비밀번호 보기 기능은 제거되었습니다. superhost 계정은 비밀번호
              재설정이 불가합니다.
            </div>

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
                조직 개편과 팀 구조 변경은 슈퍼호스트 페이지를 기준으로
                관리하세요.
              </p>

              {!isSuperhostOnly ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  팀 / 직급 / 유저 매핑 수정은 슈퍼호스트만 가능합니다. 현재는
                  조회만 가능합니다.
                </div>
              ) : null}
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
                    disabled={!isSuperhostOnly}
                  />
                  <Button
                    type="button"
                    onClick={addTeam}
                    className="gap-2"
                    disabled={!isSuperhostOnly}
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
                          disabled={!isSuperhostOnly}
                          onBlur={(e) => {
                            if (!isSuperhostOnly) return;
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
                          disabled={!isSuperhostOnly}
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
                    disabled={!isSuperhostOnly}
                  />
                  <Button
                    type="button"
                    onClick={addPosition}
                    className="gap-2"
                    disabled={!isSuperhostOnly}
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
                          disabled={!isSuperhostOnly}
                          onBlur={(e) => {
                            if (!isSuperhostOnly) return;
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
                          disabled={!isSuperhostOnly}
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
                      {users.map((u: any) => {
                        const mapping = getMapping(u.id);
                        const rowLocked =
                          !isSuperhostOnly || isProtectedSuperhost(u);

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

  const { data: forms, isLoading } = trpc.formAdmin.list.useQuery({
    formType,
  });

  const { data: users } = trpc.users.list.useQuery();

  const { data: templateData } = trpc.formAdmin.getTemplate.useQuery(
    { formType },
    { staleTime: 0 }
  );

  const { data: blueprints = [], isLoading: blueprintsLoading } =
    trpc.formBlueprintAdmin.list.useQuery({
      formType,
    });

  const { data: templateList = [], refetch: refetchTemplateList } =
    trpc.formAdmin.listTemplates.useQuery({
      formType,
    });

  const [assigneeId, setAssigneeId] = useState("");
  const [selectedBlueprintId, setSelectedBlueprintId] = useState("");
  const [editingBlueprintId, setEditingBlueprintId] = useState<number | null>(
    null
  );

  const [templateDraft, setTemplateDraft] = useState<PublicFormUiConfig>(
    createDefaultPublicFormUiConfig(formType)
  );

  const [blueprintName, setBlueprintName] = useState("");
  const [blueprintDescription, setBlueprintDescription] = useState("");
  const [blueprintDraft, setBlueprintDraft] = useState<PublicFormUiConfig>(
    createDefaultPublicFormUiConfig(formType)
  );

  const [blueprintSearch, setBlueprintSearch] = useState("");
  const [blueprintSort, setBlueprintSort] = useState<
    "latest" | "name" | "defaultFirst"
  >("defaultFirst");
  const [blueprintFilter, setBlueprintFilter] = useState<
    "all" | "default" | "inactive"
  >("all");

  const [formSearch, setFormSearch] = useState("");
  const [formStatusFilter, setFormStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [formSort, setFormSort] = useState<
    "latest" | "oldest" | "activeFirst"
  >("latest");
  const [selectedFormIds, setSelectedFormIds] = useState<number[]>([]);

  const [templateName, setTemplateName] = useState("");
  const [renameTemplateName, setRenameTemplateName] = useState("");
  const [duplicateTemplateName, setDuplicateTemplateName] = useState("");
  const [selectedTemplateName, setSelectedTemplateName] = useState("");

  const templatePreviewQuery = trpc.formAdmin.getNamedTemplate.useQuery(
    {
      formType,
      templateName: selectedTemplateName,
    },
    {
      enabled: !!selectedTemplateName,
    }
  );

  useEffect(() => {
    const next =
      templateData?.uiConfig && Object.keys(templateData.uiConfig).length > 0
        ? {
            ...createDefaultPublicFormUiConfig(formType),
            ...templateData.uiConfig,
          }
        : createDefaultPublicFormUiConfig(formType);

    setTemplateDraft(next);
  }, [templateData, formType]);

  const userMap = useMemo(() => {
    return new Map((users ?? []).map((u: any) => [Number(u.id), u]));
  }, [users]);

  const formSummary = useMemo(() => {
    const total = (forms ?? []).length;
    const active = (forms ?? []).filter((f: any) => Boolean(f.isActive)).length;
    const inactive = total - active;

    const totalBlueprints = (blueprints ?? []).length;
    const defaultBlueprints = (blueprints ?? []).filter((b: any) =>
      Boolean(b.isDefault)
    ).length;

    return {
      total,
      active,
      inactive,
      totalBlueprints,
      defaultBlueprints,
    };
  }, [forms, blueprints]);

  const filteredBlueprints = useMemo(() => {
    const term = blueprintSearch.trim().toLowerCase();

    let list = [...blueprints].filter((item: any) => {
      if (!term) return true;
      return (
        String(item.name || "").toLowerCase().includes(term) ||
        String(item.description || "").toLowerCase().includes(term)
      );
    });

    if (blueprintFilter === "default") {
      list = list.filter((item: any) => Boolean(item.isDefault));
    } else if (blueprintFilter === "inactive") {
      list = list.filter((item: any) => !Boolean(item.isActive));
    }

    if (blueprintSort === "name") {
      list.sort((a: any, b: any) =>
        String(a.name || "").localeCompare(String(b.name || ""))
      );
    } else if (blueprintSort === "defaultFirst") {
      list.sort((a: any, b: any) => {
        if (Boolean(a.isDefault) !== Boolean(b.isDefault)) {
          return a.isDefault ? -1 : 1;
        }
        return Number(b.id) - Number(a.id);
      });
    } else {
      list.sort((a: any, b: any) => Number(b.id) - Number(a.id));
    }

    return list;
  }, [blueprints, blueprintSearch, blueprintSort, blueprintFilter]);

  const blueprintUsageCountMap = useMemo(() => {
    const map = new Map<string, number>();

    (forms ?? []).forEach((f: any) => {
      const key = String(f.sourceBlueprintName || "").trim();
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    });

    return map;
  }, [forms]);

  const filteredForms = useMemo(() => {
    const term = formSearch.trim().toLowerCase();

    let list = (forms ?? []).filter((f: any) => {
      const assignee = userMap.get(Number(f.assigneeId));

      const matchesSearch =
        !term ||
        String(f.token || "").toLowerCase().includes(term) ||
        String(assignee?.name || "").toLowerCase().includes(term) ||
        String(assignee?.username || "").toLowerCase().includes(term) ||
        String(f.sourceBlueprintName || "").toLowerCase().includes(term);

      const matchesStatus =
        formStatusFilter === "all" ||
        (formStatusFilter === "active" && Boolean(f.isActive)) ||
        (formStatusFilter === "inactive" && !Boolean(f.isActive));

      return matchesSearch && matchesStatus;
    });

    if (formSort === "oldest") {
      list.sort(
        (a: any, b: any) =>
          new Date(a.createdAt || 0).getTime() -
          new Date(b.createdAt || 0).getTime()
      );
    } else if (formSort === "activeFirst") {
      list.sort((a: any, b: any) => {
        if (Boolean(a.isActive) !== Boolean(b.isActive)) {
          return a.isActive ? -1 : 1;
        }
        return (
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
        );
      });
    } else {
      list.sort(
        (a: any, b: any) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
    }

    return list;
  }, [forms, formSearch, formStatusFilter, formSort, userMap]);

  const createMutation = trpc.formAdmin.create.useMutation({
    onSuccess: async (created: any) => {
      toast.success(`${title} 링크가 생성되었습니다.`);
      setAssigneeId("");
      setSelectedBlueprintId("");
      await utils.formAdmin.list.invalidate({ formType });

      const token = String(created?.token || "").trim();
      if (token) {
        const fullUrl = `${window.location.origin}${pathPrefix}/${token}`;
        await navigator.clipboard.writeText(fullUrl);
        toast.success("생성과 동시에 링크가 복사되었습니다.");
      }
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
          ? "회사 기본 랜딩페이지 설정이 저장되었습니다."
          : "회사 기본 광고폼 설정이 저장되었습니다."
      );
      await utils.formAdmin.getTemplate.invalidate({ formType });
    },
    onError: (e) => toast.error(e.message),
  });

  const saveAsTemplateMutation = trpc.formAdmin.saveAsTemplate.useMutation({
    onSuccess: async () => {
      toast.success("템플릿으로 저장되었습니다.");
      await refetchTemplateList();
      setTemplateName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteTemplateMutation = trpc.formAdmin.deleteTemplate.useMutation({
    onSuccess: async () => {
      toast.success("템플릿을 삭제했습니다.");
      await refetchTemplateList();
      setSelectedTemplateName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const renameTemplateMutation = trpc.formAdmin.renameTemplate.useMutation({
    onSuccess: async () => {
      toast.success("템플릿 이름을 변경했습니다.");
      await refetchTemplateList();
      setSelectedTemplateName(renameTemplateName.trim());
      setRenameTemplateName("");
    },
    onError: (e) => toast.error(e.message),
  });

  const duplicateTemplateMutation =
    trpc.formAdmin.duplicateTemplate.useMutation({
      onSuccess: async () => {
        toast.success("템플릿을 복제했습니다.");
        await refetchTemplateList();
        setSelectedTemplateName(duplicateTemplateName.trim());
        setDuplicateTemplateName("");
      },
      onError: (e) => toast.error(e.message),
    });

  const pinTemplateMutation = trpc.formAdmin.saveAsTemplate.useMutation({
    onSuccess: async () => {
      toast.success("템플릿 고정 상태를 변경했습니다.");
      await refetchTemplateList();
      await templatePreviewQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const createBlueprintMutation = trpc.formBlueprintAdmin.create.useMutation({
    onSuccess: async () => {
      toast.success(`${title} 기본 뼈대가 생성되었습니다.`);
      setBlueprintName("");
      setBlueprintDescription("");
      setBlueprintDraft(createDefaultPublicFormUiConfig(formType));
      await utils.formBlueprintAdmin.list.invalidate({ formType });
    },
    onError: (e) => toast.error(e.message),
  });

  const updateBlueprintMutation = trpc.formBlueprintAdmin.update.useMutation({
    onSuccess: async () => {
      toast.success("뼈대가 수정되었습니다.");
      setEditingBlueprintId(null);
      setBlueprintName("");
      setBlueprintDescription("");
      setBlueprintDraft(createDefaultPublicFormUiConfig(formType));
      await utils.formBlueprintAdmin.list.invalidate({ formType });
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteBlueprintMutation = trpc.formBlueprintAdmin.delete.useMutation({
    onSuccess: async () => {
      toast.success("뼈대가 삭제되었습니다.");
      await utils.formBlueprintAdmin.list.invalidate({ formType });
    },
    onError: (e) => toast.error(e.message),
  });

  const startEditBlueprint = (item: any) => {
    setEditingBlueprintId(Number(item.id));
    setBlueprintName(item.name || "");
    setBlueprintDescription(item.description || "");
    setBlueprintDraft({
      ...createDefaultPublicFormUiConfig(formType),
      ...(item.uiConfig || {}),
    });
  };

  const resetBlueprintEditor = () => {
    setEditingBlueprintId(null);
    setBlueprintName("");
    setBlueprintDescription("");
    setBlueprintDraft(createDefaultPublicFormUiConfig(formType));
  };

  const handleSaveBlueprint = () => {
    if (!blueprintName.trim()) {
      toast.error("뼈대 이름을 입력해주세요.");
      return;
    }

    if (editingBlueprintId) {
      updateBlueprintMutation.mutate({
        id: editingBlueprintId,
        name: blueprintName.trim(),
        description: blueprintDescription.trim() || null,
        uiConfig: blueprintDraft,
      });
      return;
    }

    createBlueprintMutation.mutate({
      formType,
      name: blueprintName.trim(),
      description: blueprintDescription.trim() || null,
      uiConfig: blueprintDraft,
    });
  };

  const handleSaveAsTemplate = (rawName?: string) => {
    const safeName = String(rawName ?? templateName).trim();

    if (!safeName) {
      toast.error("템플릿 이름을 입력해주세요.");
      return;
    }

    saveAsTemplateMutation.mutate({
      formType,
      templateName: safeName,
      uiConfig: templateDraft,
    });
  };

  const handleApplyTemplateByName = async (templateName: string) => {
    const safeName = String(templateName || "").trim();

    if (!safeName) {
      toast.error("적용할 템플릿을 선택해주세요.");
      return;
    }

    setSelectedTemplateName(safeName);

    const result = await templatePreviewQuery.refetch();
    const preview = result.data?.uiConfig;

    if (!preview) {
      toast.error("템플릿 정보를 불러오지 못했습니다.");
      return;
    }

    setTemplateDraft({
      ...createDefaultPublicFormUiConfig(formType),
      ...preview,
    });

    toast.success("템플릿을 회사 기본 설정에 불러왔습니다.");
  };

  const handleDeleteTemplate = (rawName?: string) => {
    const safeName = String(rawName ?? selectedTemplateName).trim();

    if (!safeName) {
      toast.error("삭제할 템플릿을 선택해주세요.");
      return;
    }

    const ok = window.confirm(
      `선택한 템플릿 "${safeName}" 을(를) 삭제할까요?`
    );
    if (!ok) return;

    deleteTemplateMutation.mutate({
      formType,
      templateName: safeName,
    });
  };

  const handleRenameTemplate = (
    rawOldName?: string,
    rawNewName?: string
  ) => {
    const oldName = String(rawOldName ?? selectedTemplateName).trim();
    const newName = String(rawNewName ?? renameTemplateName).trim();

    if (!oldName) {
      toast.error("이름을 변경할 템플릿을 선택해주세요.");
      return;
    }

    if (!newName) {
      toast.error("새 템플릿 이름을 입력해주세요.");
      return;
    }

    renameTemplateMutation.mutate({
      formType,
      oldTemplateName: oldName,
      newTemplateName: newName,
    });
  };

  const handleDuplicateTemplate = (
    rawSourceName?: string,
    rawNewName?: string
  ) => {
    const sourceName = String(rawSourceName ?? selectedTemplateName).trim();
    const newName = String(rawNewName ?? duplicateTemplateName).trim();

    if (!sourceName) {
      toast.error("복제할 템플릿을 선택해주세요.");
      return;
    }

    if (!newName) {
      toast.error("복제할 새 템플릿 이름을 입력해주세요.");
      return;
    }

    duplicateTemplateMutation.mutate({
      formType,
      sourceTemplateName: sourceName,
      newTemplateName: newName,
    });
  };

  const handleTogglePinTemplate = async (rawName?: string) => {
    const safeName = String(rawName ?? selectedTemplateName).trim();

    if (!safeName) {
      toast.error("템플릿을 선택해주세요.");
      return;
    }

    const result = await templatePreviewQuery.refetch();
    const preview = result.data?.uiConfig;

    if (!preview) {
      toast.error("템플릿 정보를 먼저 불러와주세요.");
      return;
    }

    pinTemplateMutation.mutate({
      formType,
      templateName: safeName,
      uiConfig: {
        ...preview,
        isPinned: !Boolean(preview.isPinned),
      },
    });
  };

  const handleExportFormsCsv = () => {
    const rows = filteredForms.map((f: any) => {
      const assignee = userMap.get(Number(f.assigneeId));
      const fullUrl = `${window.location.origin}${pathPrefix}/${f.token}`;

      return {
        id: f.id,
        token: f.token,
        assigneeName: assignee?.name || "",
        assigneeUsername: assignee?.username || "",
        assigneePhone: assignee?.phone || "",
        sourceBlueprintName: f.sourceBlueprintName || "회사 기본 설정",
        isActive: f.isActive ? "활성" : "비활성",
        createdAt: f.createdAt
          ? new Date(f.createdAt).toLocaleString("ko-KR")
          : "",
        url: fullUrl,
      };
    });

    const header = [
      "ID",
      "토큰",
      "담당자명",
      "담당자아이디",
      "전화번호",
      "뼈대",
      "상태",
      "생성일",
      "링크",
    ];

    const csv = [
      header.join(","),
      ...rows.map((row) =>
        [
          row.id,
          row.token,
          row.assigneeName,
          row.assigneeUsername,
          row.assigneePhone,
          row.sourceBlueprintName,
          row.isActive,
          row.createdAt,
          row.url,
        ]
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      ),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csv], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${title}-링크목록.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleBulkUpdateForms = async (nextIsActive: boolean) => {
    if (selectedFormIds.length === 0) {
      toast.error("먼저 링크를 선택해주세요.");
      return;
    }

    const label = nextIsActive ? "활성" : "비활성";
    const ok = window.confirm(
      `선택한 링크 ${selectedFormIds.length}개를 ${label} 처리할까요?`
    );
    if (!ok) return;

    try {
      for (const id of selectedFormIds) {
        await updateActiveMutation.mutateAsync({
          id,
          isActive: nextIsActive,
        });
      }
      toast.success(`선택한 링크를 ${label} 처리했습니다.`);
      setSelectedFormIds([]);
    } catch (e: any) {
      toast.error(e.message || `선택 링크 ${label} 처리 중 오류가 발생했습니다.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">총 생성 링크</p>
            <p className="mt-2 text-2xl font-bold">{formSummary.total}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">활성 링크</p>
            <p className="mt-2 text-2xl font-bold text-emerald-600">
              {formSummary.active}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">비활성 링크</p>
            <p className="mt-2 text-2xl font-bold text-rose-600">
              {formSummary.inactive}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              기본 뼈대 / 전체 뼈대
            </p>
            <p className="mt-2 text-2xl font-bold">
              {formSummary.defaultBlueprints} / {formSummary.totalBlueprints}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{title} 기본 뼈대 관리</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-sm text-muted-foreground">
            기본 뼈대는 여러 디자인 프리셋을 저장해두는 영역입니다. 링크 생성
            시 특정 뼈대를 선택하면 해당 디자인으로 담당자 페이지가
            만들어집니다.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">뼈대 이름</p>
              <Input
                value={blueprintName}
                onChange={(e) => setBlueprintName(e.target.value)}
                placeholder={`${title} 기본 뼈대 이름`}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">설명</p>
              <Input
                value={blueprintDescription}
                onChange={(e) => setBlueprintDescription(e.target.value)}
                placeholder="설명을 입력하세요"
              />
            </div>
          </div>

          <FormDesignEditor
            mode={formType}
            title={`${title} 기본 뼈대`}
            value={blueprintDraft}
            onChange={setBlueprintDraft}
            canManageTemplates={false}
          />

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={handleSaveBlueprint}
              disabled={
                createBlueprintMutation.isPending ||
                updateBlueprintMutation.isPending
              }
            >
              {editingBlueprintId
                ? updateBlueprintMutation.isPending
                  ? "수정 중..."
                  : "뼈대 수정"
                : createBlueprintMutation.isPending
                ? "생성 중..."
                : "뼈대 생성"}
            </Button>

            {editingBlueprintId ? (
              <Button variant="outline" onClick={resetBlueprintEditor}>
                편집 취소
              </Button>
            ) : null}

          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant={blueprintFilter === "all" ? "default" : "outline"}
              onClick={() => setBlueprintFilter("all")}
            >
              전체
            </Button>
            <Button
              type="button"
              size="sm"
              variant={blueprintFilter === "default" ? "default" : "outline"}
              onClick={() => setBlueprintFilter("default")}
            >
              기본 뼈대만
            </Button>
            <Button
              type="button"
              size="sm"
              variant={blueprintFilter === "inactive" ? "default" : "outline"}
              onClick={() => setBlueprintFilter("inactive")}
            >
              비활성만
            </Button>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-medium">등록된 뼈대 목록</p>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <Input
                value={blueprintSearch}
                onChange={(e) => setBlueprintSearch(e.target.value)}
                placeholder="뼈대 이름/설명 검색"
                className="max-w-sm"
              />

              <Select
                value={blueprintSort}
                onValueChange={(v: any) => setBlueprintSort(v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="defaultFirst">기본 뼈대 우선</SelectItem>
                  <SelectItem value="latest">최신순</SelectItem>
                  <SelectItem value="name">이름순</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {blueprintsLoading ? (
              <div className="text-sm text-muted-foreground">
                불러오는 중...
              </div>
            ) : filteredBlueprints.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                등록된 뼈대가 없습니다.
              </div>
            ) : (
              <div className="space-y-3">
                {filteredBlueprints.map((item: any) => (
                  <div
                    key={item.id}
                    className="rounded-xl border p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-medium">
                          {item.name}
                          {item.isDefault ? " · 기본 뼈대" : ""}
                          {!item.isActive ? " · 비활성" : ""}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {item.description || "설명 없음"}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          사용 링크 수:{" "}
                          {blueprintUsageCountMap.get(
                            String(item.name || "").trim()
                          ) || 0}
                          개
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => startEditBlueprint(item)}
                        >
                          수정
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateBlueprintMutation.mutate({
                              id: Number(item.id),
                              isDefault: !item.isDefault,
                            })
                          }
                          disabled={updateBlueprintMutation.isPending}
                        >
                          {item.isDefault ? "기본 해제" : "기본 지정"}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            updateBlueprintMutation.mutate({
                              id: Number(item.id),
                              isActive: !item.isActive,
                            })
                          }
                          disabled={updateBlueprintMutation.isPending}
                        >
                          {item.isActive ? "비활성" : "활성"}
                        </Button>

                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            if (item.isDefault) {
                              toast.error(
                                "기본 지정된 뼈대는 먼저 기본 해제 후 삭제해주세요."
                              );
                              return;
                            }

                            const ok = window.confirm(
                              `뼈대 "${item.name}" 을(를) 삭제할까요?`
                            );
                            if (!ok) return;

                            deleteBlueprintMutation.mutate({
                              id: Number(item.id),
                            });
                          }}
                          disabled={deleteBlueprintMutation.isPending}
                        >
                          삭제
                        </Button>
                      </div>
                    </div>

                    <div className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
                      <div>제목: {item.uiConfig?.title || "-"}</div>
                      <div>부제목: {item.uiConfig?.subtitle || "-"}</div>
                      <div>대표색상: {item.uiConfig?.primaryColor || "-"}</div>
                      <div>
                        버튼문구: {item.uiConfig?.submitButtonText || "-"}
                      </div>
                      <div>로고: {item.uiConfig?.logoUrl ? "있음" : "없음"}</div>
                      <div>
                        상단 이미지:{" "}
                        {item.uiConfig?.heroImageUrl ? "있음" : "없음"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{title} 링크 생성</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            기본 뼈대를 선택하면 해당 뼈대 기준으로 링크가 생성됩니다.
            뼈대를 선택하지 않으면 현재 저장된 회사 기본 {title} 설정으로
            생성됩니다.
          </p>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium">뼈대 선택</p>
              <Select
                value={selectedBlueprintId}
                onValueChange={setSelectedBlueprintId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="뼈대를 선택하세요 (선택 안 하면 회사 기본 설정 사용)" />
                </SelectTrigger>
                <SelectContent>
                  {blueprints.map((item: any) => (
                    <SelectItem key={item.id} value={String(item.id)}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">담당 직원 선택</p>
              <Select value={assigneeId} onValueChange={setAssigneeId}>
                <SelectTrigger>
                  <SelectValue placeholder="담당 직원을 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {(users ?? []).map((member: any) => (
                    <SelectItem key={member.id} value={String(member.id)}>
                      {member.name || member.username || `#${member.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => {
                if (!assigneeId) {
                  toast.error("담당 직원을 먼저 선택해주세요.");
                  return;
                }

                createMutation.mutate({
                  assigneeId: Number(assigneeId),
                  formType,
                  blueprintId: selectedBlueprintId
                    ? Number(selectedBlueprintId)
                    : undefined,
                });
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "생성 중..." : "링크 생성"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {title === "랜딩폼"
              ? "회사 기본 랜딩페이지 설정"
              : "회사 기본 광고페이지 설정"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormDesignEditor
            mode={formType}
            title={title}
            value={templateDraft}
            onChange={setTemplateDraft}
            onSave={() =>
              saveTemplateMutation.mutate({
                formType,
                uiConfig: templateDraft,
              })
            }
            onSaveAsTemplate={(name) => {
              setTemplateName(name);
              handleSaveAsTemplate(name);
            }}
            onApplyTemplate={(name) => {
              handleApplyTemplateByName(name);
            }}
            onDeleteTemplate={(name) => {
              setSelectedTemplateName(name);
              handleDeleteTemplate(name);
            }}
            onRenameTemplate={(oldName, newName) => {
              setSelectedTemplateName(oldName);
              setRenameTemplateName(newName);
              handleRenameTemplate(oldName, newName);
            }}
            onDuplicateTemplate={(sourceName, newName) => {
              setSelectedTemplateName(sourceName);
              setDuplicateTemplateName(newName);
              handleDuplicateTemplate(sourceName, newName);
            }}
            onTogglePinTemplate={(name) => {
              setSelectedTemplateName(name);
              handleTogglePinTemplate(name);
            }}
            canManageTemplates={true}
            templateList={templateList}
            selectedTemplateName={selectedTemplateName}
            onSelectedTemplateNameChange={setSelectedTemplateName}
            isSaving={saveTemplateMutation.isPending}
          />

          <div className="rounded-2xl border bg-muted/20 p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium">
                  {title === "랜딩폼"
                    ? "회사 기본 랜딩페이지 미리보기"
                    : "회사 기본 광고페이지 미리보기"}
                </p>
                <p className="text-xs text-muted-foreground">
                  현재 저장 전 draft 기준으로 바로 보여주는 미리보기입니다.
                </p>
              </div>

              <div
                className="h-3 w-16 rounded-full border"
                style={{
                  backgroundColor: templateDraft.primaryColor || "#2563eb",
                }}
              />
            </div>

            {templateDraft.logoUrl ? (
              <div className="flex items-center gap-3">
                <img
                  src={normalizeAssetUrl(templateDraft.logoUrl)}
                  alt="로고 미리보기"
                  className="h-12 w-12 rounded-xl border object-cover bg-white"
                />
                <div className="text-sm text-muted-foreground">로고 적용됨</div>
              </div>
            ) : null}

            {templateDraft.heroImageUrl ? (
              <div className="overflow-hidden rounded-2xl border bg-white">
                <img
                  src={normalizeAssetUrl(templateDraft.heroImageUrl)}
                  alt="상단 이미지 미리보기"
                  className="h-40 w-full object-cover"
                />
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed bg-white px-4 py-10 text-center text-sm text-muted-foreground">
                상단 이미지가 없으면 기본 텍스트 중심 레이아웃으로 표시됩니다.
              </div>
            )}

            <div className="space-y-2">
              <h3 className="text-xl font-bold leading-tight">
                {templateDraft.title || `${title} 제목 미리보기`}
              </h3>
              <p className="text-sm text-muted-foreground">
                {templateDraft.subtitle || "부제목 미리보기"}
              </p>
            </div>

            {templateDraft.description ? (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {templateDraft.description}
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                style={{
                  backgroundColor: templateDraft.primaryColor || "#2563eb",
                  borderColor: templateDraft.primaryColor || "#2563eb",
                }}
              >
                {templateDraft.submitButtonText || "신청하기"}
              </Button>
            </div>

            <div className="rounded-xl border bg-white px-3 py-3 text-xs text-muted-foreground">
              {templateDraft.agreementText ||
                "개인정보 수집 및 이용에 동의합니다."}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{title} 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-4 text-sm text-muted-foreground">
            생성된 링크 목록입니다. 어떤 뼈대로 생성되었는지 함께 표시되며,
            뼈대가 없으면 회사 기본 설정으로 생성된 링크입니다.
          </p>

          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center">
              <Input
                value={formSearch}
                onChange={(e) => setFormSearch(e.target.value)}
                placeholder="토큰 / 담당자명 / 아이디 / 뼈대명 검색"
                className="max-w-sm"
              />

              <Select
                value={formSort}
                onValueChange={(v: any) => setFormSort(v)}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">최신순</SelectItem>
                  <SelectItem value="oldest">오래된순</SelectItem>
                  <SelectItem value="activeFirst">활성 우선</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={formStatusFilter === "all" ? "default" : "outline"}
                onClick={() => setFormStatusFilter("all")}
              >
                전체
              </Button>
              <Button
                type="button"
                size="sm"
                variant={formStatusFilter === "active" ? "default" : "outline"}
                onClick={() => setFormStatusFilter("active")}
              >
                활성
              </Button>
              <Button
                type="button"
                size="sm"
                variant={
                  formStatusFilter === "inactive" ? "default" : "outline"
                }
                onClick={() => setFormStatusFilter("inactive")}
              >
                비활성
              </Button>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleBulkUpdateForms(true)}
              disabled={
                selectedFormIds.length === 0 || updateActiveMutation.isPending
              }
            >
              선택 활성
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => handleBulkUpdateForms(false)}
              disabled={
                selectedFormIds.length === 0 || updateActiveMutation.isPending
              }
            >
              선택 비활성
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleExportFormsCsv}
            >
              CSV 내보내기
            </Button>
          </div>

          {isLoading ? (
            <div className="text-sm text-muted-foreground">불러오는 중...</div>
          ) : filteredForms.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              생성된 {title}이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={
                          filteredForms.length > 0 &&
                          filteredForms.every((f: any) =>
                            selectedFormIds.includes(Number(f.id))
                          )
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFormIds(
                              filteredForms.map((f: any) => Number(f.id))
                            );
                          } else {
                            setSelectedFormIds([]);
                          }
                        }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">토큰</th>
                    <th className="px-4 py-3 text-left">담당자</th>
                    <th className="px-4 py-3 text-left">아이디</th>
                    <th className="px-4 py-3 text-left">전화번호</th>
                    <th className="px-4 py-3 text-left">뼈대</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-left">생성일</th>
                    <th className="px-4 py-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredForms.map((f: any) => {
                    const assignee = userMap.get(Number(f.assigneeId));
                    const fullUrl = `${window.location.origin}${pathPrefix}/${f.token}`;

                    return (
                      <tr key={f.id} className="border-b">
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedFormIds.includes(Number(f.id))}
                            onChange={(e) => {
                              const id = Number(f.id);
                              setSelectedFormIds((prev) =>
                                e.target.checked
                                  ? [...prev, id]
                                  : prev.filter((item) => item !== id)
                              );
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">{f.id}</td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {f.token}
                        </td>
                        <td className="px-4 py-3">
                          {assignee?.name || assignee?.username || "-"}
                        </td>
                        <td className="px-4 py-3">
                          {assignee?.username || "-"}
                        </td>
                        <td className="px-4 py-3">{assignee?.phone || "-"}</td>
                        <td className="px-4 py-3">
                          {f.sourceBlueprintName || "회사 기본 설정"}
                        </td>
                        <td className="px-4 py-3">
                          {f.isActive ? "활성" : "비활성"}
                        </td>
                        <td className="px-4 py-3">
                          {f.createdAt
                            ? new Date(f.createdAt).toLocaleString("ko-KR")
                            : "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(fullUrl);
                                toast.success(`${title} 링크가 복사되었습니다.`);
                              }}
                            >
                              링크복사
                            </Button>

                            <Button
                              size="sm"
                              variant={f.isActive ? "outline" : "default"}
                              onClick={() =>
                                updateActiveMutation.mutate({
                                  id: Number(f.id),
                                  isActive: !f.isActive,
                                })
                              }
                              disabled={updateActiveMutation.isPending}
                            >
                              {f.isActive ? "비활성" : "활성"}
                            </Button>
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
    </div>
  );
}


function SettingsSection() {
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

    const uploadRes = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || ""}/api/upload`,
      {
        method: "POST",
        body: formData,
        credentials: "include",
      }
    );

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
    </div>
  );
}