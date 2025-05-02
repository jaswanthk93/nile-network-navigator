
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Define the shape of our payload
interface WebhookPayload {
  type: string;
  table: string;
  record: {
    id: string;
    email: string;
    user_metadata: {
      first_name: string;
      last_name: string;
      company_name: string;
    };
  };
  schema: string;
  old_record: null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    
    // Only handle insert events for auth.users
    if (payload.type !== "INSERT" || payload.table !== "users" || payload.schema !== "auth") {
      return new Response(JSON.stringify({ message: "Not a relevant event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // You'll need to replace this with your preferred email service
    // For this example, we'll just log the information that would be sent
    console.log("A new user has registered and needs approval:");
    console.log(`Email: ${payload.record.email}`);
    console.log(`Name: ${payload.record.user_metadata.first_name} ${payload.record.user_metadata.last_name}`);
    console.log(`Company: ${payload.record.user_metadata.company_name}`);
    
    // Here you would integrate with your email service, e.g., SendGrid, Resend, etc.
    // This would send an email to admin(s) with a link to approve the user
    
    // For a complete implementation, you would need to:
    // 1. Retrieve a list of admin emails from a table or environment variable
    // 2. Format an approval email with a link to an admin panel
    // 3. Send the email via your preferred email provider
    
    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
