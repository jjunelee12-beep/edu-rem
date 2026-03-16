import { useState } from "react";
import { trpc } from "@/lib/trpc";

export default function SmsSender() {

  const [includeConsultations, setIncludeConsultations] = useState(true);
  const [includeStudents, setIncludeStudents] = useState(false);
  const [assigneeId, setAssigneeId] = useState<number | undefined>();

  const previewQuery = trpc.sms.preview.useQuery({
    includeConsultations,
    includeStudents,
    assigneeId,
  });

  const assigneesQuery = trpc.sms.assignees.useQuery();

  return (
    <div style={{ padding: 30 }}>

      <h1>문자 발송</h1>

      <div style={{ marginTop: 20 }}>

        <label>
          <input
            type="checkbox"
            checked={includeConsultations}
            onChange={(e) => setIncludeConsultations(e.target.checked)}
          />
          미등록자
        </label>

        <label style={{ marginLeft: 20 }}>
          <input
            type="checkbox"
            checked={includeStudents}
            onChange={(e) => setIncludeStudents(e.target.checked)}
          />
          등록자
        </label>

      </div>

      <div style={{ marginTop: 20 }}>
        <label>담당자</label>

        <select
          onChange={(e) =>
            setAssigneeId(e.target.value ? Number(e.target.value) : undefined)
          }
        >
          <option value="">전체</option>

          {assigneesQuery.data?.map((u: any) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      <div style={{ marginTop: 30 }}>

        <strong>
          예상 발송 인원: {previewQuery.data?.total ?? 0} 명
        </strong>

      </div>

      <div style={{ marginTop: 30 }}>

        <textarea
          placeholder="문자 내용을 입력하세요"
          style={{ width: 400, height: 150 }}
        />

      </div>

      <button style={{ marginTop: 20 }}>
        문자 발송
      </button>

    </div>
  );
}