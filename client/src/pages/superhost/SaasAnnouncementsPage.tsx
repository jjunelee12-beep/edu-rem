import { useMemo, useState } from "react";
import { Megaphone, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";

import SaasAdminGuard from "@/components/saas/SaasAdminGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const TYPE_LABEL: Record<string, string> = {
  notice: "공지",
  update: "업데이트",
  maintenance: "점검",
  billing: "결제",
};

export default function SaasAnnouncementsPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    title: "",
    content: "",
    type: "notice" as "notice" | "update" | "maintenance" | "billing",
    versionLabel: "",
    ctaText: "",
    ctaUrl: "",
    isActive: true,
    startsAt: "",
    endsAt: "",
  });

  const announcementsQuery = trpc.saas.listAnnouncements.useQuery(undefined, {
    enabled: user?.role === "superhost",
  });

  const createMut = trpc.saas.createAnnouncement.useMutation({
    onSuccess: async () => {
      toast.success("SaaS 공지가 등록되었습니다.");
      setForm({
        title: "",
        content: "",
        type: "notice",
        versionLabel: "",
        ctaText: "",
        ctaUrl: "",
        isActive: true,
        startsAt: "",
        endsAt: "",
      });
      await utils.saas.listAnnouncements.invalidate();
      await utils.saas.getActiveAnnouncement.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "공지 등록에 실패했습니다.");
    },
  });

  const updateMut = trpc.saas.updateAnnouncement.useMutation({
    onSuccess: async () => {
      toast.success("공지 상태가 변경되었습니다.");
      await utils.saas.listAnnouncements.invalidate();
      await utils.saas.getActiveAnnouncement.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "공지 수정에 실패했습니다.");
    },
  });

  const deleteMut = trpc.saas.deleteAnnouncement.useMutation({
    onSuccess: async () => {
      toast.success("공지 노출이 중지되었습니다.");
      await utils.saas.listAnnouncements.invalidate();
      await utils.saas.getActiveAnnouncement.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "공지 중지에 실패했습니다.");
    },
  });

  const announcements = announcementsQuery.data ?? [];

  const activeCount = useMemo(() => {
    return announcements.filter((item: any) => item.isActive).length;
  }, [announcements]);

  const toDateOrNull = (value: string) => {
    if (!value) return null;
    return new Date(value);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      toast.error("제목을 입력해주세요.");
      return;
    }

    if (!form.content.trim()) {
      toast.error("내용을 입력해주세요.");
      return;
    }

    await createMut.mutateAsync({
      title: form.title.trim(),
      content: form.content.trim(),
      type: form.type,
      versionLabel: form.versionLabel.trim() || null,
      ctaText: form.ctaText.trim() || null,
      ctaUrl: form.ctaUrl.trim() || null,
      isActive: form.isActive,
      startsAt: toDateOrNull(form.startsAt),
      endsAt: toDateOrNull(form.endsAt),
    });
  };

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

  return (
    <SaasAdminGuard>
      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
              <Megaphone className="h-6 w-6 text-primary" />
              SaaS 공지 관리
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              전체 고객에게 노출되는 업데이트/점검/결제 공지 팝업을 관리합니다.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => announcementsQuery.refetch()}
            disabled={announcementsQuery.isFetching}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${
                announcementsQuery.isFetching ? "animate-spin" : ""
              }`}
            />
            새로고침
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">전체 공지</p>
              <p className="mt-1 text-2xl font-bold">{announcements.length}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">활성 공지</p>
              <p className="mt-1 text-2xl font-bold">{activeCount}</p>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-5">
              <p className="text-xs text-muted-foreground">노출 방식</p>
              <p className="mt-1 text-sm font-bold">공지 ID별 1회 팝업</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              새 공지 등록
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <Input
                value={form.title}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
                placeholder="공지 제목"
              />

              <select
                value={form.type}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    type: e.target.value as any,
                  }))
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="notice">공지</option>
                <option value="update">업데이트</option>
                <option value="maintenance">점검</option>
                <option value="billing">결제</option>
              </select>
            </div>

            <Textarea
              value={form.content}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, content: e.target.value }))
              }
              placeholder="공지 내용을 입력하세요."
              rows={5}
            />

            <div className="grid gap-3 md:grid-cols-3">
              <Input
                value={form.versionLabel}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    versionLabel: e.target.value,
                  }))
                }
                placeholder="버전명 예: v1.2.0"
              />

              <Input
                value={form.ctaText}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ctaText: e.target.value }))
                }
                placeholder="버튼 문구 예: 자세히 보기"
              />

              <Input
                value={form.ctaUrl}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, ctaUrl: e.target.value }))
                }
                placeholder="버튼 링크"
              />
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <Input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, startsAt: e.target.value }))
                }
              />

              <Input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, endsAt: e.target.value }))
                }
              />
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    isActive: e.target.checked,
                  }))
                }
              />
              즉시 활성화
            </label>

            <Button onClick={handleCreate} disabled={createMut.isPending}>
              공지 등록
            </Button>
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>공지 목록</CardTitle>
          </CardHeader>

          <CardContent>
            {announcementsQuery.isLoading ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                공지 불러오는 중...
              </div>
            ) : announcements.length === 0 ? (
              <div className="py-10 text-center text-sm text-muted-foreground">
                등록된 공지가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left">
                      <th className="px-3 py-3">ID</th>
                      <th className="px-3 py-3">유형</th>
                      <th className="px-3 py-3">제목</th>
                      <th className="px-3 py-3">버전</th>
                      <th className="px-3 py-3">상태</th>
                      <th className="px-3 py-3">기간</th>
                      <th className="px-3 py-3">관리</th>
                    </tr>
                  </thead>

                  <tbody>
                    {announcements.map((item: any) => (
                      <tr key={item.id} className="border-b">
                        <td className="px-3 py-3">{item.id}</td>
                        <td className="px-3 py-3">
                          <Badge variant="outline">
                            {TYPE_LABEL[item.type] || item.type}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <div className="font-medium">{item.title}</div>
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                            {item.content}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-muted-foreground">
                          {item.versionLabel || "-"}
                        </td>
                        <td className="px-3 py-3">
                          <Badge variant={item.isActive ? "default" : "secondary"}>
                            {item.isActive ? "활성" : "비활성"}
                          </Badge>
                        </td>
                        <td className="px-3 py-3 text-xs text-muted-foreground">
                          <div>
                            시작:{" "}
                            {item.startsAt
                              ? new Date(item.startsAt).toLocaleString()
                              : "즉시"}
                          </div>
                          <div>
                            종료:{" "}
                            {item.endsAt
                              ? new Date(item.endsAt).toLocaleString()
                              : "제한 없음"}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                updateMut.mutate({
                                  id: Number(item.id),
                                  isActive: !item.isActive,
                                })
                              }
                              disabled={updateMut.isPending}
                            >
                              {item.isActive ? "비활성" : "활성"}
                            </Button>

                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() =>
                                deleteMut.mutate({ id: Number(item.id) })
                              }
                              disabled={deleteMut.isPending}
                            >
                              중지
                            </Button>
                          </div>
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
    </SaasAdminGuard>
  );
}