import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type PracticeStatus = "미섭외" | "섭외중" | "섭외완료";

export default function PracticeSupportCenter() {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [institution, setInstitution] = useState("");
  const [practiceDate, setPracticeDate] = useState("");

  const { data: students, refetch } = trpc.student.list.useQuery();

  const updatePlanMut = trpc.plan.upsert.useMutation({
    onSuccess: async () => {
      toast.success("실습 정보 저장 완료");
      await refetch();
      setSelectedStudent(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredStudents =
    students?.filter((s: any) => {
      const match =
        s.clientName.includes(search) || s.phone.includes(search);

      return match;
    }) || [];

  const handleStatusChange = (student: any, status: PracticeStatus) => {
    updatePlanMut.mutate({
      studentId: student.id,
      practiceStatus: status,
    } as any);
  };

  const handleAssign = () => {
    if (!selectedStudent) return;

    if (!institution || !practiceDate) {
      toast.error("기관 / 날짜 입력 필수");
      return;
    }

    updatePlanMut.mutate({
      studentId: selectedStudent.id,
      practiceStatus: "섭외완료",
      practiceDate,
      practiceArranged: true,
    } as any);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">실습배정지원센터</h1>

        <Input
          placeholder="이름 / 전화번호 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64"
        />
      </div>

      {/* 리스트 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredStudents.map((s: any) => {
          const plan = s.plan || {};

          return (
            <Card key={s.id} className="cursor-pointer">
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{s.clientName}</p>
                    <p className="text-xs text-muted-foreground">{s.phone}</p>
                  </div>

                  <Badge
                    className={
                      plan.practiceStatus === "섭외완료"
                        ? "bg-green-100 text-green-700"
                        : plan.practiceStatus === "섭외중"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-700"
                    }
                  >
                    {plan.practiceStatus || "미섭외"}
                  </Badge>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(s, "미섭외")}
                  >
                    미섭외
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(s, "섭외중")}
                  >
                    섭외중
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedStudent(s)}
                  >
                    배정
                  </Button>
                </div>

                {plan.practiceDate && (
                  <p className="text-xs text-muted-foreground">
                    예정일: {plan.practiceDate}
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 배정 모달 느낌 */}
      {selectedStudent && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold">
              {selectedStudent.clientName} 실습 배정
            </h2>

            <Input
              placeholder="기관명"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
            />

            <Input
              type="date"
              value={practiceDate}
              onChange={(e) => setPracticeDate(e.target.value)}
            />

            <div className="flex gap-2">
              <Button onClick={handleAssign}>배정 완료</Button>
              <Button
                variant="outline"
                onClick={() => setSelectedStudent(null)}
              >
                취소
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}