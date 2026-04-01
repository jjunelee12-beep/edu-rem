import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Save, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";

type FormType = "attendance" | "business_trip" | "general";

type ApprovalSettingRow = {
  id?: number;
  formType: FormType;
  firstApproverUserId?: number | null;
  secondApproverUserId?: number | null;
  thirdApproverUserId?: number | null;
};

type UserRow = {
  id: number;
  name?: string | null;
  role?: string | null;
  username?: string | null;
  teamName?: string | null;
  positionName?: string | null;
};

function getFormTypeLabel(formType: FormType) {
  switch (formType) {
    case "attendance":
      return "근태";
    case "business_trip":
      return "출장";
    case "general":
      return "일반";
    default:
      return formType;
  }
}

function getUserLabel(user: UserRow) {
  const name = user.name || user.username || `사용자 ${user.id}`;
  const role = user.role ? ` / ${user.role}` : "";
  const team = user.teamName ? ` / ${user.teamName}` : "";
  const position = user.positionName ? ` / ${user.positionName}` : "";
  return `${name}${team}${position}${role}`;
}

export default function ApprovalSettingsPage() {
  const { user } = useAuth();
  const canView = user?.role === "superhost";

  const [activeTab, setActiveTab] = useState<FormType>("attendance");

const printSettingsQuery = trpc.approval.getPrintSettings.useQuery(undefined, {
  enabled: canView,
});

const savePrintMutation = trpc.approval.savePrintSettings.useMutation({
  onSuccess: () => {
    toast.success("출력 설정이 저장되었습니다.");
    void printSettingsQuery.refetch();
  },
  onError: (err) => {
    toast.error(err.message || "출력 설정 저장 중 오류가 발생했습니다.");
  },
});

const [companyName, setCompanyName] = useState("");
const [documentTitle, setDocumentTitle] = useState("");
const [applicantSignLabel, setApplicantSignLabel] = useState("");
const [finalApproverSignLabel, setFinalApproverSignLabel] = useState("");

  const usersQuery = trpc.users.list.useQuery(undefined, {
    enabled: canView,
  });

  const settingQuery = trpc.approval.getSetting.useQuery(
    { formType: activeTab },
    { enabled: canView }
  );

  const saveMutation = trpc.approval.saveSetting.useMutation({
    onSuccess: () => {
      toast.success("전자결재 설정이 저장되었습니다.");
      void settingQuery.refetch();
    },
    onError: (err) => {
      toast.error(err.message || "설정 저장 중 오류가 발생했습니다.");
    },
  });

  const allUsers = useMemo<UserRow[]>(() => {
    return ((usersQuery.data ?? []) as UserRow[]).slice();
  }, [usersQuery.data]);

  const approverCandidates = useMemo(() => {
    return allUsers.filter((u) =>
      ["admin", "host", "superhost"].includes(String(u.role || ""))
    );
  }, [allUsers]);

  const [firstApproverUserId, setFirstApproverUserId] = useState<string>("none");
  const [secondApproverUserId, setSecondApproverUserId] = useState<string>("none");
  const [thirdApproverUserId, setThirdApproverUserId] = useState<string>("none");

  useEffect(() => {
    const row = settingQuery.data as ApprovalSettingRow | null | undefined;

    setFirstApproverUserId(
      row?.firstApproverUserId ? String(row.firstApproverUserId) : "none"
    );
    setSecondApproverUserId(
      row?.secondApproverUserId ? String(row.secondApproverUserId) : "none"
    );
    setThirdApproverUserId(
      row?.thirdApproverUserId ? String(row.thirdApproverUserId) : "none"
    );
  }, [settingQuery.data, activeTab]);

useEffect(() => {
  if (!printSettingsQuery.data) return;

  setCompanyName(printSettingsQuery.data.companyName || "");
  setDocumentTitle(printSettingsQuery.data.documentTitle || "");
  setApplicantSignLabel(printSettingsQuery.data.applicantSignLabel || "");
  setFinalApproverSignLabel(printSettingsQuery.data.finalApproverSignLabel || "");
}, [printSettingsQuery.data]);

  if (!canView) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle>접근 권한 없음</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            전자결재 설정 메뉴는 슈퍼호스트만 접근할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    );
  }


const handleSave = () => {
  // ✅ 순서 체크 먼저
  if (
    firstApproverUserId === "none" &&
    (secondApproverUserId !== "none" || thirdApproverUserId !== "none")
  ) {
    toast.error("1차 승인자부터 순서대로 지정해야 합니다.");
    return;
  }

  if (
    secondApproverUserId === "none" &&
    thirdApproverUserId !== "none"
  ) {
    toast.error("2차 승인자 없이 3차 승인자를 지정할 수 없습니다.");
    return;
  }

  // ✅ ids 생성은 그 다음
  const ids = [firstApproverUserId, secondApproverUserId, thirdApproverUserId]
    .filter((v) => v !== "none")
    .map((v) => Number(v));

  // 중복 체크
  const uniqueIds = new Set(ids);
  if (uniqueIds.size !== ids.length) {
    toast.error("동일한 승인자를 중복 선택할 수 없습니다.");
    return;
  }

  // 최소 1명 체크
  if (ids.length === 0) {
    toast.error("최소 1명의 승인자를 지정하세요.");
    return;
  }

  // 저장
  saveMutation.mutate({
    formType: activeTab,
    firstApproverUserId:
      firstApproverUserId === "none" ? null : Number(firstApproverUserId),
    secondApproverUserId:
      secondApproverUserId === "none" ? null : Number(secondApproverUserId),
    thirdApproverUserId:
      thirdApproverUserId === "none" ? null : Number(thirdApproverUserId),
  });
};

