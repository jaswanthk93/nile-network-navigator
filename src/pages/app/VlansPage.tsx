
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { FolderKanbanIcon, LayersIcon, TagIcon } from "lucide-react";

interface Vlan {
  id: string;
  vlanId: number;
  name: string;
  segmentName: string;
  subnet?: string;
  usedBy: string[];
}

const mockVlans: Vlan[] = [
  {
    id: "1",
    vlanId: 1,
    name: "Default",
    segmentName: "Management",
    subnet: "192.168.1.0/24",
    usedBy: ["CORE-SW-01", "DIST-SW-01"]
  },
  {
    id: "2",
    vlanId: 10,
    name: "User_VLAN",
    segmentName: "Employee",
    subnet: "192.168.10.0/24",
    usedBy: ["CORE-SW-01", "DIST-SW-01", "ACC-SW-01"]
  },
  {
    id: "3",
    vlanId: 20,
    name: "Voice_VLAN",
    segmentName: "Voice",
    subnet: "192.168.20.0/24",
    usedBy: ["CORE-SW-01", "DIST-SW-01", "ACC-SW-01"]
  },
  {
    id: "4",
    vlanId: 30,
    name: "Guest_VLAN",
    segmentName: "Guest",
    subnet: "192.168.30.0/24",
    usedBy: ["CORE-SW-01", "DIST-SW-01"]
  },
  {
    id: "5",
    vlanId: 40,
    name: "IoT_VLAN",
    segmentName: "IoT",
    subnet: "192.168.40.0/24",
    usedBy: ["CORE-SW-01"]
  },
  {
    id: "6",
    vlanId: 50,
    name: "Server_VLAN",
    segmentName: "Server",
    subnet: "192.168.50.0/24",
    usedBy: ["CORE-SW-01", "DIST-SW-01"]
  }
];

const VlansPage = () => {
  const [vlans, setVlans] = useState<Vlan[]>(mockVlans);
  const [editingCell, setEditingCell] = useState<{id: string, field: keyof Vlan} | null>(null);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleSaveEdit = (id: string, field: keyof Vlan, value: string) => {
    setVlans(vlans.map(vlan => 
      vlan.id === id ? { ...vlan, [field]: value } : vlan
    ));
    setEditingCell(null);
  };

  const handleConfirmVlans = () => {
    // Validate that all VLANs have segment names
    const missingSegments = vlans.filter(vlan => !vlan.segmentName);
    if (missingSegments.length > 0) {
      toast({
        title: "Missing segment names",
        description: `Please assign segment names to all VLANs before proceeding.`,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "VLAN configuration saved",
      description: "VLAN to segment mapping has been saved.",
    });
    navigate("/mac-addresses");
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">VLAN Configuration</h1>
        <p className="text-muted-foreground">
          Map VLANs to network segments for migration to Nile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FolderKanbanIcon className="h-5 w-5" />
            VLAN to Segment Mapping
          </CardTitle>
          <CardDescription>
            Assign segment names to each VLAN for migration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">VLAN ID</TableHead>
                  <TableHead>VLAN Name</TableHead>
                  <TableHead className="w-[200px]">Segment Name</TableHead>
                  <TableHead>Subnet</TableHead>
                  <TableHead>Used By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vlans.map((vlan) => (
                  <TableRow key={vlan.id}>
                    <TableCell className="font-medium">{vlan.vlanId}</TableCell>
                    <TableCell>{vlan.name}</TableCell>
                    <TableCell>
                      {editingCell?.id === vlan.id && editingCell?.field === "segmentName" ? (
                        <Input
                          defaultValue={vlan.segmentName}
                          className="h-8"
                          onBlur={(e) => handleSaveEdit(vlan.id, "segmentName", e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleSaveEdit(vlan.id, "segmentName", (e.target as HTMLInputElement).value);
                            }
                          }}
                          autoFocus
                        />
                      ) : (
                        <div
                          className="flex cursor-pointer items-center gap-1 hover:text-primary"
                          onClick={() => setEditingCell({id: vlan.id, field: "segmentName"})}
                        >
                          <TagIcon className="h-4 w-4" />
                          {vlan.segmentName || <span className="text-muted-foreground italic">Click to assign</span>}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{vlan.subnet || "N/A"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {vlan.usedBy.map((device, idx) => (
                          <span 
                            key={idx}
                            className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs font-medium"
                          >
                            {device}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 text-sm text-muted-foreground">
            <p>Click on the segment name to edit. Segment names will be used for organizing devices in Nile.</p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate("/devices")}
          >
            Back
          </Button>
          <Button onClick={handleConfirmVlans}>
            Save and Continue
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default VlansPage;
