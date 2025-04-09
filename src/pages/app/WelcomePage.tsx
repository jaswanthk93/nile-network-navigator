
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { NetworkIcon, DatabaseIcon, ScanSearchIcon, FolderKanbanIcon, PackageIcon } from "lucide-react";

const WelcomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const steps = [
    {
      id: 1,
      title: "Site & Subnet Entry",
      description: "Define your network sites and management subnets",
      icon: <DatabaseIcon className="h-12 w-12" />,
      path: "/site-subnet"
    },
    {
      id: 2,
      title: "Network Discovery",
      description: "Discover devices on your network",
      icon: <ScanSearchIcon className="h-12 w-12" />,
      path: "/discovery"
    },
    {
      id: 3,
      title: "VLAN Configuration",
      description: "Configure and map VLANs to segments",
      icon: <FolderKanbanIcon className="h-12 w-12" />,
      path: "/vlans"
    },
    {
      id: 4,
      title: "Export to Nile",
      description: "Export your network data to Nile",
      icon: <PackageIcon className="h-12 w-12" />,
      path: "/export"
    }
  ];

  return (
    <div className="container mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10">
          <NetworkIcon className="h-10 w-10 text-primary" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">
          Welcome to the Nile Migration App
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl">
          You've made a great decision! Let's start discovering your network by defining your service areas and management access.
        </p>
        <Button 
          size="lg" 
          className="mt-6"
          onClick={() => navigate('/site-subnet')}
        >
          Start Discovery
        </Button>
      </div>

      <div className="mt-16">
        <h2 className="text-2xl font-semibold mb-8 text-center">Migration Process</h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <Card key={step.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex justify-center mb-4 text-primary">
                  {step.icon}
                </div>
                <CardTitle className="text-xl text-center">
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-grow">
                <CardDescription className="text-center">
                  {step.description}
                </CardDescription>
              </CardContent>
              <CardFooter className="pt-2 flex justify-center">
                <Button variant="outline" onClick={() => navigate(step.path)}>
                  Go to Step {step.id}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      </div>
      
      <div className="mt-12 rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-4">What to expect</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <h3 className="font-medium">Site & Subnet Configuration</h3>
            <p className="text-sm text-muted-foreground">
              Define your network sites and management subnets to organize your network discovery.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Device Discovery</h3>
            <p className="text-sm text-muted-foreground">
              Automatically discover and identify devices on your network.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">VLAN Management</h3>
            <p className="text-sm text-muted-foreground">
              Map VLANs to network segments and organize your network structure.
            </p>
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">Migration Export</h3>
            <p className="text-sm text-muted-foreground">
              Generate migration files for seamless transition to Nile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomePage;
