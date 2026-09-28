import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      expand
      duration={4500}
      gap={10}
      offset={16}
      icons={{
        success: <CheckCircle2 size={19} strokeWidth={2.2} />,
        error: <XCircle size={19} strokeWidth={2.2} />,
        warning: <AlertTriangle size={19} strokeWidth={2.2} />,
        info: <Info size={19} strokeWidth={2.2} />,
        loading: <Loader2 size={19} strokeWidth={2.2} className="animate-spin" />,
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast rounded-xl border shadow-lg shadow-black/[0.06] backdrop-blur-sm px-4 py-3.5 gap-3 items-start",
          title: "text-[14px] font-semibold leading-snug",
          description: "text-[13px] opacity-90 leading-relaxed",
          actionButton:
            "rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
          cancelButton:
            "rounded-lg px-3 py-1.5 text-[12.5px] font-medium opacity-70 hover:opacity-100 transition-opacity",
          closeButton:
            "rounded-md border-0 opacity-60 hover:opacity-100 transition-opacity",
          icon: "mt-0.5",
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "0.85rem",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
