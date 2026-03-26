import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Plus, Save, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function EducationInstitutions() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isHost =
  user?.role === "host" || user?.role === "superhost";

  const { data: institutionList, isLoading } = trpc.educationInstitution.list.useQuery(undefined, {
    enabled: isHost,
  });

  const createMut = trpc.educationInstitution.create.useMutation({
    onSuccess: () => {
      utils.educationInstitution.list.invalidate();
      toast.success("교육원 추가 완료");
      setNewName("");
      setNewSortOrder("");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.educationInstitution.update.useMutation({
    onSuccess: () => {
      utils.educationInstitution.list.invalidate();
      toast.success("교육원 수정 완료");
    },
    onError: (e) => toast.error(e.message),
  });

  const [newName, setNewName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");

  const [editMap, setEditMap] = useState<Record<number, {
    name: string;
    sortOrder: string;
    isActive: boolean;
  }>>({});

  const rows = useMemo(() => {
    const list = institutionList || [];
    return list.map((item: any) => ({
      ...item,
      form: editMap[item.id] ?? {
        name: item.name || "",
        sortOrder: String(item.sortOrder ?? 0),
        isActive: !!item.isActive,
      },
    }));
  }, [institutionList, editMap]);

  const setRowField = (id: number, field: "name" | "sortOrder" | "isActive", value: any) => {
    const original = (institutionList || []).find((x: any) => x.id === id);
    if (!original) return;

    setEditMap((prev) => ({
      ...prev,
      [id]: {
        name: prev[id]?.name ?? original.name ?? "",
        sortOrder: prev[id]?.sortOrder ?? String(original.sortOrder ?? 0),
        isActive: prev[id]?.isActive ?? !!original.isActive,
        [field]: value,
      },
    }));
  };

  const handleCreate = () => {
    if (!newName.trim()) {
      toast.error("교육원명을 입력하세요");
      return;
    }

    createMut.mutate({
      name: newName.trim(),
      sortOrder: newSortOrder ? Number(newSortOrder) : 0,
    });
  };

  const handleSave = (id: number) => {
    const original = (institutionList || []).find((x: any) => x.id === id);
    if (!original) return;

    const form = editMap[id] ?? {
      name: original.name || "",
      sortOrder: String(original.sortOrder ?? 0),
      isActive: !!original.isActive,
    };

    if (!form.name.trim()) {
      toast.error("교육원명을 입력하세요");
      return;
    }

    updateMut.mutate({
      id,
      name: form.name.trim(),
      sortOrder: form.sortOrder ? Number(form.sortOrder) : 0,
      isActive: !!form.isActive,
    });
  };

  if (!isHost) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => setLocation("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          돌아가기
        </Button>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-16 text-center text-muted-foreground">
            호스트 또는 슈퍼호스트만 접근할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">교육원 관리</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            host 전용 · 원격평생교육원 목록 관리
          </p>
        </div>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">교육원 추가</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">교육원명</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="예: 알파원격평생교육원"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">정렬순서</Label>
              <Input
                type="number"
                value={newSortOrder}
                onChange={(e) => setNewSortOrder(e.target.value)}
                placeholder="예: 1"
              />
            </div>

            <div className="flex items-end">
              <Button
                onClick={handleCreate}
                disabled={createMut.isPending}
                className="gap-1 w-full md:w-auto"
              >
                <Plus className="h-4 w-4" />
                추가
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">교육원 목록</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-16 flex items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : !rows.length ? (
            <div className="py-16 text-center text-muted-foreground">
              등록된 교육원이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">ID</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">교육원명</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">정렬순서</th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground">활성</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">저장</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row: any) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{row.id}</td>

                      <td className="px-4 py-3">
                        <Input
                          value={row.form.name}
                          onChange={(e) => setRowField(row.id, "name", e.target.value)}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <Input
                          type="number"
                          value={row.form.sortOrder}
                          onChange={(e) => setRowField(row.id, "sortOrder", e.target.value)}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex justify-center">
                          <Switch
                            checked={!!row.form.isActive}
                            onCheckedChange={(checked) => setRowField(row.id, "isActive", checked)}
                          />
                        </div>
                      </td>

                      <td className="px-4 py-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1"
                          onClick={() => handleSave(row.id)}
                          disabled={updateMut.isPending}
                        >
                          <Save className="h-3.5 w-3.5" />
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
    </div>
  );
}