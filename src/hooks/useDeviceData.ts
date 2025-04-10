
import { useState, useEffect } from "react";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { DeviceData } from "@/types/network";

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

export const useDeviceData = (userId: string | undefined) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const fetchDevices = async () => {
      if (!userId) return;
      
      setIsLoading(true);
      
      const { data, error } = await supabase
        .from('devices')
        .select('*');
      
      if (error) {
        console.error('Error fetching devices:', error);
        toast({
          title: "Error",
          description: "Failed to load device information.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      const transformedDevices = data.map((device: DeviceData) => ({
        id: device.id,
        ipAddress: device.ip_address,
        hostname: device.hostname || '',
        make: device.make || '',
        model: device.model || '',
        category: (device.category as "AP" | "Switch" | "Controller" | "Router" | "Other") || 'Other',
        status: (device.status as "online" | "offline" | "unknown") || 'unknown',
        needsVerification: device.needs_verification || true,
        confirmed: device.confirmed || false,
        sysDescr: device.sysdescr || ''
      }));
      
      setDevices(transformedDevices);
      setIsLoading(false);
      
      console.log('Devices loaded:', transformedDevices);
    };

    fetchDevices();
  }, [userId, toast]);

  const handleSaveEdit = async (id: string, field: keyof Device, value: string) => {
    try {
      setDevices(devices.map(device => 
        device.id === id ? { ...device, [field]: value } : device
      ));
      
      const fieldMapping: Record<string, string> = {
        'hostname': 'hostname',
        'make': 'make',
        'model': 'model',
        'category': 'category'
      };
      
      const { error } = await supabase
        .from('devices')
        .update({ 
          [fieldMapping[field]]: value,
          confirmed: true,
          needs_verification: false
        })
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      setDevices(devices.map(device => 
        device.id === id ? { 
          ...device, 
          [field]: value,
          confirmed: true,
          needsVerification: false
        } : device
      ));
      
      toast({
        title: "Device updated",
        description: `Successfully updated device ${field}.`,
      });
    } catch (error) {
      console.error('Error updating device:', error);
      toast({
        title: "Update failed",
        description: "Failed to update device information.",
        variant: "destructive",
      });
    }
  };

  const confirmAllDevices = async () => {
    try {
      const { error } = await supabase
        .from('devices')
        .update({ 
          confirmed: true,
          needs_verification: false 
        })
        .in('id', devices.map(d => d.id));
        
      if (error) {
        throw error;
      }
      
      setDevices(devices.map(device => ({
        ...device,
        confirmed: true,
        needsVerification: false
      })));
      
      toast({
        title: "Devices confirmed",
        description: "All device information has been saved.",
      });
      
      return true;
    } catch (error) {
      console.error('Error confirming devices:', error);
      toast({
        title: "Confirmation failed",
        description: "Failed to confirm device information.",
        variant: "destructive",
      });
      return false;
    }
  };

  return {
    devices,
    isLoading,
    handleSaveEdit,
    confirmAllDevices
  };
};
