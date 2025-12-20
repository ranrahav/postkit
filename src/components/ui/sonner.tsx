import { useTheme } from "next-themes";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card/95 group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg group-[.toaster]:backdrop-blur-sm group-[.toaster]:rounded-xl",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-lg group-[.toast]:shadow-sm group-[.toast]:transition-[box-shadow,transform,background-color] group-[.toast]:duration-normal group-[.toast]:ease-ios-out",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-lg group-[.toast]:shadow-sm group-[.toast]:transition-[box-shadow,transform,background-color] group-[.toast]:duration-normal group-[.toast]:ease-ios-out",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
