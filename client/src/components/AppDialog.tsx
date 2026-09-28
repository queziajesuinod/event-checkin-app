import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";

interface AppDialogProps {
  title?: string;
  logo?: string;
  open?: boolean;
  onLogin: () => void;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
}

export function AppDialog({
  title,
  logo,
  open = false,
  onLogin,
  onOpenChange,
  onClose,
}: AppDialogProps) {
  const [internalOpen, setInternalOpen] = useState(open);

  useEffect(() => {
    if (!onOpenChange) {
      setInternalOpen(open);
    }
  }, [open, onOpenChange]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (onOpenChange) {
      onOpenChange(nextOpen);
    } else {
      setInternalOpen(nextOpen);
    }

    if (!nextOpen) {
      onClose?.();
    }
  };

  return (
    <Dialog
      open={onOpenChange ? open : internalOpen}
      onOpenChange={handleOpenChange}
    >
      <DialogContent className="bg-card rounded-2xl w-full max-w-sm border border-border p-0 gap-0 text-center">
        <div className="flex flex-col items-center gap-2 p-5 pt-12">
          {logo ? (
            <div className="w-16 h-16 bg-white rounded-xl border border-[rgba(0,0,0,0.08)] flex items-center justify-center">
              <img src={logo} alt="Dialog graphic" className="w-10 h-10 rounded-md" />
            </div>
          ) : null}

          {/* Title and subtitle */}
          {title ? (
            <DialogTitle className="text-xl font-semibold text-foreground leading-[26px] tracking-[-0.44px]">
              {title}
            </DialogTitle>
          ) : null}
          <DialogDescription className="text-sm text-muted-foreground leading-5 tracking-[-0.154px]">
            Faça login para continuar
          </DialogDescription>
        </div>

        <DialogFooter className="px-5 py-5">
          <Button
            onClick={onLogin}
            className="w-full h-10 bg-primary hover:bg-primary/90 text-white rounded-[10px] text-sm font-medium leading-5 tracking-[-0.154px]"
          >
            Entrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
