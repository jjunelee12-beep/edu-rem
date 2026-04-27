import { useEffect, useMemo, useState } from "react";
import { trpc } from "@/lib/trpc";
import { formatPhone } from "@/lib/format";

type PreviewItem = {
  id: string;
  name: string;
  phone: string;
  course: string;
  targetType: "consultation" | "student";
  category: "미등록" | "등록";
  assigneeId: number | null;
};

type AssigneeItem = {
  id: number;
  name: string;
  phone: string;
};

export default function SmsSender() {
  const [includeConsultations, setIncludeConsultations] = useState(true);
  const [includeStudents, setIncludeStudents] = useState(false);

  const [assigneeId, setAssigneeId] = useState<number | undefined>(undefined);
  const [assigneeKeyword, setAssigneeKeyword] = useState("");
  const [keyword, setKeyword] = useState("");
const [searchType, setSearchType] = useState<"all" | "name" | "phone" | "course">("course");

const [smsSettings, setSmsSettings] = useState({
  provider: "aligo",
  apiKey: "",
  userId: "",
  senderNumber: "",
  senderName: "",
  isActive: true,
});

  const [message, setMessage] = useState("");
  const [testPhone, setTestPhone] = useState("");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const assigneesQuery = trpc.sms.assignees.useQuery();

const smsSettingsQuery = trpc.sms.settings.useQuery();

const saveSmsSettingsMutation = trpc.sms.saveSettings.useMutation({
  onSuccess: async () => {
    alert("문자 API 설정이 저장되었습니다.");
    await smsSettingsQuery.refetch();
  },
  onError: (err) => {
    alert(err.message || "문자 API 설정 저장 중 오류가 발생했습니다.");
  },
});

  const preview = trpc.sms.preview.useQuery({
  includeConsultations,
  includeStudents,
  assigneeId,
  keyword,
  searchType,
});

  const sendMutation = trpc.sms.send.useMutation();
  const testSendMutation = trpc.sms.testSend.useMutation();

  const assignees: AssigneeItem[] = assigneesQuery.data?.items ?? [];
console.log("assigneesQuery.data", assigneesQuery.data);
console.log("assignees", assignees);
  const items: PreviewItem[] = preview.data?.items ?? [];
console.log("preview.data", preview.data);
console.log("preview.items", items);

useEffect(() => {
  if (!smsSettingsQuery.data) return;

  setSmsSettings({
    provider: smsSettingsQuery.data.provider || "aligo",
    apiKey: smsSettingsQuery.data.apiKey || "",
    userId: smsSettingsQuery.data.userId || "",
    senderNumber: smsSettingsQuery.data.senderNumber || "",
    senderName: smsSettingsQuery.data.senderName || "",
    isActive:
      smsSettingsQuery.data.isActive === undefined
        ? true
        : Boolean(smsSettingsQuery.data.isActive),
  });
}, [smsSettingsQuery.data]);

  const filteredAssignees = useMemo(() => {
    const q = assigneeKeyword.trim().toLowerCase();
    if (!q) return assignees;

    return assignees.filter((item) => {
      return (
        String(item.name || "").toLowerCase().includes(q) ||
        String(item.phone || "").toLowerCase().includes(q)
      );
    });
  }, [assignees, assigneeKeyword]);

  const selectedAssignee = useMemo(() => {
    return assignees.find((a) => a.id === assigneeId);
  }, [assignees, assigneeId]);

  useEffect(() => {
    setSelectedIds(items.map((item) => item.id));
  }, [items]);

  const selectedItems = useMemo(() => {
    const selectedSet = new Set(selectedIds);
    return items.filter((item) => selectedSet.has(item.id));
  }, [items, selectedIds]);

  const selectedPhones = useMemo(() => {
    return [...new Set(selectedItems.map((item) => item.phone).filter(Boolean))];
  }, [selectedItems]);

  const toggleItem = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedIds(items.map((item) => item.id));
  };

  const handleClearAll = () => {
    setSelectedIds([]);
  };

  const handleSend = () => {
    if (!message.trim()) {
      alert("문자 내용을 입력하세요.");
      return;
    }

    if (selectedPhones.length === 0) {
      alert("발송할 대상을 선택하세요.");
      return;
    }

    sendMutation.mutate(
      {
        phones: selectedPhones,
        message,
      },
      {
        onSuccess: (res) => {
          alert(
            `문자 발송 완료\n총 ${res.total}건\n성공 ${res.success}건\n실패 ${res.fail}건`
          );
        },
        onError: (err) => {
          alert(err.message || "문자 발송 중 오류가 발생했습니다.");
        },
      }
    );
  };

