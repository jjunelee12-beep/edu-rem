import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type RequirementType = "전공필수" | "전공선택" | "교양" | "일반";

export default function SubjectCatalogMasterPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isHost =
    user?.role === "host" || user?.role === "superhost";

  const [selectedCatalogId, setSelectedCatalogId] = useState<number | null>(null);

  const [openCatalogDialog, setOpenCatalogDialog] = useState(false);
  const [newCatalogName, setNewCatalogName] = useState("");

  const [openItemDialog, setOpenItemDialog] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newRequirementType, setNewRequirementType] =
    useState<RequirementType>("전공필수");

  const { data: catalogList, isLoading: catalogLoading } =
    trpc.subjectCatalog.list.useQuery({
      activeOnly: false,
    });

  const { data: itemList, isLoading: itemLoading } =
    trpc.subjectCatalog.itemList.useQuery(
      {
        catalogId: Number(selectedCatalogId || 0),
        activeOnly: false,
      },
      {
        enabled: !!selectedCatalogId,
      }
    );

  useEffect(() => {
    if (!catalogList?.length) {
      setSelectedCatalogId(null);
      return;
    }

    const exists = catalogList.some(
      (item: any) => Number(item.id) === Number(selectedCatalogId)
    );

    if (!exists) {
      setSelectedCatalogId(Number(catalogList[0].id));
    }
  }, [catalogList, selectedCatalogId]);

  const createCatalogMut = trpc.subjectCatalog.create.useMutation({
    onSuccess: async () => {
      await utils.subjectCatalog.list.invalidate();
      toast.success("과정이 추가되었습니다.");
      setNewCatalogName("");
      setOpenCatalogDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteCatalogMut = trpc.subjectCatalog.delete.useMutation({
    onSuccess: async () => {
      await utils.subjectCatalog.list.invalidate();
      await utils.subjectCatalog.itemList.invalidate();
      toast.success("과정이 삭제되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const createItemMut = trpc.subjectCatalog.itemCreate.useMutation({
    onSuccess: async () => {
      await utils.subjectCatalog.itemList.invalidate();
      toast.success("과목이 추가되었습니다.");
      setNewSubjectName("");
      setNewRequirementType("전공필수");
      setOpenItemDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteItemMut = trpc.subjectCatalog.itemDelete.useMutation({
    onSuccess: async () => {
      await utils.subjectCatalog.itemList.invalidate();
      toast.success("과목이 삭제되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const groupedItems = useMemo(() => {
    const map: Record<RequirementType, any[]> = {
      전공필수: [],
      전공선택: [],
      교양: [],
      일반: [],
    };

    (itemList || []).forEach((item: any) => {
      const key = (item.requirementType || "전공선택") as RequirementType;
      if (!map[key]) map[key] = [];
      map[key].push(item);
    });

    return map;
  }, [itemList]);

  const handleCreateCatalog = () => {
    const name = newCatalogName.trim();
    if (!name) {
      toast.error("과정명을 입력해주세요.");
      return;
    }

    createCatalogMut.mutate({
      name,
    } as any);
  };

  const handleCreateItem = () => {
    if (!selectedCatalogId) {
      toast.error("과정을 먼저 선택해주세요.");
      return;
    }

    const subjectName = newSubjectName.trim();
    if (!subjectName) {
      toast.error("과목명을 입력해주세요.");
      return;
    }

    createItemMut.mutate({
      catalogId: selectedCatalogId,
      subjectName,
      requirementType: newRequirementType,
      credits: 3,
    } as any);
  };

  const requirementBadgeClass = (type: RequirementType) => {
    if (type === "전공필수") return "bg-red-100 text-red-700";
    if (type === "전공선택") return "bg-emerald-100 text-emerald-700";
    if (type === "교양") return "bg-blue-100 text-blue-700";
    return "bg-gray-100 text-gray-700";
  };

  if (!isHost) {
    return (
      <div className="p-6">
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            호스트만 접근할 수 있습니다.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">학점은행제 과정 관리</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              사회복지사, 보육교사, 아동학사 등 과정을 관리합니다.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              setNewCatalogName("");
              setOpenCatalogDialog(true);
            }}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            추가
          </Button>
        </CardHeader>

        <CardContent className="space-y-3">
          {catalogLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              불러오는 중...
            </div>
          ) : !catalogList?.length ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              등록된 과정이 없습니다.
            </div>
          ) : (
            catalogList.map((catalog: any) => {
              const active = Number(catalog.id) === Number(selectedCatalogId);

              return (
                <div
                  key={catalog.id}
                  className={`rounded-xl border p-3 cursor-pointer transition ${
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border bg-white hover:bg-muted/30"
                  }`}
                  onClick={() => setSelectedCatalogId(Number(catalog.id))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-black">
                        {catalog.name}
                      </div>
                      <div className="mt-1">
                        <Badge
                          className={
                            catalog.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {catalog.isActive ? "사용중" : "비활성"}
                        </Badge>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();

                        if (
                          confirm(
                            `"${catalog.name}" 과정을 삭제하시겠습니까?\n연결된 과목도 함께 삭제됩니다.`
                          )
                        ) {
                          deleteCatalogMut.mutate({
                            id: Number(catalog.id),
                          });
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">학점은행제 과목 관리</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              선택한 과정의 전공필수 / 전공선택 / 교양 / 일반 과목을 관리합니다.
            </p>
          </div>

          <Button
            size="sm"
            onClick={() => {
              if (!selectedCatalogId) {
                toast.error("과정을 먼저 선택해주세요.");
                return;
              }
              setNewSubjectName("");
              setNewRequirementType("전공필수");
              setOpenItemDialog(true);
            }}
            className="gap-1"
          >
            <Plus className="h-4 w-4" />
            과목 추가
          </Button>
        </CardHeader>

        <CardContent>
          {!selectedCatalogId ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              왼쪽에서 과정을 선택해주세요.
            </div>
          ) : itemLoading ? (
            <div className="text-sm text-muted-foreground py-10 text-center">
              과목을 불러오는 중...
            </div>
          ) : (
            <div className="space-y-6">
              {(["전공필수", "전공선택", "교양", "일반"] as RequirementType[]).map(
                (type) => (
                  <div key={type} className="rounded-xl border overflow-hidden">
                    <div className="px-4 py-3 border-b bg-muted/40 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={requirementBadgeClass(type)}>
                          {type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {(groupedItems[type] || []).length}개
                        </span>
                      </div>
                    </div>

                    <div className="divide-y">
                      {!groupedItems[type]?.length ? (
                        <div className="px-4 py-6 text-sm text-muted-foreground text-center">
                          등록된 과목이 없습니다.
                        </div>
                      ) : (
                        groupedItems[type].map((item: any) => (
                          <div
                            key={item.id}
                            className="px-4 py-3 flex items-center justify-between gap-3"
                          >
                            <div>
                              <div className="font-medium text-black">
                                {item.subjectName}
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                학점 {Number(item.credits || 3)} / 카테고리 {item.category}
                              </div>
                            </div>

                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (
                                  confirm(
                                    `"${item.subjectName}" 과목을 삭제하시겠습니까?`
                                  )
                                ) {
                                  deleteItemMut.mutate({
                                    id: Number(item.id),
                                  });
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={openCatalogDialog} onOpenChange={setOpenCatalogDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>과정 추가</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">과정명</label>
            <Input
              value={newCatalogName}
              onChange={(e) => setNewCatalogName(e.target.value)}
              placeholder="예: 사회복지사"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateCatalog();
              }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenCatalogDialog(false)}
            >
              취소
            </Button>
            <Button onClick={handleCreateCatalog} disabled={createCatalogMut.isPending}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openItemDialog} onOpenChange={setOpenItemDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>과목 추가</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">과목명</label>
              <Input
                value={newSubjectName}
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="예: 사회복지학개론"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">구분</label>
              <select
                className="w-full h-10 px-3 text-sm border rounded-md bg-white"
                value={newRequirementType}
                onChange={(e) =>
                  setNewRequirementType(e.target.value as RequirementType)
                }
              >
                <option value="전공필수">전공필수</option>
                <option value="전공선택">전공선택</option>
                <option value="교양">교양</option>
                <option value="일반">일반</option>
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenItemDialog(false)}
            >
              취소
            </Button>
            <Button onClick={handleCreateItem} disabled={createItemMut.isPending}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}