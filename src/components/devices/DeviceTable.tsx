
import React from "react";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import DeviceTableRow from "./DeviceTableRow";

interface Device {
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
}

interface DeviceTableProps {
  devices: Device[];
  filteredDevices: Device[];
  editingId: string | null;
  setEditingId: (id: string | null) => void;
  handleSaveEdit: (id: string, field: string, value: string) => void;
}

const DeviceTable: React.FC<DeviceTableProps> = ({
  devices,
  filteredDevices,
  editingId,
  setEditingId,
  handleSaveEdit,
}) => {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[100px]">IP Address</TableHead>
            <TableHead>Hostname</TableHead>
            <TableHead>Make</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-[80px] text-center">Verified</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredDevices.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                {devices.length === 0 
                  ? "No devices discovered yet. Run a network discovery first." 
                  : "No devices found matching filter criteria"}
              </TableCell>
            </TableRow>
          ) : (
            filteredDevices.map((device) => (
              <DeviceTableRow
                key={device.id}
                device={device}
                editingId={editingId}
                setEditingId={setEditingId}
                handleSaveEdit={handleSaveEdit}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
};

export default DeviceTable;
