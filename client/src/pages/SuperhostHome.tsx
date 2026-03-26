import { useMemo } from "react";
import {
  Crown,
  Building2,
  Palette,
  Sparkles,
  ShieldCheck,
  Lock,
  LayoutDashboard,
  Users,
} from "lucide-react";

import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function SuperhostHome() {
  const { user } = useAuth();

  const stats = useMemo(
    () => [
      {
        label: "테넌트 관리",
        value: "준비중",
        icon: Building2,
        desc: "회사/조직 단위 SaaS 관리",
      },
      {
        label: "레이아웃 빌더",
        value: "준비중",
        icon: Palette,
        desc: "회사별 CRM 레이아웃 커스터마이징",
      },
      {
        label: "AI 정책 관리",
        value: "준비중",
        icon: Sparkles,
        desc: "회사별 AI 권한/명령 정책 분리",
      },
      {
        label: "보안 상태",
        value: "분리중",
        icon: ShieldCheck,
        desc: "host/admin/staff 와 superhost 완전 분리",
      },
    ],
    []
  );

  if (user?.role !== "superhost") {
    return (
      <div className="space-y-6 p-6">
        <Card className="border-destructive/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Lock className="h-5 w-5" />
              접근 권한 없음
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            이 페이지는 superhost 전용입니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Crown className="h-6 w-6 text-primary" />
              슈퍼호스트 대시보드
            </h1>
            <Badge variant="secondary" className="rounded-full">
              SUPERHOST
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            host/admin/staff 와 분리된 총관리자 전용 콘솔입니다.
          </p>
        </div>

        <div className="text-xs text-muted-foreground">
          접속 계정: {user?.name || user?.username || "-"}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <Card key={item.label} className="rounded-2xl">
            <CardContent className="flex items-start gap-3 p-5">
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-lg font-bold">{item.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="rounded-2xl lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LayoutDashboard className="h-5 w-5" />
              슈퍼호스트 기능 방향
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="font-medium text-foreground">1. 테넌트(회사) 분리</p>
              <p className="mt-1">
                각 회사별 데이터, 사용자, 메뉴, 브랜딩, AI 정책을 분리해서 관리
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="font-medium text-foreground">2. 레이아웃 빌더</p>
              <p className="mt-1">
                네이버 블로그 / 카페처럼 회사별 CRM 레이아웃과 메뉴 구성을 다르게 설정
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="font-medium text-foreground">3. AI 정책 관리</p>
              <p className="mt-1">
                회사별로 AI가 조회 가능한 범위, 입력 가능한 범위, 알림 정책을 분리
              </p>
            </div>

            <div className="rounded-xl border bg-muted/30 p-4">
              <p className="font-medium text-foreground">4. 완전 분리 권한</p>
              <p className="mt-1">
                host는 superhost 메뉴/기능/API를 알 수 없고 접근도 불가능하게 구성
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              운영 원칙
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-xl border p-3">
              <p className="font-medium text-foreground">staff</p>
              <p className="mt-1">일반 실무 기능</p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="font-medium text-foreground">admin</p>
              <p className="mt-1">승인/정산/운영 보조</p>
            </div>

            <div className="rounded-xl border p-3">
              <p className="font-medium text-foreground">host</p>
              <p className="mt-1">회사 내부 최고관리자</p>
            </div>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
              <p className="font-medium text-primary">superhost</p>
              <p className="mt-1">
                SaaS 총관리자. host 확장판이 아니라 별도 상위 콘솔
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}