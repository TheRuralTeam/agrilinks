import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Mail, CheckCircle } from "lucide-react";

interface EmailConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
}

export const EmailConfirmationModal = ({
  isOpen,
  onClose,
  email,
}: EmailConfirmationModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-xl">Verifique seu E-mail</DialogTitle>
          <DialogDescription className="text-center space-y-3 pt-2">
            <p>
              Enviamos um <strong>link de confirmação</strong> para:
            </p>
            <p className="font-medium text-foreground bg-muted px-3 py-2 rounded-md">
              {email}
            </p>
            <div className="text-sm text-muted-foreground space-y-2 pt-2">
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Clique no link do e-mail para ativar sua conta</span>
              </div>
              <div className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                <span>Verifique também a pasta de <strong>spam</strong> ou <strong>lixo eletrônico</strong></span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <Button 
            onClick={onClose} 
            className="w-full"
          >
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
