import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ShieldAlert,
  Calculator,
  Users,
  Link2,
  Pencil,
  UserX,
  UserCheck,
  KeyRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatPhone } from "@/lib/format";

type TabKey = "settlement" | "users" | "forms";
type UserTabKey = "create" | "list" | "role" | "password";
type UserRole = "staff" | "admin" | "host";

export default function System() {
  const { user } = useAuth();
  const [tab, setTab] = useState<TabKey>("users");

  const isHost = user?.role === "host";

  if (!isHost) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <ShieldAlert className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">호스트만 접근할 수 있습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">시스템 관리</h1>
        <p className="text-muted-foreground mt-1">
          정산 기준, 직원 계정, 랜딩폼 링크를 관리합니다.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant={tab === "settlement" ? "default" : "outline"}
          onClick={() => setTab("settlement")}
          className="gap-2"
        >
          <Calculator className="h-4 w-4" />
          정산 시스템 관리
        </Button>

        <Button
          variant={tab === "users" ? "default" : "outline"}
          onClick={() => setTab("users")}
          className="gap-2"
        >
          <Users className="h-4 w-4" />
          직원 계정 관리
        </Button>

        <Button
          variant={tab === "forms" ? "default" : "outline"}
          onClick={() => setTab("forms")}
          className="gap-2"
        >
          <Link2 className="h-4 w-4" />
          랜딩폼 관리
        </Button>
      </div>

      {tab === "settlement" && <SettlementSystemSection />}
      {tab === "users" && <UserManagementSection />}
      {tab === "forms" && <LeadFormManagementSection />}
    </div>
  );
}

function SettlementSystemSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>정산 시스템 관리</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        다음 단계에서 교육원별 학점당 단가 / 실습 수수료 / 정산 기준을 붙일 예정입니다.
      </CardContent>
    </Card>
  );
}

