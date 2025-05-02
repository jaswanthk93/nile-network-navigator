
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
      phone_number: string;
    };
  };
  schema: string;
  old_record: null;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ADMIN_EMAIL = "jaswanth@nilesecure.com";

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    
    console.log("Received webhook payload:", JSON.stringify(payload, null, 2));
    
    // Only handle insert events for auth.users
    if (payload.type !== "INSERT" || payload.table !== "users" || payload.schema !== "auth") {
      console.log("Not a user insert event:", payload.type, payload.table, payload.schema);
      return new Response(JSON.stringify({ message: "Not a relevant event" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { record } = payload;
    const { email, user_metadata } = record;
    
    console.log("Processing user registration:", email, user_metadata);
    
    if (!user_metadata || !user_metadata.first_name) {
      console.error("Missing user metadata in the webhook payload");
      return new Response(
        JSON.stringify({ error: "Invalid user data in webhook payload" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    
    const { first_name, last_name, company_name, phone_number } = user_metadata;

    // Prepare email data
    const emailData = {
      to: ADMIN_EMAIL,
      subject: "New User Registration Requires Approval",
      html: `
        <h2>New User Registration</h2>
        <p>A new user has registered and needs approval:</p>
        <ul>
          <li><strong>Name:</strong> ${first_name} ${last_name}</li>
          <li><strong>Email:</strong> ${email}</li>
          <li><strong>Company:</strong> ${company_name || 'Not provided'}</li>
          <li><strong>Phone:</strong> ${phone_number || 'Not provided'}</li>
        </ul>
        <p>To approve this user, please go to the <a href="${Deno.env.get('SUPABASE_URL') || ''}/dashboard/project/yybospaazevrtngcpbmb/auth/users">Supabase Dashboard</a> and update their profile.</p>
      `,
    };

    // Get API key from environment variable
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY environment variable");
      return new Response(
        JSON.stringify({ error: "Email service configuration is incomplete" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    // Send email using Resend
    console.log("Sending email notification to admin:", ADMIN_EMAIL);
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: "Nile Network Navigator <onboarding@resend.dev>",
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      console.error("Failed to send email:", response.status, JSON.stringify(responseData));
      throw new Error(`Failed to send email: ${JSON.stringify(responseData)}`);
    }

    console.log("Email notification sent to admin:", responseData);
    
    return new Response(JSON.stringify({ success: true, message: "Admin notification email sent" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
