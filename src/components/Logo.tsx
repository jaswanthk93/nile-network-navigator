
import { NetworkIcon } from "lucide-react";
import { Link } from "react-router-dom";

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2">
      <NetworkIcon className="h-6 w-6 text-primary" />
      <span className="text-xl font-bold tracking-tight">Nile Network Navigator</span>
    </Link>
  );
}
