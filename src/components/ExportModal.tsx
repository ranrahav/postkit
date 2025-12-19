import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download } from "lucide-react";

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExportAll: () => void;
  onExportCurrent: () => void;
}

const ExportModal = ({
  open,
  onOpenChange,
  onExportAll,
  onExportCurrent,
}: ExportModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="ltr">
        <DialogHeader>
          <DialogTitle>Choose an export option</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          <Button
            onClick={() => {
              onExportAll();
              onOpenChange(false);
            }}
            className="w-full h-auto py-4 flex flex-col items-center gap-2"
            variant="outline"
          >
            <Download className="h-5 w-5" />
            <div className="text-center">
              <div className="font-semibold">Export entire carousel</div>
              <div className="text-xs text-muted-foreground">ZIP file with all slides</div>
            </div>
          </Button>

          <Button
            onClick={() => {
              onExportCurrent();
              onOpenChange(false);
            }}
            className="w-full h-auto py-4 flex flex-col items-center gap-2"
            variant="outline"
          >
            <Download className="h-5 w-5" />
            <div className="text-center">
              <div className="font-semibold">Export current slide</div>
              <div className="text-xs text-muted-foreground">PNG only</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportModal;
