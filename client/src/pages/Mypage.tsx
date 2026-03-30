import { useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

function roleToLabel(role?: string) {
  if (role === "superhost") return "슈퍼호스트";
  if (role === "host") return "호스트";
  if (role === "admin") return "관리자";
  return "직원";
}

export default function MyPage() {
  const { user } = useAuth();
  const utils = trpc.useUtils();

  const { data: myProfile, isLoading } = trpc.users.me.useQuery();

  const [previewImage, setPreviewImage] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");

  const updatePhotoMutation = trpc.users.updateMyPhoto.useMutation({
    onSuccess: async () => {
      await utils.users.me.invalidate();
      alert("프로필 사진이 저장되었습니다.");
      setPreviewImage("");
    },
    onError: (err) => {
      alert(err.message || "프로필 사진 저장 중 오류가 발생했습니다.");
    },
  });

  const changePasswordMutation = trpc.users.changeMyPassword.useMutation({
    onSuccess: async () => {
      alert("비밀번호가 변경되었습니다.");
      setNewPassword("");
      setNewPasswordConfirm("");
    },
    onError: (err) => {
      alert(err.message || "비밀번호 변경 중 오류가 발생했습니다.");
    },
  });

  const companyName = "위드원";
  const departmentName = (myProfile as any)?.teamName || "미분류";
  const positionName =
    (myProfile as any)?.positionName || roleToLabel((myProfile as any)?.role || user?.role);
  const birthday = (myProfile as any)?.birthday || "-";

  const passwordError = useMemo(() => {
    if (!newPassword && !newPasswordConfirm) return "";
    if (newPassword.length < 8) return "비밀번호는 8자 이상이어야 합니다.";
    if (newPassword !== newPasswordConfirm) return "새 비밀번호가 서로 일치하지 않습니다.";
    return "";
  }, [newPassword, newPasswordConfirm]);

  const canSavePassword =
    !!newPassword &&
    !!newPasswordConfirm &&
    !passwordError;

  const profileImageSrc =
    previewImage ||
    (myProfile as any)?.profileImageUrl ||
    "";

  const handlePreviewPhoto = (file: File) => {
    const reader = new FileReader();

    reader.onload = () => {
      setPreviewImage(String(reader.result || ""));
    };

    reader.readAsDataURL(file);
  };

  const handleSavePhoto = async () => {
    if (!previewImage) {
      alert("먼저 사진을 선택해주세요.");
      return;
    }

    const res = await fetch(previewImage);
    const blob = await res.blob();

    const formData = new FormData();
    formData.append("file", blob, "profile-image.png");

    const uploadRes = await fetch(
      `${import.meta.env.VITE_API_BASE_URL || ""}/api/upload`,
      {
        method: "POST",
        body: formData,
        credentials: "include",
      }
    );

    if (!uploadRes.ok) {
      alert("사진 업로드에 실패했습니다.");
      return;
    }

    const uploaded = await uploadRes.json();
    const fileUrl = uploaded?.fileUrl;

    if (!fileUrl) {
      alert("업로드된 사진 URL을 가져오지 못했습니다.");
      return;
    }

    updatePhotoMutation.mutate({
      profileImageUrl: fileUrl,
    });
  };

  const handleSavePassword = () => {
    if (!canSavePassword) {
      alert(passwordError || "비밀번호를 다시 확인해주세요.");
      return;
    }

    changePasswordMutation.mutate({
      newPassword,
      newPasswordConfirm,
    });
  };

  return (
    <div className="space-y-5">
      <Card>
        <CardContent className="p-5">
          <div className="flex flex-col gap-5 md:flex-row md:items-center">
            <div className="flex flex-col items-center">
              {profileImageSrc ? (
                <img
                  src={profileImageSrc}
                  alt="프로필"
                  className="h-24 w-24 rounded-full border object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-slate-100 text-2xl font-semibold text-slate-500">
                  {(myProfile as any)?.name?.[0] || user?.name?.[0] || "U"}
                </div>
              )}

              <label className="mt-3 inline-flex">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    handlePreviewPhoto(file);
                    e.currentTarget.value = "";
                  }}
                />
                <Button type="button" variant="outline" asChild>
                  <span>사진 선택</span>
                </Button>
              </label>

              <Button
                type="button"
                className="mt-2"
                onClick={handleSavePhoto}
                disabled={!previewImage || updatePhotoMutation.isPending}
              >
                사진 저장
              </Button>
            </div>

            <div className="flex-1">
              <h2 className="text-lg font-bold">내 정보</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                프로필 사진과 비밀번호만 직접 변경할 수 있습니다.
              </p>

              <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium">이름</label>
                  <Input value={(myProfile as any)?.name || ""} readOnly />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">회사</label>
                  <Input value={companyName} readOnly />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">부서</label>
                  <Input value={departmentName} readOnly />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">직위</label>
                  <Input value={positionName} readOnly />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">이메일</label>
                  <Input value={(myProfile as any)?.email || ""} readOnly />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">휴대폰</label>
                  <Input value={(myProfile as any)?.phone || ""} readOnly />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">생일</label>
                  <Input value={birthday} readOnly />
                </div>
              </div>

              {isLoading ? (
                <div className="mt-3 text-sm text-muted-foreground">불러오는 중...</div>
              ) : null}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5">
          <h3 className="text-base font-bold">비밀번호 변경</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            새 비밀번호를 2번 입력한 뒤 저장하세요.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-3 md:max-w-xl">
            <div>
              <label className="mb-1 block text-sm font-medium">새 비밀번호</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="새 비밀번호 입력"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">새 비밀번호 확인</label>
              <Input
                type="password"
                value={newPasswordConfirm}
                onChange={(e) => setNewPasswordConfirm(e.target.value)}
                placeholder="새 비밀번호 다시 입력"
              />
            </div>

            {passwordError ? (
              <div className="text-sm text-red-500">{passwordError}</div>
            ) : null}

            <div>
              <Button
                onClick={handleSavePassword}
                disabled={!canSavePassword || changePasswordMutation.isPending}
              >
                저장
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}