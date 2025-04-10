
import React from "react";
import { TableRow, TableCell } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircleIcon, AlertCircleIcon, WifiIcon, ServerIcon, MonitorIcon, RouterIcon, PrinterIcon } from "lucide-react";

interface DeviceTableRowProps {
  device: {
    id: string;
    ipAddress: string;
    hostname: string;
    make: string;
    model: string;
    category: "AP" | "Switch" | "Controller" | "Router" | "Other";
    status: "online" | "offline" | "unknown";
    needsVerification: boolean;
    confirmed: boolean;
    sysDescr?: string;
  };
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  handleSaveEdit: (id: string, field: string, value: string) => void;
}

const DeviceTableRow: React.FC<DeviceTableRowProps> = ({
  device,
  editingId,
  setEditingId,
  handleSaveEdit,
}) => {
  const getDeviceIcon = (category: string) => {
    switch(category) {
      case "AP":
        return <WifiIcon className="h-4 w-4" />;
      case "Switch":
        return <ServerIcon className="h-4 w-4" />;
      case "Controller":
        return <MonitorIcon className="h-4 w-4" />;
      case "Router":
        return <RouterIcon className="h-4 w-4" />;
      default:
        return <PrinterIcon className="h-4 w-4" />;
    }
  };

  return (
    <TableRow className={device.needsVerification ? "bg-amber-50" : ""}>
      <TableCell>{device.ipAddress}</TableCell>
      <TableCell>
        {editingId === `${device.id}-hostname` ? (
          <Input
            defaultValue={device.hostname}
            className="h-8"
            onBlur={(e) => handleSaveEdit(device.id, "hostname", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveEdit(device.id, "hostname", (e.target as HTMLInputElement).value);
              }
            }}
            autoFocus
          />
        ) : (
          <span
            className="cursor-pointer hover:text-primary"
            onClick={() => setEditingId(`${device.id}-hostname`)}
          >
            {device.hostname || "Click to add hostname"}
          </span>
        )}
      </TableCell>
      <TableCell>
        {editingId === `${device.id}-make` ? (
          <Select
            defaultValue={device.make}
            onValueChange={(value) => handleSaveEdit(device.id, "make", value)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Cisco">Cisco</SelectItem>
              <SelectItem value="Juniper">Juniper</SelectItem>
              <SelectItem value="Aruba">Aruba</SelectItem>
              <SelectItem value="HPE">HPE</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span
            className="cursor-pointer hover:text-primary"
            onClick={() => setEditingId(`${device.id}-make`)}
          >
            {device.make || "Click to add make"}
          </span>
        )}
      </TableCell>
      <TableCell>
        {editingId === `${device.id}-model` ? (
          <Input
            defaultValue={device.model}
            className="h-8"
            onBlur={(e) => handleSaveEdit(device.id, "model", e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleSaveEdit(device.id, "model", (e.target as HTMLInputElement).value);
              }
            }}
            autoFocus
          />
        ) : (
          <span
            className="cursor-pointer hover:text-primary"
            onClick={() => setEditingId(`${device.id}-model`)}
          >
            {device.model || "Click to add model"}
          </span>
        )}
      </TableCell>
      <TableCell>
        {editingId === `${device.id}-category` ? (
          <Select
            defaultValue={device.category}
            onValueChange={(value) => handleSaveEdit(device.id, "category", value)}
          >
            <SelectTrigger className="h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Switch">Switch</SelectItem>
              <SelectItem value="AP">Access Point</SelectItem>
              <SelectItem value="Controller">Controller</SelectItem>
              <SelectItem value="Router">Router</SelectItem>
              <SelectItem value="Other">Other</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <span
            className="cursor-pointer hover:text-primary flex items-center gap-1.5"
            onClick={() => setEditingId(`${device.id}-category`)}
          >
            {getDeviceIcon(device.category)}
            {device.category}
          </span>
        )}
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
          device.status === 'online' 
            ? 'bg-green-100 text-green-800' 
            : device.status === 'offline'
            ? 'bg-red-100 text-red-800'
            : 'bg-yellow-100 text-yellow-800'
        }`}>
          {device.status}
        </span>
      </TableCell>
      <TableCell className="text-center">
        {device.confirmed ? (
          <CheckCircleIcon className="h-5 w-5 text-green-500 mx-auto" />
        ) : (
          <AlertCircleIcon className="h-5 w-5 text-amber-500 mx-auto" />
        )}
      </TableCell>
    </TableRow>
  );
};

export default DeviceTableRow;
