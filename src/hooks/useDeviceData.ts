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
  subnet_id?: string;
}

export const useDeviceData = (userId: string | undefined) => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

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
      sysDescr: device.sysdescr || '',
      subnet_id: device.subnet_id
    }));
    
    setDevices(transformedDevices);
    setIsLoading(false);
    
    console.log('Devices loaded:', transformedDevices);
  };

  useEffect(() => {
    fetchDevices();
  }, [userId, toast]);

  const handleSaveEdit = async (id: string, field: string, value: string) => {
    try {
      // First update local state to maintain UI responsiveness
      setDevices(devices.map(device => 
        device.id === id ? { ...device, [field]: value } : device
      ));
      
      const fieldMapping: Record<string, string> = {
        'hostname': 'hostname',
        'make': 'make',
        'model': 'model',
        'category': 'category'
      };
      
      // Then update the database but don't change verification status
      // This allows editing multiple fields before final confirmation
      const { error } = await supabase
        .from('devices')
        .update({ [fieldMapping[field]]: value })
        .eq('id', id);
      
      if (error) {
        throw error;
      }
      
      toast({
        title: "Field updated",
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

  const handleDeleteDevice = async (id: string, isSwitch: boolean) => {
    try {
      // If it's a switch, we need to delete all devices associated with it
      if (isSwitch) {
        // First get the subnet_id of the switch
        const switchDevice = devices.find(device => device.id === id);
        if (!switchDevice || !switchDevice.subnet_id) {
          throw new Error("Could not determine subnet for this switch");
        }
        
        // Delete all devices with the same subnet_id
        const { error: deleteAssociatedError } = await supabase
          .from('devices')
          .delete()
          .eq('subnet_id', switchDevice.subnet_id);
          
        if (deleteAssociatedError) {
          throw deleteAssociatedError;
        }
        
        // Update local state by removing all devices with that subnet_id
        setDevices(devices.filter(device => device.subnet_id !== switchDevice.subnet_id));
        
        toast({
          title: "Switch deleted",
          description: "Successfully deleted the switch and all associated devices.",
        });
      } else {
        // Just delete the single device
        const { error } = await supabase
          .from('devices')
          .delete()
          .eq('id', id);
        
        if (error) {
          throw error;
        }
        
        // Update local state
        setDevices(devices.filter(device => device.id !== id));
        
        toast({
          title: "Device deleted",
          description: "Successfully deleted the device.",
        });
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      toast({
        title: "Deletion failed",
        description: "Failed to delete the device. Please try again.",
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
    handleDeleteDevice,
    confirmAllDevices,
    refreshDevices: fetchDevices
  };
};
