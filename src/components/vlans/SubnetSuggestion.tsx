
import { Button } from "@/components/ui/button";
import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from "@/components/ui/tooltip";
import { InfoIcon, Check, X } from "lucide-react";

interface SubnetSuggestionProps {
  vlanId: number;
  suggestedSubnet: string;
  onAccept: () => void;
  onReject: () => void;
  isAccepted: boolean;
  isRejected: boolean;
}

export function SubnetSuggestion({
  vlanId,
  suggestedSubnet,
  onAccept,
  onReject,
  isAccepted,
  isRejected,
}: SubnetSuggestionProps) {
  // If there's no suggestion or it's already been handled, don't show anything
  if (!suggestedSubnet || isAccepted || isRejected) {
    return null;
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-1 text-blue-500">
              <InfoIcon size={14} />
              <span>Subnet suggested from device</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <p>This subnet was discovered from the network device for VLAN {vlanId}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      <span className="font-semibold">{suggestedSubnet}</span>
      
      <div className="flex gap-1">
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs text-green-600 border-green-300 hover:bg-green-50"
          onClick={onAccept}
        >
          <Check size={14} className="mr-1" /> Use
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          className="h-6 px-2 text-xs text-red-600 border-red-300 hover:bg-red-50"
          onClick={onReject}
        >
          <X size={14} className="mr-1" /> Skip
        </Button>
      </div>
    </div>
  );
}
