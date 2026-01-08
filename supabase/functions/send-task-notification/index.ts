import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationType = "task_assigned" | "status_in_progress" | "status_completed" | "status_cancelled" | "status_open";

interface TaskNotificationRequest {
  taskId: string;
  notificationType: NotificationType;
  recipientUserId: string;
  taskTitle: string;
  taskDescription?: string;
  taskDueDate?: string;
  taskPriority?: string;
  updatedByName?: string;
  assigneeName?: string;
}

const getEmailSubject = (type: NotificationType, taskTitle: string): string => {
  switch (type) {
    case "task_assigned":
      return `📋 New Task Assigned: ${taskTitle}`;
    case "status_in_progress":
      return `🔄 Task In Progress: ${taskTitle}`;
    case "status_completed":
      return `✅ Task Completed: ${taskTitle}`;
    case "status_cancelled":
      return `❌ Task Cancelled: ${taskTitle}`;
    case "status_open":
      return `📝 Task Reopened: ${taskTitle}`;
    default:
      return `📋 Task Update: ${taskTitle}`;
  }
};

const getEmailContent = (
  type: NotificationType,
  taskTitle: string,
  recipientName: string,
  taskDescription: string | undefined,
  taskDueDate: string | undefined,
  taskPriority: string | undefined,
  updatedByName: string | undefined,
  assigneeName: string | undefined,
  appUrl: string
): { heading: string; message: string; color: string } => {
  switch (type) {
    case "task_assigned":
      return {
        heading: "New Task Assigned to You",
        message: `<strong>${updatedByName || "Someone"}</strong> has assigned you a new task.`,
        color: "#3b82f6",
      };
    case "status_in_progress":
      return {
        heading: "Task Status Updated",
        message: `<strong>${updatedByName || "Someone"}</strong> has started working on this task.`,
        color: "#f59e0b",
      };
    case "status_completed":
      return {
        heading: "Task Completed! 🎉",
        message: `<strong>${updatedByName || "Someone"}</strong> has completed this task.`,
        color: "#22c55e",
      };
    case "status_cancelled":
      return {
        heading: "Task Cancelled",
        message: `<strong>${updatedByName || "Someone"}</strong> has cancelled this task.`,
        color: "#ef4444",
      };
    case "status_open":
      return {
        heading: "Task Reopened",
        message: `<strong>${updatedByName || "Someone"}</strong> has reopened this task.`,
        color: "#6366f1",
      };
    default:
      return {
        heading: "Task Update",
        message: "A task has been updated.",
        color: "#3b82f6",
      };
  }
};

const generateEmailHtml = (
  type: NotificationType,
  taskTitle: string,
  recipientName: string,
  taskDescription: string | undefined,
  taskDueDate: string | undefined,
  taskPriority: string | undefined,
  updatedByName: string | undefined,
  assigneeName: string | undefined,
  appUrl: string
): string => {
  const { heading, message, color } = getEmailContent(
    type, taskTitle, recipientName, taskDescription, taskDueDate, taskPriority, updatedByName, assigneeName, appUrl
  );

  const priorityColors: Record<string, string> = {
    high: "#ef4444",
    medium: "#eab308",
    low: "#22c55e",
  };

  const formattedDueDate = taskDueDate
    ? new Date(taskDueDate).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
    : null;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f9fafb;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, ${color}, ${color}dd); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">${heading}</h1>
    </div>

    <!-- Content -->
    <div style="background: white; padding: 24px; border-radius: 0 0 12px 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
      <p style="margin: 0 0 24px; color: #374151; font-size: 16px;">
        Hello, <strong>${recipientName || "there"}</strong>! 👋
      </p>

      <p style="margin: 0 0 24px; color: #4b5563; font-size: 15px;">
        ${message}
      </p>

      <!-- Task Details Card -->
      <div style="background: #f3f4f6; border-radius: 8px; padding: 20px; margin-bottom: 24px;">
        <h2 style="margin: 0 0 16px; color: #1f2937; font-size: 18px; font-weight: 600;">
          ${taskTitle}
        </h2>
        
        ${taskDescription ? `
        <p style="margin: 0 0 16px; color: #6b7280; font-size: 14px;">
          ${taskDescription.substring(0, 200)}${taskDescription.length > 200 ? "..." : ""}
        </p>
        ` : ""}

        <div style="display: flex; flex-wrap: wrap; gap: 12px;">
          ${taskPriority ? `
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${priorityColors[taskPriority] || "#6b7280"};"></span>
            <span style="font-size: 13px; color: #4b5563; text-transform: capitalize;">${taskPriority} Priority</span>
          </div>
          ` : ""}
          
          ${formattedDueDate ? `
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px; color: #4b5563;">📅 Due: ${formattedDueDate}</span>
          </div>
          ` : ""}

          ${assigneeName && type === "task_assigned" ? `
          <div style="display: inline-flex; align-items: center; gap: 6px;">
            <span style="font-size: 13px; color: #4b5563;">👤 Assigned to: ${assigneeName}</span>
          </div>
          ` : ""}
        </div>
      </div>

      <!-- CTA Button -->
      <div style="text-align: center; margin-top: 24px;">
        <a href="${appUrl}/tasks" style="display: inline-block; padding: 12px 32px; background: ${color}; color: white; text-decoration: none; border-radius: 8px; font-weight: 500; font-size: 14px;">
          View Task →
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="text-align: center; padding: 24px;">
      <p style="margin: 0; font-size: 12px; color: #9ca3af;">
        You're receiving this because of task notifications.<br>
        <a href="${appUrl}/settings" style="color: #6b7280; text-decoration: underline;">Manage notification settings</a>
      </p>
    </div>
  </div>