const handleSaveSmsSettings = () => {
  if (!smsSettings.apiKey.trim()) {
    alert("API Key를 입력하세요.");
    return;
  }

  if (!smsSettings.userId.trim()) {
    alert("알리고 User ID를 입력하세요.");
    return;
  }

  if (!smsSettings.senderNumber.trim()) {
    alert("발신번호를 입력하세요.");
    return;
  }

  saveSmsSettingsMutation.mutate({
    ...smsSettings,
    senderNumber: smsSettings.senderNumber.replace(/\D/g, ""),
  });
};

  const handleTest = () => {
    if (!message.trim()) {
      alert("문자 내용을 입력하세요.");
      return;
    }

    if (!testPhone.trim()) {
      alert("테스트 번호를 입력하세요.");
      return;
    }

    testSendMutation.mutate(
      {
        phone: testPhone,
        message,
      },
      {
        onSuccess: (res) => {
          alert(
            `테스트 발송 완료\n총 ${res.total}건\n성공 ${res.success}건\n실패 ${res.fail}건`
          );
        },
        onError: (err) => {
          alert(err.message || "테스트 발송 중 오류가 발생했습니다.");
        },
      }
    );
  };

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-2xl font-bold">문자 발송</h1>

<div className="border rounded-lg p-4 bg-white space-y-4">
  <div className="flex items-center justify-between gap-3">
    <div>
      <h2 className="font-semibold text-lg">문자 API 설정</h2>
      <p className="text-xs text-gray-500 mt-1">
        SaaS 사용 회사별로 알리고 API 정보를 입력하면 해당 설정으로 문자 발송됩니다.
      </p>
    </div>

    <button
      type="button"
      onClick={handleSaveSmsSettings}
      disabled={saveSmsSettingsMutation.isPending}
      className="px-4 py-2 rounded bg-slate-900 text-white text-sm disabled:opacity-50"
    >
      {saveSmsSettingsMutation.isPending ? "저장 중..." : "API 설정 저장"}
    </button>
  </div>

  <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
    <div className="space-y-1">
      <label className="text-sm font-medium">제공사</label>
      <select
        className="w-full border rounded p-2"
        value={smsSettings.provider}
        onChange={(e) =>
          setSmsSettings((prev) => ({ ...prev, provider: e.target.value }))
        }
      >
        <option value="aligo">알리고</option>
      </select>
    </div>

    <div className="space-y-1">
      <label className="text-sm font-medium">API Key</label>
      <input
        className="w-full border rounded p-2"
        value={smsSettings.apiKey}
        onChange={(e) =>
          setSmsSettings((prev) => ({ ...prev, apiKey: e.target.value }))
        }
        placeholder="알리고 API Key"
      />
    </div>

    <div className="space-y-1">
      <label className="text-sm font-medium">User ID</label>
      <input
        className="w-full border rounded p-2"
        value={smsSettings.userId}
        onChange={(e) =>
          setSmsSettings((prev) => ({ ...prev, userId: e.target.value }))
        }
        placeholder="알리고 아이디"
      />
    </div>

    <div className="space-y-1">
      <label className="text-sm font-medium">발신번호</label>
      <input
        className="w-full border rounded p-2"
        value={smsSettings.senderNumber}
        onChange={(e) =>
          setSmsSettings((prev) => ({
            ...prev,
            senderNumber: e.target.value.replace(/[^0-9-]/g, ""),
          }))
        }
        placeholder="예: 01012345678"
      />
    </div>

    <div className="space-y-1">
      <label className="text-sm font-medium">사용 여부</label>
      <select
        className="w-full border rounded p-2"
        value={smsSettings.isActive ? "true" : "false"}
        onChange={(e) =>
          setSmsSettings((prev) => ({
            ...prev,
            isActive: e.target.value === "true",
          }))
        }
      >
        <option value="true">사용</option>
        <option value="false">미사용</option>
      </select>
    </div>
  </div>
</div>

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* 좌측 패널 */}
        <div className="border rounded-lg p-4 space-y-5 bg-white">
          <div className="space-y-3">
            <h2 className="font-semibold text-lg">발송 설정</h2>

            <div className="flex flex-col gap-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeConsultations}
                  onChange={(e) => setIncludeConsultations(e.target.checked)}
                />
                <span>미등록자</span>
              </label>

              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={includeStudents}
                  onChange={(e) => setIncludeStudents(e.target.checked)}
                />
                <span>등록자</span>
              </label>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block font-medium">담당자 검색</label>
            <input
              className="w-full border rounded p-2"
              placeholder="담당자명 / 전화번호 검색"
              value={assigneeKeyword}
              onChange={(e) => setAssigneeKeyword(e.target.value)}
            />
	<div className="text-xs text-gray-500">
  검색 결과: {filteredAssignees.length}명
