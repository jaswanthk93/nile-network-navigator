
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ShareIcon, DownloadIcon, CheckIcon, TableIcon, EyeIcon, CodeIcon } from "lucide-react";

interface ExportData {
  macAddress: string;
  segmentName: string;
  lockToPort: string;
  site: string;
  building: string;
  floor: string;
  allowOrDeny: "allow";
}

const mockExportData: ExportData[] = [
  {
    macAddress: "00:1A:2B:3C:4D:5E",
    segmentName: "Employee",
    lockToPort: "",
    site: "",
    building: "",
    floor: "",
    allowOrDeny: "allow"
  },
  {
    macAddress: "AA:BB:CC:DD:EE:FF",
    segmentName: "Employee",
    lockToPort: "",
    site: "",
    building: "",
    floor: "",
    allowOrDeny: "allow"
  },
  {
    macAddress: "11:22:33:44:55:66",
    segmentName: "Voice",
    lockToPort: "",
    site: "",
    building: "",
    floor: "",
    allowOrDeny: "allow"
  },
  {
    macAddress: "DD:EE:FF:00:11:22",
    segmentName: "IoT",
    lockToPort: "",
    site: "",
    building: "",
    floor: "",
    allowOrDeny: "allow"
  },
  {
    macAddress: "99:88:77:66:55:44",
    segmentName: "IoT",
    lockToPort: "",
    site: "",
    building: "",
    floor: "",
    allowOrDeny: "allow"
  }
];

const ExportPage = () => {
  const [exportData, setExportData] = useState<ExportData[]>(mockExportData);
  const [exportComplete, setExportComplete] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleExport = () => {
    // In a real app, this would generate and download a CSV file
    setExportComplete(true);
    toast({
      title: "Export successful",
      description: "Network data has been exported for Nile migration.",
    });
  };

  const downloadCsv = () => {
    // In a real app, this would trigger a file download
    toast({
      title: "CSV downloaded",
      description: "The CSV file has been downloaded to your device.",
    });
  };

  const getCSVPreview = () => {
    let csvContent = "mac address,segment name,lock to port,site,building,floor,allow or deny\n";
    exportData.forEach(item => {
      csvContent += `${item.macAddress},${item.segmentName},${item.lockToPort},${item.site},${item.building},${item.floor},${item.allowOrDeny}\n`;
    });
    return csvContent;
  };

  return (
    <div className="container mx-auto max-w-6xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Export for Nile Migration</h1>
        <p className="text-muted-foreground">
          Generate and download the CSV file for importing into Nile.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShareIcon className="h-5 w-5" />
            Export Configuration
          </CardTitle>
          <CardDescription>
            Review and export your network configuration for Nile migration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="preview">
            <TabsList className="mb-4">
              <TabsTrigger value="preview">
                <TableIcon className="h-4 w-4 mr-2" />
                Table Preview
              </TabsTrigger>
              <TabsTrigger value="csv">
                <CodeIcon className="h-4 w-4 mr-2" />
                CSV Preview
              </TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>MAC Address</TableHead>
                      <TableHead>Segment Name</TableHead>
                      <TableHead>Lock to Port</TableHead>
                      <TableHead>Site</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Floor</TableHead>
                      <TableHead>Allow/Deny</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exportData.map((item, index) => (
                      <TableRow key={index}>
                        <TableCell className="font-mono">{item.macAddress}</TableCell>
                        <TableCell>{item.segmentName}</TableCell>
                        <TableCell>{item.lockToPort || "—"}</TableCell>
                        <TableCell>{item.site || "—"}</TableCell>
                        <TableCell>{item.building || "—"}</TableCell>
                        <TableCell>{item.floor || "—"}</TableCell>
                        <TableCell>{item.allowOrDeny}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="text-sm text-muted-foreground">
                <p>Total records: {exportData.length}</p>
              </div>
            </TabsContent>
            <TabsContent value="csv">
              <div className="rounded-md border bg-muted p-4">
                <pre className="text-xs overflow-x-auto whitespace-pre-wrap">
                  {getCSVPreview()}
                </pre>
              </div>
            </TabsContent>
          </Tabs>

          <div className="mt-6 space-y-4">
            <div className="flex flex-col space-y-2">
              <h3 className="text-lg font-medium">Nile Migration Summary</h3>
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-md border p-4">
                  <div className="font-medium">Devices</div>
                  <div className="mt-2 text-2xl font-bold">8</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="font-medium">VLANs</div>
                  <div className="mt-2 text-2xl font-bold">6</div>
                </div>
                <div className="rounded-md border p-4">
                  <div className="font-medium">MAC Addresses</div>
                  <div className="mt-2 text-2xl font-bold">{exportData.length}</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate("/mac-addresses")}
          >
            Back
          </Button>
          <div className="space-x-2">
            {!exportComplete ? (
              <Button onClick={handleExport}>
                <ShareIcon className="h-4 w-4 mr-2" />
                Export for Nile
              </Button>
            ) : (
              <Button onClick={downloadCsv}>
                <DownloadIcon className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>

      {exportComplete && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-4">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                <CheckIcon className="h-5 w-5 text-green-600" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-medium text-green-800">Export Complete!</h3>
                <p className="text-green-700">
                  Your network data has been successfully exported for Nile migration. Download the CSV file and import it into Nile to complete the migration process.
                </p>
                <div className="pt-2">
                  <Button variant="outline" className="border-green-200" onClick={() => navigate("/")}>
                    Return to Dashboard
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExportPage;
