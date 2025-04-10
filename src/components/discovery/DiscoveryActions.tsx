
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

interface DiscoveryActionsProps {
  discoveryStatus: "idle" | "scanning" | "connecting" | "gathering" | "complete" | "error";
  backendConnected: boolean;
  startDiscovery: () => void;
  navigateBack: () => void;
}

const DiscoveryActions: React.FC<DiscoveryActionsProps> = ({
  discoveryStatus,
  backendConnected,
  startDiscovery,
  navigateBack,
}) => {
  const navigate = useNavigate();

  const handleNext = () => {
    navigate("/devices");
  };

  return (
    <div className="flex justify-between">
      <Button 
        variant="outline"
        onClick={navigateBack}
        disabled={discoveryStatus !== "idle" && discoveryStatus !== "complete" && discoveryStatus !== "error"}
      >
        Back
      </Button>
      <div className="space-x-2">
        {discoveryStatus === "idle" && (
          <Button 
            onClick={startDiscovery}
            disabled={!backendConnected}
          >
            Start Discovery
          </Button>
        )}
        {discoveryStatus === "complete" && (
          <Button onClick={handleNext}>
            View Discovered Devices
          </Button>
        )}
      </div>
    </div>
  );
};

export default DiscoveryActions;
