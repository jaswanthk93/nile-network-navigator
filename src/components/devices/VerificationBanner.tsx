
import React from "react";
import { AlertCircleIcon } from "lucide-react";

interface VerificationBannerProps {
  count: number;
  total: number;
}

const VerificationBanner = ({
  count,
  total,
}: VerificationBannerProps) => {
  return (
    <div className="bg-amber-50 border border-amber-200 px-4 py-3 rounded-md flex items-center gap-2">
      <AlertCircleIcon className="h-5 w-5 text-amber-500" />
      <div>
        <p className="text-amber-800">
          <span className="font-medium">{count} of {total} devices</span> need verification
        </p>
        <p className="text-amber-600 text-sm">
          Please review and confirm device details before proceeding.
        </p>
      </div>
    </div>
  );
};

export default VerificationBanner;
