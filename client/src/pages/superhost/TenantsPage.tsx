import { useMemo, useState } from "react";
import { Building2, Crown, Pencil, Plus, RefreshCw, UserPlus } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

type PlanCode = "free" | "basic" | "pro" | "enterprise";

const PLAN_LABEL: Record<PlanCode, string> = {
  free: "무료",
  basic: "베이직",
  pro: "프로",
  enterprise: "엔터프라이즈",
};

const STATUS_LABEL: Record<string, string> = {
  active: "활성",
  inactive: "비활성",
  suspended: "정지",
};

export default function TenantsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

 const [orgForm, setOrgForm] = useState({
  name: "",
  slug: "",
  businessName: "",
    businessNumber: "",
    planCode: "basic" as PlanCode,
    maxUsers: "10",
    maxLandingForms: "10",
    maxSmsPerMonth: "1000",
maxAdForms: "10",
allowBackup: true,
allowAuditLog: true,
allowMessenger: true,
allowPracticeCenter: true,
allowSettlementReport: true,
allowPrivateCertificate: true,
maxStorageMb: "1024",
    memo: "",
  });

  const [hostForm, setHostForm] = useState({
    organizationId: "",
    username: "",
    password: "",
    name: "",
    email: "",
    phone: "",
  });

const [editingOrgId, setEditingOrgId] = useState<number | null>(null);
const [auditOrgId, setAuditOrgId] = useState<number | null>(null);

const [editOrgForm, setEditOrgForm] = useState({
  name: "",
  slug: "",
  businessName: "",
  businessNumber: "",
  planCode: "basic" as PlanCode,
  status: "active",
  maxUsers: "10",
  maxLandingForms: "10",
  maxSmsPerMonth: "1000",
maxAdForms: "10",
allowBackup: true,
allowAuditLog: true,
allowMessenger: true,
allowPracticeCenter: true,
allowSettlementReport: true,
allowPrivateCertificate: true,
maxStorageMb: "1024",
  memo: "",
});

  const organizationsQuery = trpc.saas.listOrganizations.useQuery(undefined, {
    enabled: user?.role === "superhost",
  });

const organizationLimitStatusesQuery =
  trpc.saas.listOrganizationLimitStatuses.useQuery(undefined, {
    enabled: user?.role === "superhost",
  });

  const createOrganizationMut = trpc.saas.createOrganization.useMutation({
    onSuccess: async (created) => {
      toast.success("회사 생성 완료");
      setOrgForm({
  name: "",
  slug: "",
  businessName: "",
  businessNumber: "",
  planCode: "basic",
  maxUsers: "10",
  maxLandingForms: "10",
  maxSmsPerMonth: "1000",
maxAdForms: "10",
allowBackup: true,
allowAuditLog: true,
allowMessenger: true,
allowPracticeCenter: true,
allowSettlementReport: true,
allowPrivateCertificate: true,
  maxStorageMb: "1024",
  memo: "",
});

      if (created?.id) {
        setHostForm((prev) => ({
          ...prev,
          organizationId: String(created.id),
        }));
      }

      await utils.saas.listOrganizations.invalidate();
	await utils.saas.listOrganizationLimitStatuses.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "회사 생성 실패");
    },
  });

  const createHostMut = trpc.saas.createHostAccount.useMutation({
    onSuccess: async () => {
      toast.success("Host 계정 생성 완료");
      setHostForm({
        organizationId: hostForm.organizationId,
        username: "",
        password: "",
        name: "",
        email: "",
        phone: "",
      });
      await utils.saas.listOrganizations.invalidate();
await utils.saas.listOrganizationLimitStatuses.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "Host 계정 생성 실패");
    },
  });

