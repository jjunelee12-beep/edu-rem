import { useMemo, useState } from "react";
import { Building2, Crown, Plus, RefreshCw, UserPlus } from "lucide-react";
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
    businessName: "",
    businessNumber: "",
    planCode: "basic" as PlanCode,
    maxUsers: "10",
    maxLandingForms: "10",
    maxSmsPerMonth: "1000",
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

  const organizationsQuery = trpc.saas.listOrganizations.useQuery(undefined, {
    enabled: user?.role === "superhost",
  });

  const createOrganizationMut = trpc.saas.createOrganization.useMutation({
    onSuccess: async (created) => {
      toast.success("회사 생성 완료");
      setOrgForm({
        name: "",
        businessName: "",
        businessNumber: "",
        planCode: "basic",
        maxUsers: "10",
        maxLandingForms: "10",
        maxSmsPerMonth: "1000",
        memo: "",
      });

      if (created?.id) {
        setHostForm((prev) => ({
          ...prev,
          organizationId: String(created.id),
        }));
      }

      await utils.saas.listOrganizations.invalidate();
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
    },
    onError: (err) => {
      toast.error(err.message || "Host 계정 생성 실패");
    },
  });

  const organizations = organizationsQuery.data ?? [];

  const selectedOrg = useMemo(() => {
    const id = Number(hostForm.organizationId);
    return organizations.find((org: any) => Number(org.id) === id);
  }, [organizations, hostForm.organizationId]);

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

    createOrganizationMut.mutate({
      name: orgForm.name.trim(),
      businessName: orgForm.businessName.trim() || null,
      businessNumber: orgForm.businessNumber.trim() || null,
      planCode: orgForm.planCode,
      maxUsers: Number(orgForm.maxUsers || 10),
      maxLandingForms: Number(orgForm.maxLandingForms || 10),
      maxSmsPerMonth: Number(orgForm.maxSmsPerMonth || 1000),
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
          onClick={() => organizationsQuery.refetch()}
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

      <div className="grid gap-4 md:grid-cols-3">
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
                        <th className="px-3 py-3">사업자명</th>
                        <th className="px-3 py-3">플랜</th>
                        <th className="px-3 py-3">상태</th>
                        <th className="px-3 py-3">사용자 제한</th>
                        <th className="px-3 py-3">랜딩폼 제한</th>
                        <th className="px-3 py-3">문자 제한</th>
                        <th className="px-3 py-3">생성일</th>
                      </tr>
                    </thead>
                    <tbody>
                      {organizations.map((org: any) => (
                        <tr key={org.id} className="border-b">
                          <td className="px-3 py-3">{org.id}</td>
                          <td className="px-3 py-3 font-medium">{org.name}</td>
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
                              variant={
                                org.status === "active"
                                  ? "default"
                                  : "secondary"
                              }
                            >
                              {STATUS_LABEL[org.status] || org.status}
                            </Badge>
                          </td>
                          <td className="px-3 py-3">{org.maxUsers}</td>
                          <td className="px-3 py-3">{org.maxLandingForms}</td>
                          <td className="px-3 py-3">{org.maxSmsPerMonth}</td>
                          <td className="px-3 py-3">
                            {org.createdAt
                              ? new Date(org.createdAt).toLocaleString()
                              : "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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