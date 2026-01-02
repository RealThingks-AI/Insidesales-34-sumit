import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EntityEmailHistory } from '@/components/shared/EntityEmailHistory';
import { SendEmailModal } from '@/components/SendEmailModal';
import { LeadActivityTimeline } from './LeadActivityTimeline';
import { LeadActivityLogModal } from './LeadActivityLogModal';
import {
  User,
  Building2,
  Mail,
  Phone,
  Globe,
  Linkedin,
  MapPin,
  Clock,
  Send,
  History,
  Plus,
  Activity,
  Factory,
  Pencil,
} from 'lucide-react';
import { format } from 'date-fns';

interface Lead {
  id: string;
  lead_name: string;
  company_name: string | null;
  position: string | null;
  email: string | null;
  phone_no: string | null;
  linkedin: string | null;
  website: string | null;
  country: string | null;
  industry: string | null;
  contact_source: string | null;
  description: string | null;
  lead_status: string | null;
  created_time: string | null;
  modified_time?: string | null;
}

interface LeadDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
  onUpdate?: () => void;
  onEdit?: (lead: Lead) => void;
}

export const LeadDetailModal = ({
  open,
  onOpenChange,
  lead,
  onUpdate,
  onEdit,
}: LeadDetailModalProps) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showActivityLogModal, setShowActivityLogModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  if (!lead) return null;

  const handleActivityLogged = () => {
    setRefreshKey(prev => prev + 1);
    onUpdate?.();
  };

  const getStatusColor = (status: string | null) => {
    switch (status?.toLowerCase()) {
      case 'new': 
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border border-blue-200 dark:border-blue-800';
      case 'attempted': 
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-800';
      case 'follow-up': 
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-orange-200 dark:border-orange-800';
      case 'qualified': 
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border border-green-200 dark:border-green-800';
      case 'disqualified': 
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border border-red-200 dark:border-red-800';
      default: 
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800/50 dark:text-gray-400 border border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <div>
                <DialogTitle className="text-xl flex items-center gap-2">
                  <User className="h-5 w-5" />
                  {lead.lead_name}
                </DialogTitle>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                  {lead.position && <span>{lead.position}</span>}
                  {lead.position && lead.company_name && <span>at</span>}
                  {lead.company_name && (
                    <span className="font-medium">{lead.company_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge className={getStatusColor(lead.lead_status)}>
                    {lead.lead_status || 'New'}
                  </Badge>
                  {lead.contact_source && (
                    <Badge variant="outline">Source: {lead.contact_source}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(lead)}
                    className="gap-2"
                  >
                    <Pencil className="h-4 w-4" />
                    Update
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowActivityLogModal(true)}
                  className="gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Log Activity
                </Button>
              </div>
            </div>
          </DialogHeader>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
              <TabsTrigger value="emails">Emails</TabsTrigger>
              <TabsTrigger value="related">Related</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Contact Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {lead.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${lead.email}`} className="text-primary hover:underline">
                          {lead.email}
                        </a>
                      </div>
                    )}
                    {lead.phone_no && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${lead.phone_no}`} className="hover:underline">
                          {lead.phone_no}
                        </a>
                      </div>
                    )}
                    {lead.linkedin && (
                      <div className="flex items-center gap-2 text-sm">
                        <Linkedin className="h-4 w-4 text-muted-foreground" />
                        <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          LinkedIn Profile
                        </a>
                      </div>
                    )}
                    {lead.website && (
                      <div className="flex items-center gap-2 text-sm">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <a 
                          href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-primary hover:underline"
                        >
                          {lead.website}
                        </a>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Company Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {lead.company_name && (
                      <div className="flex items-center gap-2 text-sm">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.company_name}</span>
                      </div>
                    )}
                    {lead.industry && (
                      <div className="flex items-center gap-2 text-sm">
                        <Factory className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.industry}</span>
                      </div>
                    )}
                    {lead.country && (
                      <div className="flex items-center gap-2 text-sm">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span>{lead.country}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {lead.description && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm whitespace-pre-wrap">{lead.description}</p>
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                {lead.created_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Created: {format(new Date(lead.created_time), 'dd/MM/yyyy')}
                  </span>
                )}
                {lead.modified_time && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Updated: {format(new Date(lead.modified_time), 'dd/MM/yyyy')}
                  </span>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="mt-4">
              <LeadActivityTimeline key={refreshKey} leadId={lead.id} />
            </TabsContent>

            <TabsContent value="emails" className="mt-4">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-medium">Email History</h3>
                  {lead.email && (
                    <Button size="sm" onClick={() => setShowEmailModal(true)}>
                      <Send className="h-4 w-4 mr-1" />
                      Send Email
                    </Button>
                  )}
                </div>
                <EntityEmailHistory entityType="lead" entityId={lead.id} />
              </div>
            </TabsContent>

            <TabsContent value="related" className="mt-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Related Records</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No linked account</p>
                    <p className="text-xs mt-1">Convert this lead to link it to an account</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <LeadActivityLogModal
        open={showActivityLogModal}
        onOpenChange={setShowActivityLogModal}
        leadId={lead.id}
        onSuccess={handleActivityLogged}
      />

      <SendEmailModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        recipient={{
          name: lead.lead_name,
          email: lead.email || undefined,
          company_name: lead.company_name || undefined,
          position: lead.position || undefined,
        }}
        leadId={lead.id}
        onEmailSent={onUpdate}
      />
    </>
  );
};