const handleSavePrintSettings = () => {
  if (!companyName || !documentTitle) {
    toast.error("회사명과 문서 제목은 필수입니다.");
    return;
  }

  savePrintMutation.mutate({
    companyName,
    documentTitle,
    applicantSignLabel,
    finalApproverSignLabel,
  });
};

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">전자결재 설정</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            문서 유형별 승인자 라인을 지정합니다.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => {
  void settingQuery.refetch();
  void printSettingsQuery.refetch();
}}
          disabled={settingQuery.isFetching || printSettingsQuery.isFetching}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
  settingQuery.isFetching || printSettingsQuery.isFetching ? "animate-spin" : ""
}`}
          />
          새로고침
        </Button>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Settings className="h-4 w-4" />
            설정 안내
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>- 근태 / 출장 / 일반 문서별로 승인자 라인을 따로 지정할 수 있습니다.</p>
          <p>- 승인자는 관리자, 호스트, 슈퍼호스트 계정 중에서 선택하는 구조로 두는 것이 안전합니다.</p>
          <p>- 1차 승인자부터 순서대로 결재가 진행됩니다.</p>
        </CardContent>
      </Card>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as FormType)}
        className="space-y-4"
      >
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance">근태</TabsTrigger>
          <TabsTrigger value="business_trip">출장</TabsTrigger>
          <TabsTrigger value="general">일반</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>{getFormTypeLabel(activeTab)} 승인 라인 설정</CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          {usersQuery.isLoading || settingQuery.isLoading ? (
            <div className="rounded-xl border bg-slate-50 p-6 text-sm text-muted-foreground">
              설정 정보를 불러오는 중입니다...
            </div>
          ) : usersQuery.isError || settingQuery.isError ? (
            <div className="rounded-xl border bg-slate-50 p-6 text-sm text-destructive">
              설정 정보를 불러오는 중 오류가 발생했습니다.
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>1차 승인자</Label>
                  <Select
                    value={firstApproverUserId}
                    onValueChange={setFirstApproverUserId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="1차 승인자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미지정</SelectItem>
                      {approverCandidates.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {getUserLabel(item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>2차 승인자</Label>
                  <Select
                    value={secondApproverUserId}
                    onValueChange={setSecondApproverUserId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="2차 승인자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미지정</SelectItem>
                      {approverCandidates.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {getUserLabel(item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>3차 승인자</Label>
                  <Select
                    value={thirdApproverUserId}
                    onValueChange={setThirdApproverUserId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="3차 승인자 선택" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">미지정</SelectItem>
                      {approverCandidates.map((item) => (
                        <SelectItem key={item.id} value={String(item.id)}>
                          {getUserLabel(item)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4 text-sm text-muted-foreground">
  현재 선택된 문서 유형:{" "}
  <span className="font-medium text-foreground">
    {getFormTypeLabel(activeTab)}
  </span>

  <div className="mt-3 rounded-xl border p-4 text-sm">
  <div className="font-medium mb-2">현재 승인 라인</div>

  <div className="space-y-1 text-muted-foreground">
    <div>
      1차:{" "}
      {approverCandidates.find(
        (u) => String(u.id) === firstApproverUserId
      )?.name || "미지정"}
    </div>

    <div>
      2차:{" "}
      {approverCandidates.find(
        (u) => String(u.id) === secondApproverUserId
      )?.name || "미지정"}
    </div>

    <div>
      3차:{" "}
      {approverCandidates.find(
        (u) => String(u.id) === thirdApproverUserId
      )?.name || "미지정"}
    </div>
  </div>
</div>             
 </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={
  saveMutation.isPending ||
  (
    firstApproverUserId === "none" &&
    secondApproverUserId === "none" &&
    thirdApproverUserId === "none"
  )
}
                >
                  <Save className="mr-2 h-4 w-4" />
                  {saveMutation.isPending ? "저장 중..." : "설정 저장"}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
<Card>
  <CardHeader>
    <CardTitle className="flex items-center gap-2">
      <Settings className="h-4 w-4" />
      출력 문서 설정
    </CardTitle>
  </CardHeader>

  <CardContent className="space-y-6">
    {printSettingsQuery.isLoading ? (
      <div className="text-sm text-muted-foreground">
        출력 설정을 불러오는 중...
      </div>
    ) : (
      <>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>회사명</Label>
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="예: (주)위드원 교육"
            />
          </div>

          <div className="space-y-2">
            <Label>문서 제목</Label>
            <Input
              value={documentTitle}
              onChange={(e) => setDocumentTitle(e.target.value)}
              placeholder="예: 전자결재 문서"
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>신청자 서명 문구</Label>
            <Input
              value={applicantSignLabel}
              onChange={(e) => setApplicantSignLabel(e.target.value)}
              placeholder="예: 신청자 서명"
            />
          </div>

          <div className="space-y-2">
            <Label>최종 승인자 서명 문구</Label>
            <Input
              value={finalApproverSignLabel}
              onChange={(e) => setFinalApproverSignLabel(e.target.value)}
              placeholder="예: 최종 승인자 서명"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            onClick={handleSavePrintSettings}
            disabled={savePrintMutation.isPending}
          >
            <Save className="mr-2 h-4 w-4" />
            {savePrintMutation.isPending ? "저장 중..." : "출력 설정 저장"}
          </Button>
        </div>
      </>
    )}
  </CardContent>
</Card>
    </div>
  );
}