import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

type JobStatus = "취업대기" | "지원중" | "면접중" | "취업완료";

export default function JobSupportCenter() {
  const { user } = useAuth();

  const [search, setSearch] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<any>(null);

  const [company, setCompany] = useState("");
  const [salary, setSalary] = useState("");
  const [startDate, setStartDate] = useState("");

  const { data: students, refetch } = trpc.student.list.useQuery();

  const updatePlanMut = trpc.plan.upsert.useMutation({
    onSuccess: async () => {
      toast.success("취업 정보 저장 완료");
      await refetch();
      setSelectedStudent(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const filteredStudents =
    students?.filter((s: any) => {
      return (
        s.clientName.includes(search) ||
        s.phone.includes(search)
      );
    }) || [];

  const handleStatusChange = (student: any, status: JobStatus) => {
    updatePlanMut.mutate({
      studentId: student.id,
      jobStatus: status,
    } as any);
  };

  const handleJobComplete = () => {
    if (!selectedStudent) return;

    if (!company || !salary || !startDate) {
      toast.error("회사 / 급여 / 입사일 입력 필수");
      return;
    }

    updatePlanMut.mutate({
      studentId: selectedStudent.id,
      jobStatus: "취업완료",
      jobCompany: company,
      jobSalary: Number(salary),
      jobStartDate: startDate,
    } as any);
  };

  return (
    <div className="space-y-6">
      {/* 상단 */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">취업지원센터</h1>

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
            <Card key={s.id}>
              <CardContent className="p-4 space-y-3">
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{s.clientName}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.phone}
                    </p>
                  </div>

                  <Badge
                    className={
                      plan.jobStatus === "취업완료"
                        ? "bg-green-100 text-green-700"
                        : plan.jobStatus === "면접중"
                        ? "bg-blue-100 text-blue-700"
                        : plan.jobStatus === "지원중"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-700"
                    }
                  >
                    {plan.jobStatus || "취업대기"}
                  </Badge>
                </div>

                {/* 상태 버튼 */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(s, "취업대기")}
                  >
                    대기
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(s, "지원중")}
                  >
                    지원중
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusChange(s, "면접중")}
                  >
                    면접중
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setSelectedStudent(s)}
                  >
                    취업처 입력
                  </Button>
                </div>

                {/* 취업 정보 */}
                {plan.jobCompany && (
                  <div className="text-xs text-muted-foreground">
                    <p>회사: {plan.jobCompany}</p>
                    <p>급여: {plan.jobSalary?.toLocaleString()}원</p>
                    <p>입사일: {plan.jobStartDate}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 취업 등록 영역 */}
      {selectedStudent && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <h2 className="font-semibold">
              {selectedStudent.clientName} 취업 등록
            </h2>

            <Input
              placeholder="회사명"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
            />

            <Input
              placeholder="급여"
              value={salary}
              onChange={(e) => setSalary(e.target.value)}
            />

            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />

            <div className="flex gap-2">
              <Button onClick={handleJobComplete}>
                취업 완료 처리
              </Button>
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