const updateOrganizationMut = trpc.saas.updateOrganization.useMutation({
  onSuccess: async () => {
    toast.success("회사 수정 완료");
    setEditingOrgId(null);
    await utils.saas.listOrganizations.invalidate();
await utils.saas.listOrganizationLimitStatuses.invalidate();
  },
  onError: (err) => {
    toast.error(err.message || "회사 수정 실패");
  },
});

  const organizations = organizationsQuery.data ?? [];

const organizationLimitStatuses = organizationLimitStatusesQuery.data ?? [];

const organizationLimitStatusMap = useMemo(() => {
  const map = new Map<number, any>();

  organizationLimitStatuses.forEach((item: any) => {
    map.set(Number(item.organization?.id), item);
  });

  return map;
}, [organizationLimitStatuses]);

  const selectedOrg = useMemo(() => {
    const id = Number(hostForm.organizationId);
    return organizations.find((org: any) => Number(org.id) === id);
  }, [organizations, hostForm.organizationId]);

const usageStatsQuery = trpc.saas.getOrganizationUsageStats.useQuery(
  {
    organizationId: editingOrgId || 0,
  },
  {
    enabled: user?.role === "superhost" && Boolean(editingOrgId),
  }
);

const auditLogsQuery = trpc.saas.listOrganizationAuditLogs.useQuery(
  {
    organizationId: auditOrgId || 0,
  },
  {
    enabled: user?.role === "superhost" && Boolean(auditOrgId),
  }
);

const auditLogs = auditLogsQuery.data ?? [];

