import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import {
  Activity,
  AlertTriangle,
  Building2,
  Database,
  HardDrive,
  History,
  Server,
  Wifi,
} from "lucide-react";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function OrganizationMonitoringPage() {
  const { user } = useAuth();
  const [, params] = useRoute("/saas/monitoring/:organizationId");

  const organizationId = Number(params?.organizationId || 0);

  const detailQuery = trpc.monitoring.organizationDetail.useQuery(
    { organizationId },
    {
      enabled: user?.role === "superhost" && organizationId > 0,
    }
  );

const apiErrorSummaryQuery =
  trpc.monitoring.organizationApiErrorSummary.useQuery(
    { organizationId, days: 7 },
    {
      enabled: user?.role === "superhost" && organizationId > 0,
    }
  );

const apiErrorLogsQuery = trpc.monitoring.organizationApiErrors.useQuery(
  { organizationId, limit: 50 },
  {
    enabled: user?.role === "superhost" && organizationId > 0,
  }
);

const auditLogsQuery = trpc.audit.list.useQuery(
  {
    organizationId,
    limit: 50,
  },
  {
    enabled: user?.role === "superhost" && organizationId > 0,
  }
);

const systemHealthQuery = trpc.monitoring.systemHealth.useQuery(undefined, {
  enabled: user?.role === "superhost",
  refetchInterval: 30000,
});

  const detail = detailQuery.data;
  const organization = detail?.organization;
  const tableCounts = detail?.tableCounts ?? [];
  const backups = detail?.backups ?? [];
const usage = detail?.usage;

const apiErrorSummary = apiErrorSummaryQuery.data ?? [];
const apiErrorLogs = apiErrorLogsQuery.data ?? [];
const auditLogs = auditLogsQuery.data ?? [];
const systemHealth = systemHealthQuery.data;

const storageLimitMb = Number(organization?.maxStorageMb || 0);
const totalEstimatedMb = Number(usage?.totalEstimatedMb || 0);
const storageUsageRate =
  storageLimitMb > 0 ? Math.round((totalEstimatedMb / storageLimitMb) * 100) : 0;

const isStorageWarning = storageUsageRate >= 80;
const isStorageExceeded = storageUsageRate >= 100;

  const totalRows = useMemo(() => {
    return tableCounts.reduce(
      (sum: number, row: any) => sum + Number(row.rowCount || 0),
      0
    );
  }, [tableCounts]);

  if (user?.role !== "superhost") {
    return <div className="p-6">접근 권한 없음</div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Building2 className="h-6 w-6" />
            회사 상세 모니터링
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            organizationId: {organizationId}
          </p>
        </div>

        <Link href="/saas">
          <Button variant="outline">뒤로가기</Button>
        </Link>
      </div>

      {detailQuery.isLoading ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            회사 상세 정보를 불러오는 중입니다...
          </CardContent>
        </Card>
      ) : detailQuery.isError ? (
        <Card className="rounded-2xl border-red-200">
          <CardContent className="p-6 text-sm text-red-600">
            회사 상세 정보를 불러오지 못했습니다.
          </CardContent>
        </Card>
      ) : !organization ? (
        <Card className="rounded-2xl">
          <CardContent className="p-6 text-sm text-muted-foreground">
            회사를 찾을 수 없습니다.
          </CardContent>
        </Card>
      ) : (
        <>
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>회사 정보</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">회사명</p>
                <p className="font-semibold">{organization.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">URL</p>
                <p className="font-semibold">/{organization.slug}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">플랜</p>
                <Badge variant="secondary">{organization.planCode || "-"}</Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">상태</p>
                <Badge variant="outline">{organization.status || "-"}</Badge>
              </div>
            </CardContent>
          </Card>

<Card className="rounded-2xl">
  <CardHeader>
    <CardTitle>서비스 상태</CardTitle>
  </CardHeader>
  <CardContent className="grid gap-4 text-sm md:grid-cols-4">
    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-emerald-500" />
        <p className="font-semibold">API</p>
      </div>
      <p className="mt-2 text-2xl font-bold text-emerald-600">
        {systemHealth?.api?.status || "-"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        uptime {systemHealth?.api?.uptimeSeconds ?? 0}s
      </p>
    </div>

    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Database
          className={`h-4 w-4 ${
            systemHealth?.db?.status === "ok" ? "text-emerald-500" : "text-red-500"
          }`}
        />
        <p className="font-semibold">DB</p>
      </div>
      <p
        className={`mt-2 text-2xl font-bold ${
          systemHealth?.db?.status === "ok" ? "text-emerald-600" : "text-red-600"
        }`}
      >
        {systemHealth?.db?.status || "-"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        {systemHealth?.db?.dbName || "-"} / {systemHealth?.db?.dbPort || "-"}
      </p>
    </div>

    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-primary" />
        <p className="font-semibold">Runtime</p>
      </div>
      <p className="mt-2 text-2xl font-bold">
        {systemHealth?.runtime?.nodeVersion || "-"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        heap {systemHealth?.runtime?.memoryMb?.heapUsed ?? 0}MB /{" "}
        {systemHealth?.runtime?.memoryMb?.heapTotal ?? 0}MB
      </p>
    </div>

    <div className="rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <Wifi
          className={`h-4 w-4 ${
            systemHealth?.socket?.status === "ok"
              ? "text-emerald-500"
              : "text-yellow-500"
          }`}
        />
        <p className="font-semibold">Socket</p>
      </div>
      <p
        className={`mt-2 text-2xl font-bold ${
          systemHealth?.socket?.status === "ok"
            ? "text-emerald-600"
            : "text-yellow-600"
        }`}
      >
        {systemHealth?.socket?.status || "-"}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        clients {systemHealth?.socket?.connectedClients ?? 0} · rooms{" "}
        {systemHealth?.socket?.rooms ?? 0}
      </p>
    </div>
  </CardContent>
</Card>

<Card className="rounded-2xl">
  <CardHeader>
    <CardTitle>배포 환경</CardTitle>
  </CardHeader>
  <CardContent className="grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-3">
    <div>
      <p className="text-xs text-muted-foreground">NODE_ENV</p>
      <p className="font-semibold">{systemHealth?.env?.nodeEnv || "-"}</p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground">Railway Environment</p>
      <p className="font-semibold">
        {systemHealth?.env?.railwayEnvironment || "-"}
      </p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground">Railway Service</p>
      <p className="font-semibold">
        {systemHealth?.env?.railwayServiceName || "-"}
      </p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground">Railway Project</p>
      <p className="font-semibold">
        {systemHealth?.env?.railwayProjectName || "-"}
      </p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground">Deployment ID</p>
      <p className="break-all font-mono text-xs">
        {systemHealth?.env?.railwayDeploymentId || "-"}
      </p>
    </div>
    <div>
      <p className="text-xs text-muted-foreground">Commit SHA</p>
      <p className="break-all font-mono text-xs">
        {systemHealth?.env?.railwayGitCommitSha || "-"}
      </p>
    </div>

<div>
  <p className="text-xs text-muted-foreground">Commit Short</p>
  <p className="font-mono text-sm font-semibold">
    {systemHealth?.env?.gitCommitShort || "-"}
  </p>
</div>

<div>
  <p className="text-xs text-muted-foreground">Server Started At</p>
  <p className="font-mono text-xs">
    {systemHealth?.env?.serverStartedAt
      ? new Date(systemHealth.env.serverStartedAt).toLocaleString()
      : "-"}
  </p>
</div>

<div>
  <p className="text-xs text-muted-foreground">Health Checked At</p>
  <p className="font-mono text-xs">
    {systemHealth?.env?.checkedAt
      ? new Date(systemHealth.env.checkedAt).toLocaleString()
      : "-"}
  </p>
</div>
  </CardContent>
</Card>

          <div className="grid gap-4 md:grid-cols-5">
            <Card className="rounded-2xl">
              <CardContent className="flex items-center gap-3 p-5">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">총 Row</p>
                  <p className="text-2xl font-bold">{totalRows}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardContent className="flex items-center gap-3 p-5">
                <HardDrive className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">총 추정 사용량</p>
<p className="text-2xl font-bold">
  {usage?.totalEstimatedMb ?? 0}MB
</p>
<p className="mt-1 text-xs text-muted-foreground">
  DB {usage?.estimatedDatabaseMb ?? 0}MB · 백업 {usage?.backupStorageMb ?? 0}MB
</p>
<p className="mt-1 text-xs text-muted-foreground">
  제한 {organization.maxStorageMb ?? "-"}MB
</p>
{storageLimitMb > 0 ? (
  <div className="mt-3">
    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
      <div
        className={`h-full rounded-full ${
          isStorageExceeded
            ? "bg-red-500"
            : isStorageWarning
              ? "bg-yellow-500"
              : "bg-emerald-500"
        }`}
        style={{
          width: `${Math.min(storageUsageRate, 100)}%`,
        }}
      />
    </div>

    <p
      className={`mt-1 text-xs ${
        isStorageExceeded
          ? "text-red-600"
          : isStorageWarning
            ? "text-yellow-600"
            : "text-muted-foreground"
      }`}
    >
      사용률 {storageUsageRate}%
      {isStorageExceeded
        ? " · 제한 초과"
        : isStorageWarning
          ? " · 주의 필요"
          : ""}
    </p>
  </div>
) : null}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl">
              <CardContent className="flex items-center gap-3 p-5">
                <History className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">최근 백업 수</p>
                  <p className="text-2xl font-bold">{backups.length}</p>
                </div>
              </CardContent>
            </Card>

<Card className="rounded-2xl">
  <CardContent className="flex items-center gap-3 p-5">
    <AlertTriangle className="h-5 w-5 text-red-500" />
    <div>
      <p className="text-xs text-muted-foreground">최근 7일 API 오류</p>
      <p className="text-2xl font-bold text-red-600">
        {apiErrorSummary.reduce(
          (sum: number, row: any) => sum + Number(row.errorCount || 0),
          0
        )}
      </p>
    </div>
  </CardContent>
</Card>

<Card className="rounded-2xl">
  <CardContent className="flex items-center gap-3 p-5">
    <History className="h-5 w-5 text-primary" />
    <div>
      <p className="text-xs text-muted-foreground">최근 활동 로그</p>
      <p className="text-2xl font-bold">{auditLogs.length}</p>
    </div>
  </CardContent>
</Card>
          </div>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>테이블별 데이터 수</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left">테이블</th>
                      <th className="px-4 py-3 text-right">Row 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableCounts.map((row: any) => (
                      <tr key={row.tableName} className="border-t">
                        <td className="px-4 py-3">{row.tableName}</td>
                        <td className="px-4 py-3 text-right font-medium">
                          {row.rowCount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>최근 백업</CardTitle>
            </CardHeader>
            <CardContent>
              {backups.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  백업 이력이 없습니다.
                </div>
              ) : (
                <div className="space-y-3">
                  {backups.map((backup: any) => (
                    <div key={backup.id} className="rounded-xl border p-4 text-sm">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">
                          #{backup.id} / {backup.backupType}
                        </div>
                        <Badge variant="secondary">{backup.status}</Badge>
                      </div>
                      <div className="mt-2 grid gap-2 text-xs text-muted-foreground md:grid-cols-3">
                        <div>파일: {backup.fileSizeBytes || 0} bytes</div>
                        <div>테이블: {backup.tableCount || 0}</div>
                        <div>Row: {backup.rowCount || 0}</div>
                        <div>
                          생성:{" "}
                          {backup.createdAt
                            ? new Date(backup.createdAt).toLocaleString()
                            : "-"}
                        </div>
                        <div>
                          완료:{" "}
                          {backup.completedAt
                            ? new Date(backup.completedAt).toLocaleString()
                            : "-"}
                        </div>
                        <div>
                          복구:{" "}
                          {backup.restoredAt
                            ? new Date(backup.restoredAt).toLocaleString()
                            : "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
<Card className="rounded-2xl">
  <CardHeader>
    <CardTitle>최근 7일 API 오류 요약</CardTitle>
  </CardHeader>
  <CardContent>
    {apiErrorSummary.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        최근 API 오류가 없습니다.
      </p>
    ) : (
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">API</th>
              <th className="px-4 py-3 text-right">상태</th>
              <th className="px-4 py-3 text-right">횟수</th>
              <th className="px-4 py-3 text-right">최근 발생</th>
            </tr>
          </thead>
          <tbody>
            {apiErrorSummary.map((row: any) => (
              <tr key={`${row.path}-${row.statusCode}`} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">{row.path}</td>
                <td className="px-4 py-3 text-right">{row.statusCode}</td>
                <td className="px-4 py-3 text-right font-bold text-red-600">
                  {row.errorCount}
                </td>
                <td className="px-4 py-3 text-right text-xs">
                  {row.latestAt
                    ? new Date(row.latestAt).toLocaleString()
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

<Card className="rounded-2xl">
  <CardHeader>
    <CardTitle>최근 API 오류 로그</CardTitle>
  </CardHeader>
  <CardContent>
    {apiErrorLogs.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        저장된 API 오류 로그가 없습니다.
      </p>
    ) : (
      <div className="space-y-2">
        {apiErrorLogs.map((log: any) => (
          <div key={log.id} className="rounded-xl border p-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-xs font-semibold">{log.path}</p>
              <Badge variant="destructive">{log.statusCode}</Badge>
            </div>

            <p className="mt-2 text-red-600">
              {log.errorMessage || "-"}
            </p>

            <p className="mt-1 text-xs text-muted-foreground">
              userId: {log.userId || "-"} · role: {log.userRole || "-"} ·{" "}
              {log.createdAt
                ? new Date(log.createdAt).toLocaleString()
                : "-"}
            </p>
          </div>
        ))}
      </div>
    )}
  </CardContent>
</Card>

<Card className="rounded-2xl">
  <CardHeader>
    <CardTitle>최근 활동 로그</CardTitle>
  </CardHeader>
  <CardContent>
    {auditLogs.length === 0 ? (
      <p className="text-sm text-muted-foreground">
        저장된 활동 로그가 없습니다.
      </p>
    ) : (
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left">액션</th>
              <th className="px-4 py-3 text-left">대상</th>
              <th className="px-4 py-3 text-right">사용자</th>
              <th className="px-4 py-3 text-right">역할</th>
              <th className="px-4 py-3 text-right">시간</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log: any) => (
              <tr key={log.id} className="border-t">
                <td className="px-4 py-3 font-mono text-xs">
                  {log.action || "-"}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium">
                    {log.targetType || "-"}
                    {log.targetId ? ` #${log.targetId}` : ""}
                  </div>
                  {log.memo ? (
                    <div className="mt-1 max-w-[520px] truncate text-xs text-muted-foreground">
                      {log.memo}
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right">
                  {log.actorUserId || "-"}
                </td>
                <td className="px-4 py-3 text-right">
                  {log.actorRole || "-"}
                </td>
                <td className="px-4 py-3 text-right text-xs">
                  {log.createdAt
                    ? new Date(log.createdAt).toLocaleString()
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
        </>
      )}
    </div>
  );
}