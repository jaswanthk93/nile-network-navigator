
-- Create a function to force delete MAC addresses by subnet ID
CREATE OR REPLACE FUNCTION public.force_delete_macs_by_subnet(subnet_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Delete MAC addresses for a specific subnet
  DELETE FROM public.mac_addresses 
  WHERE subnet_id = subnet_id_param;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.force_delete_macs_by_subnet(UUID) TO authenticated;
