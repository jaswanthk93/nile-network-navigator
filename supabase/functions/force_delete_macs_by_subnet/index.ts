
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.6'

serve(async (req) => {
  try {
    const { subnetId } = await req.json()
    
    if (!subnetId) {
      return new Response(
        JSON.stringify({ error: 'Missing subnetId parameter' }),
        { headers: { 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    // Create a Supabase client with the project details
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    console.log(`Attempting to force delete MAC addresses for subnet: ${subnetId}`)
    
    // Using service role to bypass RLS
    const { error } = await supabaseClient
      .from('mac_addresses')
      .delete()
      .eq('subnet_id', subnetId)
    
    if (error) {
      console.error('Error in force deletion:', error)
      return new Response(
        JSON.stringify({ error: `Failed to delete MAC addresses: ${error.message}` }),
        { headers: { 'Content-Type': 'application/json' }, status: 500 }
      )
    }
    
    return new Response(
      JSON.stringify({ success: true, message: 'MAC addresses successfully deleted' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
