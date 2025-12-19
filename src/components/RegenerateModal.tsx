import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface RegenerateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  oldSlide: { title: string; body: string };
  newSlide: { title: string; body: string };
  onAccept: () => void;
  onReject: () => void;
}

const RegenerateModal = ({
  open,
  onOpenChange,
  oldSlide,
  newSlide,
  onAccept,
  onReject,
}: RegenerateModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl" dir="ltr">
        <DialogHeader>
          <DialogTitle>Compare versions</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-4">
          {/* Old version */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-muted-foreground">Previous version</h3>
            <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <p className="text-sm mt-1">{oldSlide.title}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Content</label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{oldSlide.body}</p>
              </div>
            </div>
          </div>

          {/* New version */}
          <div className="space-y-3">
            <h3 className="font-semibold text-sm text-primary">New version</h3>
            <div className="space-y-2 p-4 border rounded-lg bg-primary/5 border-primary/20">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Title</label>
                <p className="text-sm mt-1 font-medium">{newSlide.title}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Content</label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{newSlide.body}</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onReject}>
            Cancel and keep previous
          </Button>
          <Button onClick={onAccept}>
            Save new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RegenerateModal;
