
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

export interface SubsectionProps {
  title: string;
  description: string;
  progress: number;
  path: string;
  available: boolean;
  onNavigate: (path: string) => void;
}

export const SiteSubsection = ({ 
  title, 
  description, 
  progress, 
  path, 
  available, 
  onNavigate 
}: SubsectionProps) => {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs">{Math.round(progress)}%</span>
      </div>
      <Progress 
        value={progress} 
        className="h-1.5" 
      />
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">{description}</p>
        <Button 
          variant="ghost" 
          size="sm" 
          className="h-7 px-2 text-xs"
          disabled={!available}
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(path);
          }}
        >
          {available ? 'Go to section' : 'Locked'}
        </Button>
      </div>
    </div>
  );
};

export interface SiteSubsectionsProps {
  progress: number;
  onNavigate: (path: string) => void;
}

export const getSubsections = (progress: number): SubsectionProps[] => {
  return [
    {
      title: "Site & Subnet Setup",
      description: "Configure site details and network subnets",
      progress: progress >= 25 ? 100 : Math.min(progress * 4, 100),
      path: "/site-subnet",
      available: true,
      onNavigate: () => {}
    },
    {
      title: "Network Discovery",
      description: "Scan and identify devices on your network",
      progress: progress < 25 ? 0 : 
              progress >= 50 ? 100 : 
              Math.min((progress - 25) * 4, 100),
      path: "/discovery",
      available: progress >= 25,
      onNavigate: () => {}
    },
    {
      title: "Device Verification",
      description: "Verify discovered network elements",
      progress: progress < 50 ? 0 : 
              progress >= 75 ? 100 : 
              Math.min((progress - 50) * 4, 100),
      path: "/devices",
      available: progress >= 50,
      onNavigate: () => {}
    },
    {
      title: "VLAN Management",
      description: "Configure and manage VLANs",
      progress: progress < 75 ? 0 : 
              progress >= 85 ? 100 : 
              Math.min((progress - 75) * 10, 100),
      path: "/vlans",
      available: progress >= 75,
      onNavigate: () => {}
    },
    {
      title: "MAC Addresses",
      description: "Collect and organize MAC addresses",
      progress: progress < 85 ? 0 : 
              progress >= 95 ? 100 : 
              Math.min((progress - 85) * 10, 100),
      path: "/mac-addresses",
      available: progress >= 85,
      onNavigate: () => {}
    },
    {
      title: "Export for Migration",
      description: "Generate migration files for Nile",
      progress: progress < 95 ? 0 : 
              progress >= 100 ? 100 : 
              Math.min((progress - 95) * 20, 100),
      path: "/export",
      available: progress >= 95,
      onNavigate: () => {}
    }
  ];
};

export const SiteSubsections = ({ progress, onNavigate }: SiteSubsectionsProps) => {
  const subsections = getSubsections(progress).map(subsection => ({
    ...subsection,
    onNavigate
  }));

  return (
    <div className="space-y-4">
      {subsections.map((subsection, index) => (
        <SiteSubsection key={index} {...subsection} />
      ))}
    </div>
  );
};
