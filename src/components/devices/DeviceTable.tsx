
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DeviceTableRow } from "./DeviceTableRow";
import { DeviceFilter } from "./DeviceFilter";

interface DeviceTableProps {
  devices: any[];
  isLoading: boolean;
  onSaveEdit: (id: string, field: string, value: string) => void;
  onDeleteDevice: (id: string, isSwitch: boolean) => void;
}

export function DeviceTable({ 
  devices, 
  isLoading,
  onSaveEdit,
  onDeleteDevice
}: DeviceTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  const filteredDevices = devices
    .filter(device => {
      const matchesSearch = 
        !searchQuery || 
        device.ipAddress.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (device.hostname && device.hostname.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (device.make && device.make.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (device.model && device.model.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesCategory = !categoryFilter || device.category === categoryFilter;
      
      return matchesSearch && matchesCategory;
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
        <div className="flex-1">
          <Input
            placeholder="Search devices..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <DeviceFilter
            selectedCategory={categoryFilter}
            onCategoryChange={setCategoryFilter}
          />
        </div>
      </div>
      
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>IP Address</TableHead>
              <TableHead>Hostname</TableHead>
              <TableHead>Make</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <td colSpan={7} className="h-24 text-center">
                  Loading...
                </td>
              </TableRow>
            ) : filteredDevices.length === 0 ? (
              <TableRow>
                <td colSpan={7} className="h-24 text-center">
                  No devices found. Try a different search.
                </td>
              </TableRow>
            ) : (
              filteredDevices.map((device) => (
                <DeviceTableRow 
                  key={device.id} 
                  device={device} 
                  onSaveEdit={onSaveEdit}
                  onDeleteDevice={onDeleteDevice}
                />
              ))
            )}
          </TableBody>
        </Table>
      </div>
      
      <div className="text-sm text-muted-foreground">
        Showing {filteredDevices.length} of {devices.length} devices
      </div>
    </div>
  );
}
