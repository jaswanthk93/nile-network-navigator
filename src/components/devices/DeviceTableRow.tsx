
import { useState } from "react";
import { TableCell, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, Check, Edit2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  onSaveEdit: (id: string, field: string, value: string) => void;
  onDeleteDevice: (id: string, isSwitch: boolean) => void;
}

export function DeviceTableRow({
  device,
  onSaveEdit,
  onDeleteDevice,
}: DeviceTableRowProps) {
  // Track which fields are being edited
  const [editingFields, setEditingFields] = useState<Record<string, string>>({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const handleEdit = (field: string, value: string) => {
    setEditingFields({
      ...editingFields,
      [field]: value
    });
  };

  const handleSave = (field: string) => {
    if (editingFields[field] !== undefined) {
      onSaveEdit(device.id, field, editingFields[field]);
      // Remove this field from editing state
      const newEditingFields = { ...editingFields };
      delete newEditingFields[field];
      setEditingFields(newEditingFields);
    }
  };

  const handleCancel = (field: string) => {
    // Remove this field from editing state
    const newEditingFields = { ...editingFields };
    delete newEditingFields[field];
    setEditingFields(newEditingFields);
  };

  const isEditing = (field: string) => field in editingFields;
  const isSwitch = device.category === "Switch";

  // Predefined lists for dropdowns
  const deviceMakes = [
    "Cisco",
    "Juniper",
    "Arista",
    "HPE",
    "Dell",
    "Ubiquiti",
    "Meraki",
    "Fortinet",
    "Netgear",
    "Ruckus",
    "Other"
  ];

  return (
    <TableRow className={device.needsVerification ? "bg-amber-50" : ""}>
      <TableCell className="font-mono">{device.ipAddress}</TableCell>
      
      <TableCell>
        {isEditing("hostname") ? (
          <div className="flex space-x-2">
            <Input
              className="h-8 w-full"
              value={editingFields.hostname}
              onChange={(e) => setEditingFields({...editingFields, hostname: e.target.value})}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600"
              onClick={() => handleSave("hostname")}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600"
              onClick={() => handleCancel("hostname")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span>{device.hostname || "—"}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => handleEdit("hostname", device.hostname)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
      
      <TableCell>
        {isEditing("make") ? (
          <div className="flex space-x-2">
            <Select
              value={editingFields.make}
              onValueChange={(value) => setEditingFields({...editingFields, make: value})}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Select make..." />
              </SelectTrigger>
              <SelectContent>
                {deviceMakes.map((make) => (
                  <SelectItem key={make} value={make}>
                    {make}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600"
              onClick={() => handleSave("make")}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600"
              onClick={() => handleCancel("make")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span>{device.make || "—"}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => handleEdit("make", device.make)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
      
      <TableCell>
        {isEditing("model") ? (
          <div className="flex space-x-2">
            <Input
              className="h-8 w-full"
              value={editingFields.model}
              onChange={(e) => setEditingFields({...editingFields, model: e.target.value})}
            />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600"
              onClick={() => handleSave("model")}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600"
              onClick={() => handleCancel("model")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <span>{device.model || "—"}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => handleEdit("model", device.model)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
      
      <TableCell>
        {isEditing("category") ? (
          <div className="flex space-x-2">
            <Select
              value={editingFields.category}
              onValueChange={(value) => setEditingFields({...editingFields, category: value})}
            >
              <SelectTrigger className="h-8 w-full">
                <SelectValue placeholder="Select..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Switch">Switch</SelectItem>
                <SelectItem value="Router">Router</SelectItem>
                <SelectItem value="AP">AP</SelectItem>
                <SelectItem value="Controller">Controller</SelectItem>
                <SelectItem value="Other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-green-600"
              onClick={() => handleSave("category")}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-600"
              onClick={() => handleCancel("category")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center space-x-2">
            <Badge
              variant={
                device.category === "Switch" 
                  ? "default" 
                  : device.category === "Router" 
                    ? "secondary" 
                    : device.category === "AP" 
                      ? "outline" 
                      : "destructive"
              }
            >
              {device.category}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={() => handleEdit("category", device.category)}
            >
              <Edit2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </TableCell>
      
      <TableCell>
        <Badge
          variant={
            device.status === "online" 
              ? "default" 
              : device.status === "offline" 
                ? "destructive" 
                : "outline"
          }
        >
          {device.status}
        </Badge>
      </TableCell>
      
      <TableCell>
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete {isSwitch ? "Switch" : "Device"}</DialogTitle>
              <DialogDescription>
                {isSwitch 
                  ? "This will delete the switch and all associated devices. This action cannot be undone."
                  : "Are you sure you want to delete this device? This action cannot be undone."}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={() => {
                  onDeleteDevice(device.id, isSwitch);
                  setDeleteDialogOpen(false);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TableCell>
    </TableRow>
  );
}