function UserManagementSection() {
  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();

  const createMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("직원 계정이 생성되었습니다.");
      utils.users.list.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const updateMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("직원 정보가 수정되었습니다.");
      utils.users.list.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const updateRoleMutation = trpc.users.updateRole.useMutation({
    onSuccess: () => {
      toast.success("권한이 변경되었습니다.");
      utils.users.list.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const updateActiveMutation = trpc.users.updateActive.useMutation({
    onSuccess: () => {
      toast.success("활성 상태가 변경되었습니다.");
      utils.users.list.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const [userTab, setUserTab] = useState<UserTabKey>("create");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRole>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [passwordSearch, setPasswordSearch] = useState("");

  const [openId, setOpenId] = useState("");
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [createRole, setCreateRole] = useState<UserRole>("staff");

  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editBankName, setEditBankName] = useState("");
  const [editBankAccount, setEditBankAccount] = useState("");

  const [roleDrafts, setRoleDrafts] = useState<Record<number, UserRole>>({});
  const [passwordDrafts, setPasswordDrafts] = useState<Record<number, string>>(
    {}
  );
  const [showPasswordMap, setShowPasswordMap] = useState<
    Record<number, boolean>
  >({});

  const handlePhoneInput = (value: string) =>
    value.replace(/\D/g, "").slice(0, 11);

  const filteredUsers = useMemo(() => {
    let list = users ?? [];

    if (roleFilter !== "all") {
      list = list.filter((u: any) => u.role === roleFilter);
    }

    if (!searchTerm.trim()) return list;

    const term = searchTerm.trim().toLowerCase();
    return list.filter((u: any) => {
      const displayNo = String(u.displayNo ?? u.id ?? "");
      const username = String(u.username ?? "").toLowerCase();
      const name = String(u.name ?? "").toLowerCase();
      const email = String(u.email ?? "").toLowerCase();
      const phone = String(u.phone ?? "");
      return (
        displayNo.includes(term) ||
        username.includes(term) ||
        name.includes(term) ||
        email.includes(term) ||
        phone.includes(term.replace(/\D/g, ""))
      );
    });
  }, [users, roleFilter, searchTerm]);

  const passwordFilteredUsers = useMemo(() => {
    const list = users ?? [];
    const keyword = passwordSearch.trim().toLowerCase();
    if (!keyword) return list;

    return list.filter((u: any) => {
      const displayNo = String(u.displayNo ?? u.id ?? "");
      const username = String(u.username ?? "").toLowerCase();
      const name = String(u.name ?? "").toLowerCase();
      const phone = String(u.phone ?? "");
      return (
        displayNo.includes(keyword) ||
        username.includes(keyword) ||
        name.includes(keyword) ||
        phone.includes(keyword.replace(/\D/g, ""))
      );
    });
  }, [users, passwordSearch]);

  const resetCreateForm = () => {
    setOpenId("");
    setUsername("");
    setName("");
    setEmail("");
    setPhone("");
    setPassword("");
    setBankName("");
    setBankAccount("");
    setCreateRole("staff");
  };

  const handleCreate = () => {
    if (!openId.trim()) return toast.error("openId를 입력해주세요.");
    if (!username.trim()) return toast.error("아이디를 입력해주세요.");
    if (!name.trim()) return toast.error("이름을 입력해주세요.");
    if (!password.trim()) return toast.error("비밀번호를 입력해주세요.");

    createMutation.mutate(
      {
        openId: openId.trim(),
        username: username.trim(),
        password: password.trim(),
        name: name.trim(),
        email: email.trim() || undefined,
        phone: phone.trim() || undefined,
        role: createRole,
        bankName: bankName.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
      },
      {
        onSuccess: () => {
          resetCreateForm();
        },
      }
    );
  };

  const startEdit = (u: any) => {
    setEditingUserId(u.id);
    setEditUsername(u.username ?? "");
    setEditName(u.name ?? "");
    setEditEmail(u.email ?? "");
    setEditPhone(u.phone ?? "");
    setEditPassword("");
    setEditBankName(u.bankName ?? "");
    setEditBankAccount(u.bankAccount ?? "");
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setEditUsername("");
    setEditName("");
    setEditEmail("");
    setEditPhone("");
    setEditPassword("");
    setEditBankName("");
    setEditBankAccount("");
  };

  const saveEdit = () => {
    if (!editingUserId) return;

    updateMutation.mutate(
      {
        id: editingUserId,
        username: editUsername.trim() || undefined,
        name: editName.trim() || undefined,
        email: editEmail.trim() || undefined,
        phone: editPhone.trim() || undefined,
        password: editPassword.trim() || undefined,
        bankName: editBankName.trim() || undefined,
        bankAccount: editBankAccount.trim() || undefined,
      },
      {
        onSuccess: () => {
          cancelEdit();
        },
      }
    );
  };

  const handleChangeRole = (userId: number, currentRole: UserRole) => {
    const nextRole = roleDrafts[userId];
    if (!nextRole) {
      toast.error("변경할 권한을 선택해주세요.");
      return;
    }
    if (nextRole === currentRole) {
      toast.error("현재 권한과 동일합니다.");
      return;
    }

    const ok = window.confirm(
      `권한을 ${currentRole} → ${nextRole} 로 변경하시겠습니까?`
    );
    if (!ok) return;

    updateRoleMutation.mutate({
      id: userId,
      role: nextRole,
    });
  };

  const handleToggleActive = (u: any) => {
    const nextActive = !u.isActive;
    const message = nextActive
      ? `${u.name ?? "-"} 계정을 다시 활성화하시겠습니까?`
      : `${u.name ?? "-"} 계정을 비활성화하시겠습니까?\n비활성화 시 로그인할 수 없습니다.`;

    const ok = window.confirm(message);
    if (!ok) return;

    updateActiveMutation.mutate({
      id: u.id,
      isActive: nextActive,
    });
  };

  const handleResetPassword = (u: any) => {
    const newPassword = (passwordDrafts[u.id] || "").trim();

    if (!newPassword) {
      toast.error("새 비밀번호를 입력해주세요.");
      return;
    }

    if (newPassword.length < 4) {
      toast.error("비밀번호는 4자 이상이어야 합니다.");
      return;
    }

    const ok = window.confirm(
      `${u.name || u.username || "사용자"} 계정의 비밀번호를 재설정하시겠습니까?`
    );
    if (!ok) return;

    updateMutation.mutate(
      {
        id: u.id,
        password: newPassword,
      },
      {
        onSuccess: () => {
          toast.success("비밀번호가 재설정되었습니다.");
          setPasswordDrafts((prev) => ({ ...prev, [u.id]: "" }));
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={userTab === "create" ? "default" : "outline"}
          onClick={() => setUserTab("create")}
        >
          직원 생성
        </Button>
        <Button
          variant={userTab === "list" ? "default" : "outline"}
          onClick={() => setUserTab("list")}
        >
          직원 목록
        </Button>
        <Button
          variant={userTab === "role" ? "default" : "outline"}
          onClick={() => setUserTab("role")}
        >
          권한 변경
        </Button>
        <Button
          variant={userTab === "password" ? "default" : "outline"}
          onClick={() => setUserTab("password")}
          className="gap-2"
        >
          <KeyRound className="h-4 w-4" />
          비밀번호 재설정
        </Button>
      </div>

      {userTab === "create" && (
        <Card>
          <CardHeader>
            <CardTitle>직원 계정 생성</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Input
                placeholder="openId (고유 식별값)"
                value={openId}
                onChange={(e) => setOpenId(e.target.value)}
              />
              <Input
                placeholder="아이디(username)"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Input
                placeholder="이름"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <Input
                placeholder="이메일"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Input
                placeholder="전화번호"
                value={phone}
                onChange={(e) => setPhone(handlePhoneInput(e.target.value))}
              />
              <Input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Select
                value={createRole}
                onValueChange={(v: UserRole) => setCreateRole(v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="권한 선택" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="staff">직원</SelectItem>
                  <SelectItem value="admin">관리자</SelectItem>
                  <SelectItem value="host">호스트</SelectItem>
                </SelectContent>
              </Select>
              <Input
                placeholder="은행명"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
              />
              <Input
                placeholder="계좌번호"
                value={bankAccount}
                onChange={(e) => setBankAccount(e.target.value)}
              />
            </div>

            <div>
              <Button onClick={handleCreate} disabled={createMutation.isPending}>
                {createMutation.isPending ? "생성 중..." : "직원 계정 생성"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {userTab === "list" && (
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>직원 목록</CardTitle>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={roleFilter === "all" ? "default" : "outline"}
                onClick={() => setRoleFilter("all")}
              >
                전체
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "host" ? "default" : "outline"}
                onClick={() => setRoleFilter("host")}
              >
                host
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "admin" ? "default" : "outline"}
                onClick={() => setRoleFilter("admin")}
              >
                admin
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "staff" ? "default" : "outline"}
                onClick={() => setRoleFilter("staff")}
              >
                staff
              </Button>
            </div>

            <Input
              placeholder="표시번호, 이름, 아이디, 이메일, 전화번호 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                표시할 계정이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left">번호</th>
                      <th className="px-4 py-3 text-left">아이디</th>
                      <th className="px-4 py-3 text-left">이름</th>
                      <th className="px-4 py-3 text-left">이메일</th>
                      <th className="px-4 py-3 text-left">전화번호</th>
                      <th className="px-4 py-3 text-left">은행명</th>
                      <th className="px-4 py-3 text-left">계좌번호</th>
                      <th className="px-4 py-3 text-left">권한</th>
                      <th className="px-4 py-3 text-left">상태</th>
                      <th className="px-4 py-3 text-right">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u: any) => {
                      const isEditing = editingUserId === u.id;

                      return (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="px-4 py-3">{u.displayNo ?? u.id}</td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editUsername}
                                onChange={(e) => setEditUsername(e.target.value)}
                              />
                            ) : (
                              u.username || "-"
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            ) : (
                              u.name || "-"
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editEmail}
                                onChange={(e) => setEditEmail(e.target.value)}
                              />
                            ) : (
                              u.email || "-"
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editPhone}
                                onChange={(e) =>
                                  setEditPhone(handlePhoneInput(e.target.value))
                                }
                              />
                            ) : (
                              formatPhone(u.phone || "")
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editBankName}
                                onChange={(e) => setEditBankName(e.target.value)}
                              />
                            ) : (
                              u.bankName || "-"
                            )}
                          </td>

                          <td className="px-4 py-3">
                            {isEditing ? (
                              <Input
                                value={editBankAccount}
                                onChange={(e) =>
                                  setEditBankAccount(e.target.value)
                                }
                              />
                            ) : (
                              u.bankAccount || "-"
                            )}
                          </td>

                          <td className="px-4 py-3">{u.role || "-"}</td>

                          <td className="px-4 py-3">
                            {u.isActive ? (
                              <span className="text-emerald-600 font-medium">
                                활성
                              </span>
                            ) : (
                              <span className="text-red-600 font-medium">
                                비활성
                              </span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2 flex-wrap">
                              {isEditing ? (
                                <>
                                  <Input
                                    className="w-[140px]"
                                    placeholder="새 비밀번호(선택)"
                                    type="password"
                                    value={editPassword}
                                    onChange={(e) =>
                                      setEditPassword(e.target.value)
                                    }
                                  />
                                  <Button
                                    size="sm"
                                    onClick={saveEdit}
                                    disabled={updateMutation.isPending}
                                  >
                                    저장
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={cancelEdit}
                                  >
                                    취소
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => startEdit(u)}
                                  >
                                    <Pencil className="h-3.5 w-3.5" />
                                    수정
                                  </Button>

                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-1"
                                    onClick={() => handleToggleActive(u)}
                                  >
                                    {u.isActive ? (
                                      <>
                                        <UserX className="h-3.5 w-3.5" />
                                        비활성화
                                      </>
                                    ) : (
                                      <>
                                        <UserCheck className="h-3.5 w-3.5" />
                                        활성화
                                      </>
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {userTab === "role" && (
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>권한 변경</CardTitle>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={roleFilter === "all" ? "default" : "outline"}
                onClick={() => setRoleFilter("all")}
              >
                전체
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "host" ? "default" : "outline"}
                onClick={() => setRoleFilter("host")}
              >
                host
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "admin" ? "default" : "outline"}
                onClick={() => setRoleFilter("admin")}
              >
                admin
              </Button>
              <Button
                size="sm"
                variant={roleFilter === "staff" ? "default" : "outline"}
                onClick={() => setRoleFilter("staff")}
              >
                staff
              </Button>
            </div>

            <Input
              placeholder="표시번호, 이름, 아이디, 전화번호 검색"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                표시할 계정이 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left">번호</th>
                      <th className="px-4 py-3 text-left">이름</th>
                      <th className="px-4 py-3 text-left">아이디</th>
                      <th className="px-4 py-3 text-left">전화번호</th>
                      <th className="px-4 py-3 text-left">현재 권한</th>
                      <th className="px-4 py-3 text-left">변경 권한</th>
                      <th className="px-4 py-3 text-right">처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u: any) => (
                      <tr key={u.id} className="border-b last:border-0">
                        <td className="px-4 py-3">{u.displayNo ?? u.id}</td>
                        <td className="px-4 py-3">{u.name || "-"}</td>
                        <td className="px-4 py-3">{u.username || "-"}</td>
                        <td className="px-4 py-3">
                          {formatPhone(u.phone || "") || "-"}
                        </td>
                        <td className="px-4 py-3">{u.role || "-"}</td>
                        <td className="px-4 py-3">
                          <Select
                            value={roleDrafts[u.id] ?? u.role}
                            onValueChange={(v: UserRole) =>
                              setRoleDrafts((prev) => ({ ...prev, [u.id]: v }))
                            }
                          >
                            <SelectTrigger className="w-[160px]">
                              <SelectValue placeholder="권한 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">직원</SelectItem>
                              <SelectItem value="admin">관리자</SelectItem>
                              <SelectItem value="host">호스트</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Button
                            size="sm"
                            onClick={() => handleChangeRole(u.id, u.role)}
                            disabled={updateRoleMutation.isPending}
                          >
                            변경
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
      )}

      {userTab === "password" && (
        <Card>
          <CardHeader className="space-y-4">
            <CardTitle>비밀번호 재설정</CardTitle>
            <p className="text-sm text-muted-foreground">
              기존 비밀번호는 확인할 수 없고, 새 비밀번호로 재설정만 가능합니다.
            </p>

            <Input
              placeholder="표시번호, 이름, 아이디, 전화번호 검색"
              value={passwordSearch}
              onChange={(e) => setPasswordSearch(e.target.value)}
              className="max-w-sm"
            />
          </CardHeader>

          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">불러오는 중...</div>
            ) : passwordFilteredUsers.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                검색 결과가 없습니다.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-4 py-3 text-left">번호</th>
                      <th className="px-4 py-3 text-left">이름</th>
                      <th className="px-4 py-3 text-left">아이디</th>
                      <th className="px-4 py-3 text-left">전화번호</th>
                      <th className="px-4 py-3 text-left">권한</th>
                      <th className="px-4 py-3 text-left">새 비밀번호</th>
                      <th className="px-4 py-3 text-right">처리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {passwordFilteredUsers.map((u: any) => {
                      const visible = !!showPasswordMap[u.id];

                      return (
                        <tr key={u.id} className="border-b last:border-0">
                          <td className="px-4 py-3">{u.displayNo ?? u.id}</td>
                          <td className="px-4 py-3">{u.name || "-"}</td>
                          <td className="px-4 py-3">{u.username || "-"}</td>
                          <td className="px-4 py-3">
                            {formatPhone(u.phone || "") || "-"}
                          </td>
                          <td className="px-4 py-3">{u.role || "-"}</td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <Input
                                type={visible ? "text" : "password"}
                                placeholder="새 비밀번호 입력"
                                value={passwordDrafts[u.id] || ""}
                                onChange={(e) =>
                                  setPasswordDrafts((prev) => ({
                                    ...prev,
                                    [u.id]: e.target.value,
                                  }))
                                }
                              />
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                  setShowPasswordMap((prev) => ({
                                    ...prev,
                                    [u.id]: !prev[u.id],
                                  }))
                                }
                              >
                                {visible ? "숨김" : "보기"}
                              </Button>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Button
                              size="sm"
                              onClick={() => handleResetPassword(u)}
                              disabled={updateMutation.isPending}
                            >
                              변경
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function LeadFormManagementSection() {
  const utils = trpc.useUtils();
  const { data: forms, isLoading } = trpc.leadFormAdmin.list.useQuery();
  const { data: users } = trpc.users.list.useQuery();

  const [assigneeId, setAssigneeId] = useState("");

  const createMutation = trpc.leadFormAdmin.create.useMutation({
    onSuccess: async (res) => {
      toast.success("랜딩폼 링크가 생성되었습니다.");
      utils.leadFormAdmin.list.invalidate();

      if (res?.token) {
        const url = `${window.location.origin}/form/${res.token}`;
        try {
          await navigator.clipboard.writeText(url);
          toast.success("링크가 자동으로 복사되었습니다.");
        } catch {
          toast.success(url);
        }
      }
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const updateActiveMutation = trpc.leadFormAdmin.updateActive.useMutation({
    onSuccess: () => {
      toast.success("활성 상태가 변경되었습니다.");
      utils.leadFormAdmin.list.invalidate();
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const userMap = new Map(
    users?.map((u: any) => [u.id, u.name || u.username || `#${u.id}`]) ?? []
  );

  const handleCreate = () => {
    if (!assigneeId) {
      toast.error("담당 직원을 선택해주세요.");
      return;
    }

    createMutation.mutate({
      assigneeId: Number(assigneeId),
    });
  };

  const copyLink = async (token: string) => {
    const url = `${window.location.origin}/form/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("링크가 복사되었습니다.");
    } catch {
      toast.error("링크 복사에 실패했습니다.");
    }
  };

  const toggleActive = (f: any) => {
    const ok = window.confirm(
      f.isActive
        ? "이 랜딩폼을 비활성화하시겠습니까?"
        : "이 랜딩폼을 다시 활성화하시겠습니까?"
    );
    if (!ok) return;

    updateActiveMutation.mutate({
      id: f.id,
      isActive: !f.isActive,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>랜딩폼 생성</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Select value={assigneeId} onValueChange={setAssigneeId}>
              <SelectTrigger className="w-[260px]">
                <SelectValue placeholder="담당 직원 선택" />
              </SelectTrigger>
              <SelectContent>
                {users?.map((u: any) => (
                  <SelectItem key={u.id} value={String(u.id)}>
                    {u.name || u.username || `#${u.id}`} ({u.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleCreate} disabled={createMutation.isPending}>
              {createMutation.isPending ? "생성 중..." : "랜딩폼 생성"}
            </Button>
          </div>

          <p className="text-sm text-muted-foreground">
            생성 후 자동으로 링크가 복사됩니다.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>랜딩폼 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">불러오는 중...</div>
          ) : !forms || forms.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              생성된 랜딩폼이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left">ID</th>
                    <th className="px-4 py-3 text-left">토큰</th>
                    <th className="px-4 py-3 text-left">담당자</th>
                    <th className="px-4 py-3 text-left">상태</th>
                    <th className="px-4 py-3 text-left">생성일</th>
                    <th className="px-4 py-3 text-right">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {forms.map((f: any) => (
                    <tr key={f.id} className="border-b last:border-0">
                      <td className="px-4 py-3">{f.id}</td>
                      <td className="px-4 py-3 font-mono text-xs">{f.token}</td>
                      <td className="px-4 py-3">
                        {userMap.get(f.assigneeId) || f.assigneeId}
                      </td>
                      <td className="px-4 py-3">
                        {f.isActive ? (
                          <span className="text-emerald-600 font-medium">활성</span>
                        ) : (
                          <span className="text-red-600 font-medium">비활성</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {f.createdAt
                          ? new Date(f.createdAt).toLocaleString("ko-KR")
                          : "-"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyLink(f.token)}
                          >
                            링크 복사
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => toggleActive(f)}
                          >
                            {f.isActive ? "비활성화" : "활성화"}
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
  );
}