 import React from 'react';
 import { Button } from '../ui/button';
 import { 
   MessageSquare, FileText, ScrollText, FolderOpen, Phone
 } from 'lucide-react';
 
 interface ActionButtonsProps {
   onChat: () => void;
   onRFQ: () => void;
   onContract?: () => void;
   onDocuments?: () => void;
   phone?: string;
 }
 
 export const ActionButtons: React.FC<ActionButtonsProps> = ({
   onChat,
   onRFQ,
   onContract,
   onDocuments,
   phone
 }) => {
   return (
     <div className="sticky bottom-0 left-0 right-0 bg-white border-t border-border p-4 safe-bottom">
       <div className="flex gap-3 max-w-4xl mx-auto">
         <Button 
           onClick={onChat}
           className="flex-1 h-12 bg-[#0a1628] hover:bg-[#0a1628]/90 text-white"
         >
           <MessageSquare className="h-5 w-5 mr-2" />
           Chat Seguro
         </Button>
         
         <Button 
           onClick={onRFQ}
           className="flex-1 h-12 bg-[#B8860B] hover:bg-[#B8860B]/90 text-white"
         >
           <FileText className="h-5 w-5 mr-2" />
           Enviar RFQ
         </Button>
         
         {onContract && (
           <Button 
             variant="outline"
             onClick={onContract}
             className="h-12 border-[#0a1628]/20"
           >
             <ScrollText className="h-5 w-5" />
           </Button>
         )}
         
         {onDocuments && (
           <Button 
             variant="outline"
             onClick={onDocuments}
             className="h-12 border-[#0a1628]/20"
           >
             <FolderOpen className="h-5 w-5" />
           </Button>
         )}
         
         {phone && (
           <Button 
             variant="outline"
             onClick={() => window.open(`tel:${phone}`, '_self')}
             className="h-12 border-[#0a1628]/20"
           >
             <Phone className="h-5 w-5" />
           </Button>
         )}
       </div>
     </div>
   );
 };