</div>

            <div className="border rounded max-h-60 overflow-auto bg-white">
              <button
                type="button"
                onClick={() => setAssigneeId(undefined)}
                className={`w-full text-left px-3 py-2 border-b hover:bg-gray-50 ${
                  assigneeId === undefined ? "bg-blue-50 font-medium" : ""
                }`}
              >
                전체 담당자
              </button>

              {assigneesQuery.isLoading ? (
                <div className="px-3 py-3 text-sm text-gray-500">불러오는 중...</div>
              ) : filteredAssignees.length === 0 ? (
                <div className="px-3 py-3 text-sm text-gray-500">
                  담당자가 없습니다.
                </div>
              ) : (
               filteredAssignees.map((item) => (
  <button
    key={item.id}
    type="button"
    onClick={() => setAssigneeId(item.id)}
    className={`w-full text-left px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 ${
      assigneeId === item.id ? "bg-blue-50 font-medium text-blue-700" : ""
    }`}
  >
    <div className="font-medium">{item.name || "-"}</div>
    <div className="text-xs text-gray-500">
  {item.phone ? formatPhone(item.phone) : "-"}
</div>
  </button>
))
              )}
            </div>

            <div className="text-xs text-gray-500">
              선택 담당자:{" "}
            {selectedAssignee
  ? `${selectedAssignee.name} / ${selectedAssignee.phone ? formatPhone(selectedAssignee.phone) : "-"}`
  : "전체"}
            </div>
          </div>

          <div className="space-y-2">
  <label className="block font-medium">고객 검색</label>

  <div className="grid grid-cols-[110px_1fr] gap-2">
    <select
      className="border rounded p-2"
      value={searchType}
      onChange={(e) => setSearchType(e.target.value as any)}
    >
      <option value="course">희망과정</option>
      <option value="name">이름</option>
      <option value="phone">전화번호</option>
      <option value="all">전체</option>
    </select>

    <input
      className="w-full border rounded p-2"
      placeholder={
        searchType === "course"
          ? "희망과정 검색 예: 사회복지사"
          : searchType === "name"
          ? "이름 검색"
          : searchType === "phone"
          ? "전화번호 검색"
          : "이름 / 전화번호 / 희망과정 검색"
      }
      value={keyword}
      onChange={(e) => setKeyword(e.target.value)}
    />
  </div>
</div>

          <div className="space-y-2">
            <label className="block font-medium">문자 내용</label>
            <textarea
              className="w-full border rounded p-3 h-40"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="문자 내용을 입력하세요"
            />
          </div>

          <div className="space-y-2">
            <label className="block font-medium">테스트 번호</label>
            <div className="flex gap-2">
              <input
                className="flex-1 border rounded p-2"
                placeholder="테스트 번호 입력"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
              />
              <button
                onClick={handleTest}
                disabled={testSendMutation.isPending}
                className="bg-gray-700 text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {testSendMutation.isPending ? "발송중..." : "테스트 발송"}
              </button>
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="mb-3 text-sm">
              선택 발송 인원: <b>{selectedItems.length}</b>명
            </div>

            <button
              onClick={handleSend}
              disabled={sendMutation.isPending || selectedPhones.length === 0}
              className="w-full bg-blue-600 text-white px-6 py-3 rounded disabled:opacity-50"
            >
              {sendMutation.isPending ? "발송중..." : "선택 문자 발송"}
            </button>
          </div>
        </div>

        {/* 우측 패널 */}
        <div className="border rounded-lg p-4 bg-white space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="font-semibold text-lg">발송 대상 리스트</h2>

            <div className="flex gap-2">
              <button
                onClick={handleSelectAll}
                className="border rounded px-3 py-2 text-sm"
                type="button"
              >
                전체 선택
              </button>
              <button
                onClick={handleClearAll}
                className="border rounded px-3 py-2 text-sm"
                type="button"
              >
                전체 해제
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-600">
            조회 대상: <b>{preview.data?.total ?? 0}</b>명 / 선택 인원:{" "}
            <b>{selectedItems.length}</b>명
          </div>

          {preview.isLoading ? (
            <div className="py-10 text-center text-gray-500">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center text-gray-500">
              발송 대상이 없습니다.
            </div>
          ) : (
            <div className="overflow-auto border rounded">
              <table className="w-full border-collapse text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="border-b px-3 py-2 text-left w-16">선택</th>
                    <th className="border-b px-3 py-2 text-left">이름</th>
                    <th className="border-b px-3 py-2 text-left">전화번호</th>
                    <th className="border-b px-3 py-2 text-left">희망과정</th>
                    <th className="border-b px-3 py-2 text-left">구분</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const checked = selectedIds.includes(item.id);

                    return (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="border-b px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItem(item.id)}
                          />
                        </td>
                        <td className="border-b px-3 py-2">{item.name || "-"}</td>
                        <td className="border-b px-3 py-2">{item.phone ? formatPhone(item.phone) : "-"}</td>
                        <td className="border-b px-3 py-2">{item.course || "-"}</td>
                        <td className="border-b px-3 py-2">{item.category}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {(sendMutation.data || testSendMutation.data) && (
            <div className="border rounded p-3 bg-gray-50 text-sm space-y-1">
              <div className="font-medium">최근 발송 결과</div>

              {sendMutation.data && (
                <div>
                  실제 발송 → 총 {sendMutation.data.total}건 / 성공{" "}
                  {sendMutation.data.success}건 / 실패 {sendMutation.data.fail}건
                </div>
              )}

              {testSendMutation.data && (
                <div>
                  테스트 발송 → 총 {testSendMutation.data.total}건 / 성공{" "}
                  {testSendMutation.data.success}건 / 실패{" "}
                  {testSendMutation.data.fail}건
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}