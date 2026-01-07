import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RelatedTasksSection } from "@/components/shared/RelatedTasksSection";
import { Task } from "@/types/task";
import { 
  Calendar, 
  Clock, 
  User, 
  Users, 
  Building2,
  Briefcase,
  Video,
  ExternalLink,
  Loader2,
  FileText,
  CheckCircle2,
  AlertCircle,
  UserX,
  CalendarClock,
  Activity,
  ListTodo,
  Pencil,
  Plus,
  Link2,
  History
} from "lucide-react";
import { format } from "date-fns";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { getMeetingStatus } from "@/utils/meetingStatus";
import { MeetingFollowUpsSection } from "./MeetingFollowUpsSection";
import { RecordChangeHistory } from "@/components/shared/RecordChangeHistory";
import { ContactDetailModal } from "@/components/contacts/ContactDetailModal";
import { LeadDetailModal } from "@/components/leads/LeadDetailModal";

interface Meeting {
  id: string;
  subject: string;
  description?: string | null;
  start_time: string;
  end_time: string;
  join_url?: string | null;
  attendees?: unknown;
  lead_id?: string | null;
  contact_id?: string | null;
  account_id?: string | null;
  deal_id?: string | null;
  created_by?: string | null;
  created_at?: string | null;
  status: string;
  outcome?: string | null;
  notes?: string | null;
  lead_name?: string | null;
  contact_name?: string | null;
}

interface LinkedContact {
  id: string;
  contact_name: string;
  email?: string | null;
  phone_no?: string | null;
  position?: string | null;
  company_name?: string | null;
  account_id?: string | null;
  linkedin?: string | null;
  website?: string | null;
  region?: string | null;
  industry?: string | null;
  contact_source?: string | null;
  description?: string | null;
  tags?: string[] | null;
  email_opens?: number | null;
  email_clicks?: number | null;
  engagement_score?: number | null;
  created_time?: string | null;
  modified_time?: string | null;
}

interface LinkedLead {
  id: string;
  lead_name: string;
  email?: string | null;
  phone_no?: string | null;
  position?: string | null;
  company_name?: string | null;
  account_id?: string | null;
  linkedin?: string | null;
  website?: string | null;
  country?: string | null;
  industry?: string | null;
  contact_source?: string | null;
  description?: string | null;
  lead_status?: string | null;
  created_time?: string | null;
  modified_time?: string | null;
}

interface MeetingDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  meeting: Meeting | null;
  onEdit?: (meeting: Meeting) => void;
  onUpdate?: () => void;
}

const statusColors: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  ongoing: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800',
  completed: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400 border-gray-200 dark:border-gray-700',
};

const outcomeConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  successful: {
    label: "Successful",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
  },
  follow_up_needed: {
    label: "Follow-up Needed",
    icon: <AlertCircle className="h-3 w-3" />,
    className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
  },
  no_show: {
    label: "No-show",
    icon: <UserX className="h-3 w-3" />,
    className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
  },
  rescheduled: {
    label: "Rescheduled",
    icon: <CalendarClock className="h-3 w-3" />,
    className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
  }
};

