import { useMemo, useState } from "react";
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
import { Plus, Trash2, Search } from "lucide-react";
import { toast } from "sonner";

export default function PrivateCertificateMasterPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const isHost =
    user?.role === "host" || user?.role === "superhost";

  const [search, setSearch] = useState("");
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [newName, setNewName] = useState("");

  const { data: certificateList, isLoading } =
    trpc.privateCertificateMaster.list.useQuery({
      activeOnly: false,
    });

  const createMut = trpc.privateCertificateMaster.create.useMutation({
    onSuccess: async () => {
      await utils.privateCertificateMaster.list.invalidate();
      toast.success("민간자격증이 추가되었습니다.");
      setNewName("");
      setOpenCreateDialog(false);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.privateCertificateMaster.delete.useMutation({
    onSuccess: async () => {
      await utils.privateCertificateMaster.list.invalidate();
      toast.success("민간자격증이 삭제되었습니다.");
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredList = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return certificateList || [];

    return (certificateList || []).filter((item: any) =>
      String(item.name || "").toLowerCase().includes(q)
    );
  }, [certificateList, search]);

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) {
      toast.error("자격증명을 입력해주세요.");
      return;
    }

    createMut.mutate({
      name,
    } as any);
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
    <div className="space-y-6">
      <Card className="border-0 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base">민간자격증 관리</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              학생상세의 민간자격증 요청 버튼에서 표시할 목록을 관리합니다.
            </p>
          </div>

          <Button
            onClick={() => {
              setNewName("");
              setOpenCreateDialog(true);
            }}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            민간자격증 추가
          </Button>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="자격증명 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="rounded-xl border overflow-hidden bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground w-[100px]">
                    ID
                  </th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                    자격증명
                  </th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground w-[120px]">
                    상태
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground w-[120px]">
                    관리
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      불러오는 중...
                    </td>
                  </tr>
                ) : filteredList.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      등록된 민간자격증이 없습니다.
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item: any) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{item.id}</td>
                      <td className="px-4 py-3 font-medium text-black">
                        {item.name}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge
                          className={
                            item.isActive
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-gray-100 text-gray-600"
                          }
                        >
                          {item.isActive ? "사용중" : "비활성"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => {
                              if (
                                confirm(
                                  `"${item.name}" 민간자격증을 삭제하시겠습니까?`
                                )
                              ) {
                                deleteMut.mutate({ id: Number(item.id) });
                              }
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={openCreateDialog} onOpenChange={setOpenCreateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>민간자격증 추가</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">자격증명</label>
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="예: 심리상담사 1급"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpenCreateDialog(false)}
            >
              취소
            </Button>
            <Button onClick={handleCreate} disabled={createMut.isPending}>
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}