</body>
</html>
  `;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const {
      taskId,
      notificationType,
      recipientUserId,
      taskTitle,
      taskDescription,
      taskDueDate,
      taskPriority,
      updatedByName,
      assigneeName,
    }: TaskNotificationRequest = await req.json();

    console.log(`Processing task notification: ${notificationType} for task ${taskId} to user ${recipientUserId}`);

    if (!taskId || !notificationType || !recipientUserId || !taskTitle) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch recipient profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select('id, full_name, "Email ID"')
      .eq("id", recipientUserId)
      .single();

    if (profileError || !profile) {
      console.error("Failed to fetch recipient profile:", profileError);
      return new Response(
        JSON.stringify({ error: "Recipient not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const recipientEmail = profile["Email ID"];
    if (!recipientEmail) {
      console.log(`No email found for user ${recipientUserId}`);
      return new Response(
        JSON.stringify({ success: false, message: "Recipient has no email" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check notification preferences
    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("email_notifications, task_reminders")
      .eq("user_id", recipientUserId)
      .single();

    if (prefs && (prefs.email_notifications === false || prefs.task_reminders === false)) {
      console.log(`User ${recipientUserId} has task email notifications disabled`);
      return new Response(
        JSON.stringify({ success: false, message: "User has notifications disabled" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const appUrl = Deno.env.get("APP_URL") || "https://narvjcteixgjclvjvlbn.lovable.app";
    const emailHtml = generateEmailHtml(
      notificationType,
      taskTitle,
      profile.full_name || "",
      taskDescription,
      taskDueDate,
      taskPriority,
      updatedByName,
      assigneeName,
      appUrl
    );

    const emailSubject = getEmailSubject(notificationType, taskTitle);

    // Get sender email from environment or use a default
    const senderEmail = Deno.env.get("AZURE_SENDER_EMAIL") || Deno.env.get("DEFAULT_SENDER_EMAIL");
    
    if (!senderEmail) {
      console.error("No sender email configured");
      return new Response(
        JSON.stringify({ error: "Sender email not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call send-email function
    const { error: emailError } = await supabase.functions.invoke("send-email", {
      body: {
        to: recipientEmail,
        subject: emailSubject,
        body: emailHtml,
        toName: profile.full_name,
        from: senderEmail,
      },
    });

    if (emailError) {
      console.error("Failed to send task notification email:", emailError);
      return new Response(
        JSON.stringify({ success: false, error: emailError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Task notification email sent successfully to ${recipientEmail}`);

    return new Response(
      JSON.stringify({ success: true, message: "Notification email sent" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Error in send-task-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
