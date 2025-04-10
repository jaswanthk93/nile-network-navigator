
import React from "react";
import { AlertCircleIcon } from "lucide-react";

interface VerificationBannerProps {
  hasDevicesNeedingVerification: boolean;
}

const VerificationBanner: React.FC<VerificationBannerProps> = ({
  hasDevicesNeedingVerification,
}) => {
  if (!hasDevicesNeedingVerification) {
    return null;
  }

  return (
    <div className="mt-2 text-amber-600 text-sm flex items-center gap-2">
      <AlertCircleIcon className="h-4 w-4" />
      <span>Some devices need verification. Please review and confirm their details.</span>
    </div>
  );
};

export default VerificationBanner;
