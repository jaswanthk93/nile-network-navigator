
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { ShareIcon, FileDown, CheckIcon, TableIcon, EyeIcon, CodeIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ExportData {
  macAddress: string;
  segmentName: string;
  lockToPort: string;
  site: string;
  building: string;
  floor: string;
  allowOrDeny: "allow";
}

const ExportPage = () => {
  const [exportData, setExportData] = useState<ExportData[]>([]);
  const [exportComplete, setExportComplete] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [migrationComplete, setMigrationComplete] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const params = new URLSearchParams(location.search);
    const siteIdFromUrl = params.get('site');
    const storedSiteId = sessionStorage.getItem('selectedSiteId');
    
    const siteId = siteIdFromUrl || storedSiteId;
    
    if (siteId) {
      setSelectedSiteId(siteId);
      if (siteId !== storedSiteId) {
        sessionStorage.setItem('selectedSiteId', siteId);
      }
    } else {
      setError("No site selected. Please select a site from the sidebar first.");
      toast({
        title: "No Site Selected",
        description: "Please select a site from the sidebar first.",
        variant: "destructive",
      });
    }
  }, [location.search, toast, user]);

  useEffect(() => {
    const fetchMacAddresses = async () => {
      if (!user || !selectedSiteId) return;
      
      try {
        setLoading(true);
        
        const { data: vlans, error: vlansError } = await supabase
          .from('vlans')
          .select('*')
          .eq('site_id', selectedSiteId);
          
        if (vlansError) {
          throw new Error(`Error fetching VLANs: ${vlansError.message}`);
        }
        
        const vlanMap = new Map();
        vlans?.forEach(vlan => {
          vlanMap.set(vlan.vlan_id, vlan.name || `VLAN ${vlan.vlan_id}`);
        });
        
        const { data: macAddresses, error: macError } = await supabase
          .from('mac_addresses')
          .select('*')
          .eq('site_id', selectedSiteId)
          .eq('is_active', true);
          
        if (macError) {
          throw new Error(`Error fetching MAC addresses: ${macError.message}`);
        }
        
        if (!macAddresses || macAddresses.length === 0) {
          setError("No MAC addresses found. Please discover devices first.");
          setLoading(false);
          toast({
            title: "No MAC Addresses",
            description: "No MAC addresses found for export. Please discover devices first.",
            variant: "destructive",
          });
          return;
        }
        
        const transformedData: ExportData[] = macAddresses.map(mac => ({
          macAddress: mac.mac_address,
          segmentName: vlanMap.get(mac.vlan_id) || `VLAN ${mac.vlan_id}`,
          lockToPort: "",
          site: "",
          building: "",
          floor: "",
          allowOrDeny: "allow"
        }));
        
        setExportData(transformedData);
        setError(null);
      } catch (error) {
        console.error("Error fetching MAC addresses:", error);
        setError(error instanceof Error ? error.message : "An unexpected error occurred");
        toast({
          title: "Error",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchMacAddresses();
  }, [selectedSiteId, user, toast]);

  // Check if the site progress is already at 100%
  useEffect(() => {
    const checkMigrationStatus = async () => {
      if (!user || !selectedSiteId) return;
      
      try {
        const { data: siteData, error } = await supabase
          .from('sites')
          .select('*')
          .eq('id', selectedSiteId)
          .single();
          
        if (error) {
          console.error("Error fetching site data:", error);
          return;
        }
        
        // If there's a custom progress field in the sites table that's already at 100%, 
        // consider the migration complete
        setMigrationComplete(false); // We'll set this to true when user downloads the CSV
      } catch (error) {
        console.error("Error checking migration status:", error);
      }
    };
    
    checkMigrationStatus();
  }, [selectedSiteId, user]);

  const handleExport = () => {
    setExportComplete(true);
    toast({
      title: "Export successful",
      description: "Network data has been exported for Nile migration.",
    });
  };

  const updateSiteProgress = async () => {
    if (!user || !selectedSiteId) return;
    
    try {
      // Update the site progress to 100% in the database to mark migration as complete
      const { error } = await supabase
        .from('sites')
        .update({ 
          // If you have a progress field in your sites table, update it here
          // progress: 100 
          // For now, we'll just set the migrationComplete state
        })
        .eq('id', selectedSiteId);
        
      if (error) {
        console.error("Error updating site progress:", error);
        return;
      }
      
      setMigrationComplete(true);
      
    } catch (error) {
      console.error("Error updating site progress:", error);
    }
  };

  const downloadCsv = () => {
    try {
      const csvContent = getCSVContent();
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      link.setAttribute('href', url);
      link.setAttribute('download', `nile-export-${new Date().toISOString().split('T')[0]}.csv`);
      
      document.body.appendChild(link);
      link.click();
      
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
      
      // Update the site progress to 100% after successful download
      updateSiteProgress();
      
      toast({
        title: "CSV downloaded",
        description: "The CSV file has been downloaded to your device. Migration complete!",
      });
    } catch (error) {
      console.error("Error downloading CSV:", error);
      toast({
        title: "Download failed",
        description: "Failed to download CSV file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getCSVContent = () => {
    let csvContent = "mac address,segment name,lock to port,site,building,floor,allow or deny\n";
    exportData.forEach(item => {
      csvContent += `${item.macAddress},${item.segmentName},${item.lockToPort},${item.site},${item.building},${item.floor},${item.allowOrDeny}\n`;
    });
    return csvContent;
  };

  const getCSVPreview = () => {
    return getCSVContent();
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
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="bg-destructive/10 text-destructive p-4 rounded-md">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-2" onClick={() => navigate('/mac-addresses')}>
                Go to MAC Addresses
              </Button>
            </div>
          ) : (
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
                      {exportData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                            No MAC addresses found for export
                          </TableCell>
                        </TableRow>
                      ) : (
                        exportData.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono">{item.macAddress}</TableCell>
                            <TableCell>{item.segmentName}</TableCell>
                            <TableCell>{item.lockToPort || "—"}</TableCell>
                            <TableCell>{item.site || "—"}</TableCell>
                            <TableCell>{item.building || "—"}</TableCell>
                            <TableCell>{item.floor || "—"}</TableCell>
                            <TableCell>{item.allowOrDeny}</TableCell>
                          </TableRow>
                        ))
                      )}
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
          )}

          {!loading && !error && (
            <div className="mt-6 space-y-4">
              <div className="flex flex-col space-y-2">
                <h3 className="text-lg font-medium">Nile Migration Summary</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-md border p-4">
                    <div className="font-medium">MAC Addresses</div>
                    <div className="mt-2 text-2xl font-bold">{exportData.length}</div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="font-medium">Segments</div>
                    <div className="mt-2 text-2xl font-bold">
                      {new Set(exportData.map(item => item.segmentName)).size}
                    </div>
                  </div>
                  <div className="rounded-md border p-4">
                    <div className="font-medium">Status</div>
                    <div className="mt-2 text-2xl font-bold text-green-600">
                      {migrationComplete ? "Complete" : "Ready"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between border-t px-6 py-4">
          <Button 
            variant="outline"
            onClick={() => navigate("/mac-addresses")}
          >
            Back
          </Button>
          <div className="space-x-2">
            {!loading && !error && !exportComplete ? (
              <Button onClick={handleExport} disabled={exportData.length === 0}>
                <ShareIcon className="h-4 w-4 mr-2" />
                Export for Nile
              </Button>
            ) : !loading && !error && exportComplete ? (
              <Button onClick={downloadCsv} disabled={exportData.length === 0}>
                <FileDown className="h-4 w-4 mr-2" />
                Download CSV
              </Button>
            ) : null}
          </div>
        </CardFooter>
      </Card>

      {!loading && !error && exportComplete && (
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