export const MeetingDetailModal = ({ 
  open, 
  onOpenChange, 
  meeting, 
  onEdit,
  onUpdate 
}: MeetingDetailModalProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [linkedContact, setLinkedContact] = useState<LinkedContact | null>(null);
  const [linkedLead, setLinkedLead] = useState<LinkedLead | null>(null);
  const [loading, setLoading] = useState(false);
  const [tasksRefreshToken, setTasksRefreshToken] = useState(0);

  // Detail modal states
  const [showContactDetailModal, setShowContactDetailModal] = useState(false);
  const [showLeadDetailModal, setShowLeadDetailModal] = useState(false);

  // Navigate to Tasks module for task creation
  const handleRequestCreateTask = () => {
    if (!meeting) return;
    const params = new URLSearchParams({
      create: '1',
      module: 'meetings',
      recordId: meeting.id,
      recordName: meeting.subject,
      return: '/meetings',
      returnViewId: meeting.id,
      returnTab: 'tasks',
    });
    onOpenChange(false);
    navigate(`/tasks?${params.toString()}`);
  };

  const handleRequestEditTask = (task: Task) => {
    if (!meeting) return;
    const params = new URLSearchParams({
      viewId: task.id,
      return: '/meetings',
      returnViewId: meeting.id,
      returnTab: 'tasks',
    });
    onOpenChange(false);
    navigate(`/tasks?${params.toString()}`);
  };

  const userIds = [meeting?.created_by].filter(Boolean) as string[];
  const { displayNames } = useUserDisplayNames(userIds);

  useEffect(() => {
    if (meeting && open) {
      fetchLinkedData();
    }
  }, [meeting?.id, open]);

  const fetchLinkedData = async () => {
    if (!meeting) return;
    setLoading(true);
    try {
      // Fetch linked contact if exists
      if (meeting.contact_id) {
        const { data: contactData } = await supabase
          .from('contacts')
          .select('*')
          .eq('id', meeting.contact_id)
          .single();
        setLinkedContact(contactData);
      } else {
        setLinkedContact(null);
      }

      // Fetch linked lead if exists
      if (meeting.lead_id) {
        const { data: leadData } = await supabase
          .from('leads')
          .select('*')
          .eq('id', meeting.lead_id)
          .single();
        setLinkedLead(leadData);
      } else {
        setLinkedLead(null);
      }
    } catch (error) {
      console.error('Error fetching linked data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!meeting) return null;

  const effectiveStatus = getMeetingStatus(meeting);
  const attendeesList = meeting.attendees && Array.isArray(meeting.attendees) 
    ? (meeting.attendees as { email: string; name?: string }[])
    : [];

  const getStatusBadge = () => {
    const label = effectiveStatus.charAt(0).toUpperCase() + effectiveStatus.slice(1);
    return (
      <Badge variant="outline" className={statusColors[effectiveStatus]}>
        {label}
      </Badge>
    );
  };

  const getOutcomeBadge = () => {
    if (!meeting.outcome) return null;
    const config = outcomeConfig[meeting.outcome];
    if (!config) return null;
    return (
      <Badge variant="outline" className={`gap-1 ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-200">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  {meeting.subject}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-2">
                  {getStatusBadge()}
                  {getOutcomeBadge()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {meeting.join_url && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(meeting.join_url!, '_blank')}
                    className="gap-2"
                  >
                    <Video className="h-4 w-4" />
                    Join
                  </Button>
                )}
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(meeting)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview" className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="linked" className="flex items-center gap-1">
                <Link2 className="h-4 w-4" />
                Linked
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-1">
                <ListTodo className="h-4 w-4" />
                Tasks
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex items-center gap-1">
                <Activity className="h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="history" className="flex items-center gap-1">
                <History className="h-4 w-4" />
                History
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Meeting Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>{format(new Date(meeting.start_time), 'EEEE, dd MMM yyyy')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(meeting.start_time), 'HH:mm')} - {format(new Date(meeting.end_time), 'HH:mm')}
                      </span>
                    </div>
                    {meeting.description && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground mb-1">Description</p>
                        <p className="text-sm whitespace-pre-wrap">{meeting.description}</p>
                      </div>
                    )}
                    {meeting.notes && (
                      <div className="mt-3">
                        <p className="text-sm text-muted-foreground mb-1">Notes</p>
                        <p className="text-sm whitespace-pre-wrap">{meeting.notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Attendees</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {meeting.lead_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Users className="h-4 w-4 text-muted-foreground" />
                        <span>Lead: {meeting.lead_name}</span>
                      </div>
                    )}
                    {meeting.contact_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Contact: {meeting.contact_name}</span>
                      </div>
                    )}
                    {attendeesList.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm text-muted-foreground mb-2">External Participants</p>
                        <div className="space-y-1">
                          {attendeesList.map((attendee, idx) => (
                            <div key={idx} className="text-sm flex items-center gap-2">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span>{attendee.name || attendee.email}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {meeting.created_by && (
                      <div className="flex items-center gap-2 text-sm mt-3 pt-3 border-t">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>Organizer: {displayNames[meeting.created_by] || 'Loading...'}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Follow-ups Section */}
              <MeetingFollowUpsSection meetingId={meeting.id} />

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {meeting.created_at && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {format(new Date(meeting.created_at), 'dd/MM/yyyy')}
                  </span>
                )}
              </div>
            </TabsContent>

            <TabsContent value="linked" className="mt-4 space-y-4">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Linked Contact */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Contact
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {linkedContact ? (
                        <div
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => setShowContactDetailModal(true)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{linkedContact.contact_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {linkedContact.position || 'Contact'}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <ExternalLink className="h-4 w-4" />
                            View Details
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No linked contact</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Linked Lead */}
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Lead
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {linkedLead ? (
                        <div
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer"
                          onClick={() => setShowLeadDetailModal(true)}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Users className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{linkedLead.lead_name}</p>
                              <p className="text-sm text-muted-foreground">
                                {linkedLead.company_name || 'Lead'}
                              </p>
                            </div>
                          </div>
                          <Button variant="ghost" size="sm" className="gap-2">
                            <ExternalLink className="h-4 w-4" />
                            View Details
                          </Button>
                        </div>
                      ) : (
                        <div className="text-center py-6 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No linked lead</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Empty state */}
              {!loading && !linkedContact && !linkedLead && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No linked records</p>
                  <p className="text-xs mt-1">This meeting is not linked to any contact or lead</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tasks" className="mt-4">
              <RelatedTasksSection
                moduleType="meetings"
                recordId={meeting.id}
                recordName={meeting.subject}
                refreshToken={tasksRefreshToken}
                onRequestCreateTask={handleRequestCreateTask}
                onRequestEditTask={handleRequestEditTask}
              />
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Meeting Notes & Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {meeting.notes ? (
                    <p className="text-sm whitespace-pre-wrap">{meeting.notes}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No notes recorded for this meeting</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Change History</CardTitle>
                </CardHeader>
                <CardContent>
                  <RecordChangeHistory entityType="meetings" entityId={meeting.id} maxHeight="300px" />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Detail Modals */}
      {linkedContact && (
        <ContactDetailModal
          open={showContactDetailModal}
          onOpenChange={setShowContactDetailModal}
          contact={{ ...linkedContact, company_name: linkedContact.company_name || null }}
          onUpdate={onUpdate}
        />
      )}

      {linkedLead && (
        <LeadDetailModal
          open={showLeadDetailModal}
          onOpenChange={setShowLeadDetailModal}
          lead={{ ...linkedLead, company_name: linkedLead.company_name || null }}
          onUpdate={onUpdate}
        />
      )}
    </>
  );
};
