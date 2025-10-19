"use client";

import { useState, useCallback, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shadcn/ui/dialog";
import { Button, type ButtonProps } from "@/shadcn/ui/button";

interface DialogButton {
  label: string;
  onClick?: () => void | Promise<void>;
  props?: Omit<ButtonProps, "onClick" | "children">;
}

interface OpenDialogOptions {
  title: string;
  description?: string;
  content?: ReactNode;
  confirmButton?: DialogButton;
  denyButton?: DialogButton;
}

interface DialogState extends OpenDialogOptions {
  isOpen: boolean;
}

const DialogContainer = ({
  state,
  onClose,
}: {
  state: DialogState;
  onClose: () => void;
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    if (state.confirmButton?.onClick) {
      setIsLoading(true);
      try {
        await state.confirmButton.onClick();
        onClose();
      } catch (error) {
        console.error("Dialog confirm error:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      onClose();
    }
  };

  const handleDeny = async () => {
    if (state.denyButton?.onClick) {
      setIsLoading(true);
      try {
        await state.denyButton.onClick();
        onClose();
      } catch (error) {
        console.error("Dialog deny error:", error);
      } finally {
        setIsLoading(false);
      }
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={state.isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && (
            <DialogDescription>{state.description}</DialogDescription>
          )}
        </DialogHeader>

        {state.content && <div className="py-4">{state.content}</div>}

        <DialogFooter>
          {state.denyButton && (
            <Button
              {...state.denyButton.props}
              onClick={handleDeny}
              disabled={isLoading}
            >
              {state.denyButton.label}
            </Button>
          )}
          {state.confirmButton && (
            <Button
              {...state.confirmButton.props}
              onClick={handleConfirm}
              loading={isLoading}
              disabled={isLoading}
            >
              {state.confirmButton.label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const useDialog = () => {
  const open = useCallback((options: OpenDialogOptions) => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    let root: Root | null = null;

    const cleanup = () => {
      if (root) {
        root.unmount();
        root = null;
      }
      if (container.parentNode) {
        container.parentNode.removeChild(container);
      }
    };

    const dialogState: DialogState = {
      ...options,
      isOpen: true,
    };

    root = createRoot(container);
    root.render(<DialogContainer state={dialogState} onClose={cleanup} />);

    return {
      close: cleanup,
    };
  }, []);

  return { open };
};
