import { useState } from "react";
import { Lock, ShieldCheck, Delete } from "lucide-react";
import { toast } from "sonner";

import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function PinDots({ value }: { value: string }) {
  return (
    <div className="flex justify-center gap-2">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={index}
          className={`h-3 w-3 rounded-full ${
            index < value.length ? "bg-primary" : "bg-muted"
          }`}
        />
      ))}
    </div>
  );
}

function PinPad({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
}) {
  const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

  return (
    <div className="mx-auto grid max-w-[260px] grid-cols-3 gap-2">
      {numbers.slice(0, 9).map((num) => (
        <Button
          key={num}
          type="button"
          variant="outline"
          className="h-14 text-lg font-bold"
          disabled={disabled || value.length >= 6}
          onClick={() => onChange(value + num)}
        >
          {num}
        </Button>
      ))}

      <div />

      <Button
        type="button"
        variant="outline"
        className="h-14 text-lg font-bold"
        disabled={disabled || value.length >= 6}
        onClick={() => onChange(value + "0")}
      >
        0
      </Button>

      <Button
        type="button"
        variant="outline"
        className="h-14"
        disabled={disabled || value.length === 0}
        onClick={() => onChange(value.slice(0, -1))}
      >
        <Delete className="h-4 w-4" />
      </Button>
    </div>
  );
}

export default function SaasAdminGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const utils = trpc.useUtils();

  const [pin, setPin] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");

  const lockQuery = trpc.saas.checkAdminUnlocked.useQuery(undefined, {
    refetchOnWindowFocus: true,
  });

  const setPasswordMut = trpc.saas.setAdminPassword.useMutation({
    onSuccess: async () => {
      toast.success("SaaS 관리자 PIN이 설정되었습니다. 다시 잠금 해제해주세요.");
      setPin("");
      setPinConfirm("");
      await utils.saas.checkAdminUnlocked.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "PIN 설정 실패");
    },
  });

  const unlockMut = trpc.saas.unlockAdmin.useMutation({
    onSuccess: async () => {
      toast.success("SaaS 관리자 잠금이 해제되었습니다.");
      setPin("");
      await utils.saas.checkAdminUnlocked.invalidate();
    },
    onError: (err) => {
      toast.error(err.message || "PIN 확인 실패");
      setPin("");
    },
  });

  if (lockQuery.isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-6">
        <Card className="w-full max-w-md rounded-2xl">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            보안 상태 확인 중...
          </CardContent>
        </Card>
      </div>
    );
  }

  const status = lockQuery.data;

  if (status?.unlocked) {
    return <>{children}</>;
  }

  const isSetting = !status?.hasPassword;

  const canSubmitSet = pin.length === 6 && pinConfirm.length === 6;
  const canSubmitUnlock = pin.length === 6;

  return (
    <div className="flex min-h-[70vh] items-center justify-center p-6">
      <Card className="w-full max-w-md rounded-2xl border-primary/20">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isSetting ? (
              <ShieldCheck className="h-6 w-6" />
            ) : (
              <Lock className="h-6 w-6" />
            )}
          </div>

          <CardTitle>
            {isSetting ? "SaaS 관리자 PIN 설정" : "SaaS 관리자 잠금 해제"}
          </CardTitle>

          <p className="text-sm text-muted-foreground">
            {isSetting
              ? "처음 접속 시 6자리 PIN을 설정해야 SaaS 관리 기능을 사용할 수 있습니다."
              : "SaaS 관리 기능 접근을 위해 6자리 PIN을 입력해주세요."}
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-3">
            <PinDots value={pin} />
            <PinPad
              value={pin}
              disabled={setPasswordMut.isPending || unlockMut.isPending}
              onChange={setPin}
            />
          </div>

          {isSetting && (
            <div className="space-y-3 rounded-xl border bg-muted/20 p-4">
              <p className="text-center text-xs font-semibold text-muted-foreground">
                PIN 확인
              </p>
              <PinDots value={pinConfirm} />
              <PinPad
                value={pinConfirm}
                disabled={setPasswordMut.isPending}
                onChange={setPinConfirm}
              />
            </div>
          )}

          {isSetting ? (
            <Button
              className="w-full"
              disabled={!canSubmitSet || setPasswordMut.isPending}
              onClick={() => {
                if (pin !== pinConfirm) {
                  toast.error("PIN이 일치하지 않습니다.");
                  setPin("");
                  setPinConfirm("");
                  return;
                }

                setPasswordMut.mutate({
                  password: pin,
                  passwordConfirm: pinConfirm,
                });
              }}
            >
              {setPasswordMut.isPending ? "설정 중..." : "PIN 설정"}
            </Button>
          ) : (
            <Button
              className="w-full"
              disabled={!canSubmitUnlock || unlockMut.isPending}
              onClick={() => {
                unlockMut.mutate({
                  password: pin,
                });
              }}
            >
              {unlockMut.isPending ? "확인 중..." : "잠금 해제"}
            </Button>
          )}

          <p className="text-center text-xs text-muted-foreground">
            PIN은 DB에 원문 저장되지 않고 bcrypt 해시로만 저장됩니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}