const usageStats = usageStatsQuery.data;

  if (user?.role !== "superhost") {
    return (
      <div className="p-6">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="text-destructive">접근 권한 없음</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            이 페이지는 superhost 전용입니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleCreateOrganization = () => {
    if (!orgForm.name.trim()) {
      toast.error("회사명을 입력해주세요.");
      return;
    }

if (!orgForm.slug.trim()) {
  toast.error("회사 URL을 입력해주세요.");
  return;
}

const normalizedSlug = orgForm.slug.trim().toLowerCase();

if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
  toast.error("회사 URL은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  return;
}

const reservedSlugs = ["saas", "api", "login", "logout", "uploads", "form", "ad-form", "go", "admin", "settings", "dashboard"];

if (reservedSlugs.includes(normalizedSlug)) {
  toast.error("예약된 URL입니다. 다른 값을 입력해주세요.");
  return;
}

    createOrganizationMut.mutate({
      name: orgForm.name.trim(),
	slug: normalizedSlug,
      businessName: orgForm.businessName.trim() || null,
      businessNumber: orgForm.businessNumber.trim() || null,
      planCode: orgForm.planCode,
      maxUsers: Number(orgForm.maxUsers || 10),
      maxLandingForms: Number(orgForm.maxLandingForms || 10),
      maxSmsPerMonth: Number(orgForm.maxSmsPerMonth || 1000),
maxAdForms: Number(orgForm.maxAdForms || 10),
allowBackup: orgForm.allowBackup,
allowAuditLog: orgForm.allowAuditLog,
allowMessenger: orgForm.allowMessenger,
allowPracticeCenter: orgForm.allowPracticeCenter,
allowSettlementReport: orgForm.allowSettlementReport,
allowPrivateCertificate: orgForm.allowPrivateCertificate,
maxStorageMb: Number(orgForm.maxStorageMb || 1024),
      memo: orgForm.memo.trim() || null,
    });
  };

  const handleCreateHost = () => {
    if (!hostForm.organizationId) {
      toast.error("회사를 선택해주세요.");
      return;
    }

    if (!hostForm.username.trim()) {
      toast.error("아이디를 입력해주세요.");
      return;
    }

    if (!hostForm.password.trim()) {
      toast.error("비밀번호를 입력해주세요.");
      return;
    }

    if (!hostForm.name.trim()) {
      toast.error("이름을 입력해주세요.");
      return;
    }

    createHostMut.mutate({
      organizationId: Number(hostForm.organizationId),
      username: hostForm.username.trim(),
      password: hostForm.password.trim(),
      name: hostForm.name.trim(),
      email: hostForm.email.trim() || null,
      phone: hostForm.phone.trim() || null,
    });
  };

const startEditOrganization = (org: any) => {
  setEditingOrgId(Number(org.id));
  setEditOrgForm({
  name: org.name || "",
  slug: org.slug || "",
  businessName: org.businessName || "",
    businessNumber: org.businessNumber || "",
    planCode: (org.planCode || "basic") as PlanCode,
    status: org.status || "active",
    maxUsers: String(org.maxUsers ?? 10),
    maxLandingForms: String(org.maxLandingForms ?? 10),
    maxSmsPerMonth: String(org.maxSmsPerMonth ?? 1000),
maxAdForms: String(org.maxAdForms ?? 10),
allowBackup: org.allowBackup ?? true,
allowAuditLog: org.allowAuditLog ?? true,
allowMessenger: org.allowMessenger ?? true,
allowPracticeCenter: org.allowPracticeCenter ?? true,
allowSettlementReport: org.allowSettlementReport ?? true,
allowPrivateCertificate: org.allowPrivateCertificate ?? true,
maxStorageMb: String(org.maxStorageMb ?? 1024),
    memo: org.memo || "",
  });
};

const handleUpdateOrganization = () => {
  if (!editingOrgId) return;

  if (!editOrgForm.name.trim()) {
    toast.error("회사명을 입력해주세요.");
    return;
  }

if (!editOrgForm.slug.trim()) {
  toast.error("회사 URL을 입력해주세요.");
  return;
}

const normalizedSlug = editOrgForm.slug.trim().toLowerCase();

if (!/^[a-z0-9-]+$/.test(normalizedSlug)) {
  toast.error("회사 URL은 영문 소문자, 숫자, 하이픈만 사용할 수 있습니다.");
  return;
}

  updateOrganizationMut.mutate({
    id: editingOrgId,
    name: editOrgForm.name.trim(),
slug: normalizedSlug,
    businessName: editOrgForm.businessName.trim() || null,
    businessNumber: editOrgForm.businessNumber.trim() || null,
    planCode: editOrgForm.planCode,
    status: editOrgForm.status as "active" | "inactive" | "suspended",
    maxUsers: Number(editOrgForm.maxUsers || 10),
    maxLandingForms: Number(editOrgForm.maxLandingForms || 10),
    maxSmsPerMonth: Number(editOrgForm.maxSmsPerMonth || 1000),
maxAdForms: Number(editOrgForm.maxAdForms || 10),
allowBackup: editOrgForm.allowBackup,
allowAuditLog: editOrgForm.allowAuditLog,
allowMessenger: editOrgForm.allowMessenger,
allowPracticeCenter: editOrgForm.allowPracticeCenter,
allowSettlementReport: editOrgForm.allowSettlementReport,
allowPrivateCertificate: editOrgForm.allowPrivateCertificate,
maxStorageMb: Number(editOrgForm.maxStorageMb || 1024),
    memo: editOrgForm.memo.trim() || null,
  });
};

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Building2 className="h-6 w-6 text-primary" />
              테넌트 관리
            </h1>
            <Badge variant="secondary" className="rounded-full">
              SUPERHOST
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            SaaS 구매 회사와 host 계정을 생성/관리합니다.
          </p>
        </div>

        <Button
          variant="outline"
          onClick={() => {
  organizationsQuery.refetch();
  organizationLimitStatusesQuery.refetch();
}}
          disabled={organizationsQuery.isFetching}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${
              organizationsQuery.isFetching ? "animate-spin" : ""
            }`}
          />
          새로고침
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">전체 회사</p>
            <p className="mt-1 text-2xl font-bold">{organizations.length}</p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">활성 회사</p>
            <p className="mt-1 text-2xl font-bold">
              {
                organizations.filter((org: any) => org.status === "active")
                  .length
              }
            </p>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground">현재 운영 조직</p>
            <p className="mt-1 text-2xl font-bold">위드원</p>
          </CardContent>
        </Card>

<Card className="rounded-2xl">
  <CardContent className="p-5">
    <p className="text-xs text-muted-foreground">저장소 초과 회사</p>
    <p className="mt-1 text-2xl font-bold">
      {
        organizationLimitStatuses.filter(
          (item: any) => item.exceeded?.storage
        ).length
      }
    </p>
  </CardContent>
</Card>
      </div>

      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">회사 목록</TabsTrigger>
          <TabsTrigger value="create">회사 생성</TabsTrigger>
          <TabsTrigger value="host">Host 계정 생성</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>회사 목록</CardTitle>
            </CardHeader>
            <CardContent>
              {organizationsQuery.isLoading ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  불러오는 중...
                </div>
              ) : organizations.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted-foreground">
                  등록된 회사가 없습니다.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[900px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left">
                        <th className="px-3 py-3">ID</th>
                        <th className="px-3 py-3">회사명</th>
		<th className="px-3 py-3">회사 URL</th>
                        <th className="px-3 py-3">사업자명</th>
                        <th className="px-3 py-3">플랜</th>
                        <th className="px-3 py-3">상태</th>
                        <th className="px-3 py-3">사용자</th>
		<th className="px-3 py-3">랜딩/광고폼</th>
		<th className="px-3 py-3">문자</th>
		<th className="px-3 py-3">저장공간</th>
                        <th className="px-3 py-3">생성일</th>
		<th className="px-3 py-3">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {organizations.map((org: any) => {
  const usageStatus = organizationLimitStatusMap.get(Number(org.id));
  const usage = usageStatus?.usage;
  const limits = usageStatus?.limits;
  const exceeded = usageStatus?.exceeded;

  return (
    <tr key={org.id} className="border-b">
                          <td className="px-3 py-3">{org.id}</td>
                          <td className="px-3 py-3 font-medium">{org.name}</td>
		<td className="px-3 py-3 text-muted-foreground">/{org.slug || "-"}</td>
                          <td className="px-3 py-3">
                            {org.businessName || "-"}
                          </td>
                          <td className="px-3 py-3">
                            <Badge variant="outline">
                              {PLAN_LABEL[org.planCode as PlanCode] ||
                                org.planCode}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
                            <Badge
  variant={org.status === "active" ? "default" : "secondary"}
  className={
    org.status === "suspended"
      ? "bg-red-100 text-red-700 hover:bg-red-100"
      : org.status === "inactive"
        ? "bg-amber-100 text-amber-700 hover:bg-amber-100"
        : ""
  }
>
                              {STATUS_LABEL[org.status] || org.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">
  <span className={exceeded?.users ? "font-semibold text-red-600" : ""}>
    {usage?.userCount ?? "-"} / {limits?.maxUsers ?? org.maxUsers}
  </span>
</td>

<td className="px-3 py-3">
  <span className={exceeded?.landingForms ? "font-semibold text-red-600" : ""}>
    {usage?.landingFormCount ?? "-"} /{" "}
    {limits?.maxLandingForms ?? org.maxLandingForms}
  </span>
</td>

<td className="px-3 py-3">
  <span className={exceeded?.sms ? "font-semibold text-red-600" : ""}>
    {usage?.smsCountThisMonth ?? "-"} /{" "}
    {limits?.maxSmsPerMonth ?? org.maxSmsPerMonth}
  </span>
</td>

<td className="px-3 py-3">
  <span className={exceeded?.storage ? "font-semibold text-red-600" : ""}>
    {usage?.storageUsedMb ?? 0}MB /{" "}
    {limits?.maxStorageMb ?? org.maxStorageMb ?? 1024}MB
  </span>
</td>
<td className="px-3 py-3">
  {org.createdAt
                              ? new Date(org.createdAt).toLocaleString()
                              : "-"}
                          </td>
<td className="px-3 py-3">
  <Button
    size="sm"
    variant="outline"
    onClick={() => startEditOrganization(org)}
  >
    <Pencil className="mr-1 h-3 w-3" />
    수정
  </Button>
<Button
  size="sm"
  variant="outline"
  onClick={() => setAuditOrgId(Number(org.id))}
>
  이력
</Button>
</td>
                                               </tr>
                      );
                    })}
                    </tbody>
                  </table>
{editingOrgId && (
  <div className="mt-4 rounded-2xl border bg-muted/20 p-4">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h3 className="font-semibold">회사 수정</h3>
        <p className="text-sm text-muted-foreground">
          선택한 회사 ID: {editingOrgId}
        </p>
<div className="mt-3 grid gap-2 text-xs text-muted-foreground md:grid-cols-6">
  <div className="rounded-lg border bg-background p-2">
    사용자: {usageStats?.userCount ?? "-"} / {editOrgForm.maxUsers}
  </div>
  <div className="rounded-lg border bg-background p-2">
    폼: {usageStats?.landingFormCount ?? "-"} / {editOrgForm.maxLandingForms}
  </div>
  <div className="rounded-lg border bg-background p-2">
    상담: {usageStats?.consultationCount ?? "-"}
  </div>
  <div className="rounded-lg border bg-background p-2">
    학생: {usageStats?.studentCount ?? "-"}
  </div>
  <div className="rounded-lg border bg-background p-2">
    정산: {usageStats?.settlementItemCount ?? "-"}
  </div>
<div className="rounded-lg border bg-background p-2">
  저장공간: {usageStats?.storageUsedMb ?? 0}MB / {editOrgForm.maxStorageMb}MB
</div>
</div>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setEditingOrgId(null)}
      >
        취소
      </Button>
    </div>

    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <Label>회사명 *</Label>
        <Input
          value={editOrgForm.name}
          onChange={(e) =>
            setEditOrgForm((prev) => ({ ...prev, name: e.target.value }))
          }
        />
      </div>

<div className="space-y-2">
  <Label>회사 URL *</Label>
  <Input
  value={editOrgForm.slug}
  onChange={(e) =>
    setEditOrgForm((prev) => ({
      ...prev,
      slug: e.target.value.toLowerCase(),
    }))
  }
  placeholder="예: with-one"
/>
<p className="text-xs text-muted-foreground">
  접속 주소: /{editOrgForm.slug || "with-one"}
</p>
</div>

      <div className="space-y-2">
        <Label>사업자명</Label>
        <Input
          value={editOrgForm.businessName}
          onChange={(e) =>
            setEditOrgForm((prev) => ({
              ...prev,
              businessName: e.target.value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>사업자번호</Label>
        <Input
          value={editOrgForm.businessNumber}
          onChange={(e) =>
            setEditOrgForm((prev) => ({
              ...prev,
              businessNumber: e.target.value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>플랜</Label>
        <Select
          value={editOrgForm.planCode}
          onValueChange={(value) =>
            setEditOrgForm((prev) => ({
              ...prev,
              planCode: value as PlanCode,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="free">무료</SelectItem>
            <SelectItem value="basic">베이직</SelectItem>
            <SelectItem value="pro">프로</SelectItem>
            <SelectItem value="enterprise">엔터프라이즈</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>상태</Label>
        <Select
  value={editOrgForm.status}
  onValueChange={(value) => {
    const nextStatus = value as "active" | "inactive" | "suspended";

    if (nextStatus !== "active") {
      const ok = window.confirm(
        nextStatus === "suspended"
          ? "회사를 정지하면 해당 회사 사용자는 로그인/접속이 제한됩니다. 계속하시겠습니까?"
          : "회사를 비활성화하면 해당 회사 사용자는 이용이 제한됩니다. 계속하시겠습니까?"
      );

      if (!ok) return;
    }

    setEditOrgForm((prev) => ({
      ...prev,
      status: nextStatus,
    }));
  }}
>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">활성</SelectItem>
            <SelectItem value="inactive">비활성</SelectItem>
            <SelectItem value="suspended">정지</SelectItem>
          </SelectContent>
        </Select>

<p className="text-xs text-muted-foreground">
  active: 정상 이용 / inactive: 이용 제한 / suspended: 정지 상태로 접근 차단
</p>
      </div>

      <div className="space-y-2">
        <Label>최대 사용자 수</Label>
        <Input
          type="number"
          value={editOrgForm.maxUsers}
          onChange={(e) =>
            setEditOrgForm((prev) => ({
              ...prev,
              maxUsers: e.target.value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
        <Label>최대 랜딩/광고폼 수</Label>
        <Input
          type="number"
          value={editOrgForm.maxLandingForms}
          onChange={(e) =>
            setEditOrgForm((prev) => ({
              ...prev,
              maxLandingForms: e.target.value,
            }))
          }
        />
      </div>

      <div className="space-y-2">
  <Label>월 문자 제한 수</Label>
  <Input
    type="number"
    value={editOrgForm.maxSmsPerMonth}
    onChange={(e) =>
      setEditOrgForm((prev) => ({
        ...prev,
        maxSmsPerMonth: e.target.value,
      }))
    }
  />
</div>

<div className="space-y-2">
  <Label>저장공간 제한(MB)</Label>
  <Input
    type="number"
    value={editOrgForm.maxStorageMb}
    onChange={(e) =>
      setEditOrgForm((prev) => ({
        ...prev,
        maxStorageMb: e.target.value,
      }))
    }
  />
</div>

<div className="space-y-2">
  <Label>최대 광고폼 수</Label>
  <Input
    type="number"
    value={editOrgForm.maxAdForms}
    onChange={(e) =>
      setEditOrgForm((prev) => ({
        ...prev,
        maxAdForms: e.target.value,
      }))
    }
  />
</div>

<div className="grid gap-3 rounded-xl border bg-background p-3 md:col-span-2 md:grid-cols-3">
  {[
    ["allowBackup", "백업/복구"],
    ["allowAuditLog", "감사로그"],
    ["allowMessenger", "메신저"],
    ["allowPracticeCenter", "실습센터"],
    ["allowSettlementReport", "정산리포트"],
    ["allowPrivateCertificate", "민간자격증"],
  ].map(([key, label]) => (
    <label key={key} className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean((editOrgForm as any)[key])}
        onChange={(e) =>
          setEditOrgForm((prev) => ({
            ...prev,
            [key]: e.target.checked,
          }))
        }
      />
      {label}
    </label>
  ))}
</div>

<div className="space-y-2 md:col-span-2">
  <Label>메모</Label>
        <Input
          value={editOrgForm.memo}
          onChange={(e) =>
            setEditOrgForm((prev) => ({ ...prev, memo: e.target.value }))
          }
        />
      </div>

      <div className="md:col-span-2">
        <Button
          onClick={handleUpdateOrganization}
          disabled={updateOrganizationMut.isPending}
        >
          {updateOrganizationMut.isPending ? "저장 중..." : "수정 저장"}
        </Button>
      </div>
    </div>
  </div>
)}

{auditOrgId && (
  <Card className="mt-4">
    <CardHeader className="flex flex-row items-center justify-between">
      <CardTitle>회사 수정 이력</CardTitle>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setAuditOrgId(null)}
      >
        닫기
      </Button>
    </CardHeader>

    <CardContent className="space-y-3">
      {auditLogsQuery.isLoading ? (
        <div className="text-sm text-muted-foreground">이력 불러오는 중...</div>
      ) : auditLogs.length === 0 ? (
        <div className="text-sm text-muted-foreground">수정 이력이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {auditLogs.map((log: any) => (
            <div
              key={log.id}
              className="rounded-lg border bg-background p-3 text-sm space-y-2"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium">{log.action}</div>
                <div className="text-xs text-muted-foreground">
                  {log.createdAt ? new Date(log.createdAt).toLocaleString() : "-"}
                </div>
              </div>

              <div className="text-xs text-muted-foreground">
                작업자 ID: {log.actorUserId ?? "-"} / 대상:{" "}
                {log.targetType ?? "-"} #{log.targetId ?? "-"}
              </div>

              {log.memo && (
                <div className="text-xs text-muted-foreground">
                  메모: {log.memo}
                </div>
              )}

              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">
                  변경 전/후 JSON 보기
                </summary>

                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  <pre className="max-h-60 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                    {log.beforeJson || "{}"}
                  </pre>
                  <pre className="max-h-60 overflow-auto rounded bg-muted p-2 whitespace-pre-wrap">
                    {log.afterJson || "{}"}
                  </pre>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}
    </CardContent>
  </Card>
)}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="create">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Plus className="h-5 w-5" />
                회사 생성
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>회사명 *</Label>
                <Input
                  value={orgForm.name}
                  onChange={(e) =>
                    setOrgForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="예: 알파교육"
                />
              </div>

<div className="space-y-2">
  <Label>회사 URL *</Label>
  <Input
  value={orgForm.slug}
  onChange={(e) =>
    setOrgForm((prev) => ({
      ...prev,
      slug: e.target.value.toLowerCase(),
    }))
  }
  placeholder="예: with-one"
/>
<p className="text-xs text-muted-foreground">
  접속 주소: /{orgForm.slug || "with-one"}
</p>
</div>

              <div className="space-y-2">
                <Label>사업자명</Label>
                <Input
                  value={orgForm.businessName}
                  onChange={(e) =>
                    setOrgForm((prev) => ({
                      ...prev,
                      businessName: e.target.value,
                    }))
                  }
                  placeholder="예: 주식회사 알파교육"
                />
              </div>

              <div className="space-y-2">
                <Label>사업자번호</Label>
                <Input
                  value={orgForm.businessNumber}
                  onChange={(e) =>
                    setOrgForm((prev) => ({
                      ...prev,
                      businessNumber: e.target.value,
                    }))
                  }
                  placeholder="000-00-00000"
                />
              </div>

              <div className="space-y-2">
                <Label>플랜</Label>
                <Select
                  value={orgForm.planCode}
                  onValueChange={(value) =>
                    setOrgForm((prev) => ({
                      ...prev,
                      planCode: value as PlanCode,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">무료</SelectItem>
                    <SelectItem value="basic">베이직</SelectItem>
                    <SelectItem value="pro">프로</SelectItem>
                    <SelectItem value="enterprise">엔터프라이즈</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>최대 사용자 수</Label>
                <Input
                  type="number"
                  value={orgForm.maxUsers}
                  onChange={(e) =>
                    setOrgForm((prev) => ({
                      ...prev,
                      maxUsers: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>최대 랜딩/광고폼 수</Label>
                <Input
                  type="number"
                  value={orgForm.maxLandingForms}
                  onChange={(e) =>
                    setOrgForm((prev) => ({
                      ...prev,
                      maxLandingForms: e.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
  <Label>월 문자 제한 수</Label>
  <Input
    type="number"
    value={orgForm.maxSmsPerMonth}
    onChange={(e) =>
      setOrgForm((prev) => ({
        ...prev,
        maxSmsPerMonth: e.target.value,
      }))
    }
  />
</div>

<div className="space-y-2">
  <Label>저장공간 제한(MB)</Label>
  <Input
    type="number"
    value={orgForm.maxStorageMb}
    onChange={(e) =>
      setOrgForm((prev) => ({
        ...prev,
        maxStorageMb: e.target.value,
      }))
    }
  />
</div>

<div className="space-y-2">
  <Label>최대 광고폼 수</Label>
  <Input
    type="number"
    value={orgForm.maxAdForms}
    onChange={(e) =>
      setOrgForm((prev) => ({
        ...prev,
        maxAdForms: e.target.value,
      }))
    }
  />
</div>

<div className="grid gap-3 rounded-xl border bg-background p-3 md:col-span-2 md:grid-cols-3">
  {[
    ["allowBackup", "백업/복구"],
    ["allowAuditLog", "감사로그"],
    ["allowMessenger", "메신저"],
    ["allowPracticeCenter", "실습센터"],
    ["allowSettlementReport", "정산리포트"],
    ["allowPrivateCertificate", "민간자격증"],
  ].map(([key, label]) => (
    <label key={key} className="flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean((orgForm as any)[key])}
        onChange={(e) =>
          setOrgForm((prev) => ({
            ...prev,
            [key]: e.target.checked,
          }))
        }
      />
      {label}
    </label>
  ))}
</div>

<div className="space-y-2 md:col-span-2">
  <Label>메모</Label>
                <Input
                  value={orgForm.memo}
                  onChange={(e) =>
                    setOrgForm((prev) => ({ ...prev, memo: e.target.value }))
                  }
                  placeholder="계약 조건, 특이사항 등"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  onClick={handleCreateOrganization}
                  disabled={createOrganizationMut.isPending}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  {createOrganizationMut.isPending
                    ? "생성 중..."
                    : "회사 생성"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="host">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserPlus className="h-5 w-5" />
                Host 계정 생성
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 md:col-span-2">
                <Label>회사 선택 *</Label>
                <Select
                  value={hostForm.organizationId}
                  onValueChange={(value) =>
                    setHostForm((prev) => ({
                      ...prev,
                      organizationId: value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="회사 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {organizations.map((org: any) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        #{org.id} {org.name} /{" "}
                        {PLAN_LABEL[org.planCode as PlanCode] || org.planCode}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedOrg && (
                  <div className="rounded-xl border bg-muted/30 p-3 text-sm text-muted-foreground">
                    선택 회사:{" "}
                    <span className="font-medium text-foreground">
                      {selectedOrg.name}
                    </span>{" "}
                    / 상태: {STATUS_LABEL[selectedOrg.status] || selectedOrg.status}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>아이디 *</Label>
                <Input
                  value={hostForm.username}
                  onChange={(e) =>
                    setHostForm((prev) => ({
                      ...prev,
                      username: e.target.value,
                    }))
                  }
                  placeholder="구매자 로그인 아이디"
                />
              </div>

              <div className="space-y-2">
                <Label>비밀번호 *</Label>
                <Input
                  type="password"
                  value={hostForm.password}
                  onChange={(e) =>
                    setHostForm((prev) => ({
                      ...prev,
                      password: e.target.value,
                    }))
                  }
                  placeholder="초기 비밀번호"
                />
              </div>

              <div className="space-y-2">
                <Label>이름 *</Label>
                <Input
                  value={hostForm.name}
                  onChange={(e) =>
                    setHostForm((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="대표자 또는 관리자 이름"
                />
              </div>

              <div className="space-y-2">
                <Label>전화번호</Label>
                <Input
                  value={hostForm.phone}
                  onChange={(e) =>
                    setHostForm((prev) => ({ ...prev, phone: e.target.value }))
                  }
                  placeholder="010-0000-0000"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label>이메일</Label>
                <Input
                  value={hostForm.email}
                  onChange={(e) =>
                    setHostForm((prev) => ({ ...prev, email: e.target.value }))
                  }
                  placeholder="admin@example.com"
                />
              </div>

              <div className="md:col-span-2">
                <Button
                  onClick={handleCreateHost}
                  disabled={createHostMut.isPending}
                >
                  <Crown className="mr-2 h-4 w-4" />
                  {createHostMut.isPending
                    ? "생성 중..."
                    : "Host 계정 생성"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}