
import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Network, Server, Layers, FileDown } from "lucide-react";
import { SessionResumptionDialog } from "@/components/welcome/SessionResumptionDialog";

const WelcomePage = () => {
  return (
    <div className="container mx-auto max-w-5xl space-y-8">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome to Nile Network Navigator</h1>
        <p className="text-muted-foreground">
          This tool helps you discover and document your network to migrate to Nile.
        </p>
      </div>

      {/* Session Resumption Dialog will show only when needed */}
      <SessionResumptionDialog />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5" />
              Site & Subnet Setup
            </CardTitle>
            <CardDescription>Configure your site details and network subnets</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Start by providing basic information about your network site and subnets.
              These details will help us navigate your network effectively.
            </p>
          </CardContent>
          <CardFooter>
            <Link to="/site-subnet" className="w-full">
              <Button className="w-full">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Network Discovery
            </CardTitle>
            <CardDescription>Scan and identify devices on your network</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Our discovery tool will scan your network and identify connected devices,
              making it easy to map your current infrastructure.
            </p>
          </CardContent>
          <CardFooter>
            <Link to="/discovery" className="w-full">
              <Button variant="outline" className="w-full">
                Go to Discovery
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              VLAN Management
            </CardTitle>
            <CardDescription>Review and manage your VLANs</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Organize and validate your VLAN configuration before migration
              to ensure a smooth transition to Nile.
            </p>
          </CardContent>
          <CardFooter>
            <Link to="/vlans" className="w-full">
              <Button variant="outline" className="w-full">
                Manage VLANs
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5" />
              Export for Migration
            </CardTitle>
            <CardDescription>Generate migration files for Nile</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              When you're ready, export your network data in a format
              compatible with Nile's migration tools.
            </p>
          </CardContent>
          <CardFooter>
            <Link to="/export" className="w-full">
              <Button variant="outline" className="w-full">
                Export Data
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  );
};

export default WelcomePage;
