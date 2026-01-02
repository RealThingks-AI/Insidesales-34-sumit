import { useState, useEffect, useMemo, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { useUserDisplayNames } from "@/hooks/useUserDisplayNames";
import { useMeetingsImportExport } from "@/hooks/useMeetingsImportExport";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Search, Video, Trash2, Edit, Calendar, ArrowUpDown, ArrowUp, ArrowDown, List, CalendarDays, CheckCircle2, AlertCircle, UserX, CalendarClock, User, Columns, Upload, Download, X } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MeetingsCalendarView } from "@/components/meetings/MeetingsCalendarView";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MeetingModal } from "@/components/MeetingModal";
import { MeetingColumnCustomizer, defaultMeetingColumns, MeetingColumnConfig } from "@/components/meetings/MeetingColumnCustomizer";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { TablePagination } from "@/components/shared/TablePagination";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { getMeetingStatus } from "@/utils/meetingStatus";

type SortColumn = 'subject' | 'date' | 'time' | 'lead_contact' | 'status' | null;
type SortDirection = 'asc' | 'desc';

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
  created_by?: string | null;
  created_at?: string | null;
  status: string;
  outcome?: string | null;
  notes?: string | null;
  lead_name?: string | null;
  contact_name?: string | null;
}

const ITEMS_PER_PAGE = 25;

const Meetings = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialStatus = searchParams.get('status') || 'all';
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [filteredMeetings, setFilteredMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | null>(null);
  const [viewingMeetingId, setViewingMeetingId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [meetingToDelete, setMeetingToDelete] = useState<string | null>(null);
  const [selectedMeetings, setSelectedMeetings] = useState<string[]>([]);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>(initialStatus);
  const [organizerFilter, setOrganizerFilter] = useState<string>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<'table' | 'calendar'>('table');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  
  // Column customizer state
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [columns, setColumns] = useState<MeetingColumnConfig[]>(defaultMeetingColumns);

  // Get owner parameter from URL - "me" means filter by current user
  const ownerParam = searchParams.get('owner');

  // Import/Export hook
  const { handleImport, handleExport, isImporting, isExporting, fileInputRef, triggerFileInput } = useMeetingsImportExport(() => {
    fetchMeetings();
  });

  // Sync owner filter when URL has owner=me
  useEffect(() => {
    if (ownerParam === 'me' && user?.id) {
      setOrganizerFilter(user.id);
    } else if (!ownerParam) {
      setOrganizerFilter('all');
    }
  }, [ownerParam, user?.id]);

  // Sync statusFilter when URL changes
  useEffect(() => {
    const urlStatus = searchParams.get('status');
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  // Handle viewId from URL (from global search)
  useEffect(() => {
    const viewId = searchParams.get('viewId');
    if (viewId && meetings.length > 0) {
      const meetingToView = meetings.find(m => m.id === viewId);
      if (meetingToView) {
        setEditingMeeting(meetingToView);
        setShowModal(true);
        // Clear the viewId from URL after opening
        setSearchParams(prev => {
          prev.delete('viewId');
          return prev;
        }, { replace: true });
      }
    }
  }, [searchParams, meetings, setSearchParams]);

  // Fetch all profiles for organizer dropdown
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
  });

  // Get organizer display names
  const organizerIds = useMemo(() => {
    return [...new Set(meetings.map(m => m.created_by).filter(Boolean))] as string[];
  }, [meetings]);
  const { displayNames: organizerNames } = useUserDisplayNames(organizerIds);

  const fetchMeetings = async () => {
    try {
      setLoading(true);
      const {
        data,
        error
      } = await supabase.from('meetings').select(`
          *,
          leads:lead_id (lead_name),
          contacts:contact_id (contact_name)
        `).order('start_time', {
        ascending: true
      });
      if (error) throw error;
      const transformedData = (data || []).map(meeting => ({
        ...meeting,
        lead_name: meeting.leads?.lead_name,
        contact_name: meeting.contacts?.contact_name
      }));
      setMeetings(transformedData);
      setSelectedMeetings([]);
    } catch (error) {
      console.error('Error fetching meetings:', error);
      toast({
        title: "Error",
        description: "Failed to fetch meetings",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMeetings();
  }, []);

  const getEffectiveStatus = (meeting: Meeting) => {
    return getMeetingStatus(meeting);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (column: SortColumn) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" />;
    }
    return sortDirection === 'asc' ? <ArrowUp className="h-4 w-4 ml-1" /> : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  const sortedAndFilteredMeetings = useMemo(() => {
    let filtered = meetings.filter(meeting => {
      const matchesSearch = meeting.subject?.toLowerCase().includes(searchTerm.toLowerCase()) || meeting.lead_name?.toLowerCase().includes(searchTerm.toLowerCase()) || meeting.contact_name?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === "all" || getEffectiveStatus(meeting) === statusFilter;
      const matchesOrganizer = organizerFilter === "all" || meeting.created_by === organizerFilter;
      
      return matchesSearch && matchesStatus && matchesOrganizer;
    });
    if (sortColumn) {
      filtered = [...filtered].sort((a, b) => {
        let aValue: string | number = '';
        let bValue: string | number = '';
        switch (sortColumn) {
          case 'subject':
            aValue = a.subject?.toLowerCase() || '';
            bValue = b.subject?.toLowerCase() || '';
            break;
          case 'date':
            aValue = new Date(a.start_time).setHours(0, 0, 0, 0);
            bValue = new Date(b.start_time).setHours(0, 0, 0, 0);
            break;
          case 'time':
            const aDate = new Date(a.start_time);
            const bDate = new Date(b.start_time);
            aValue = aDate.getHours() * 60 + aDate.getMinutes();
            bValue = bDate.getHours() * 60 + bDate.getMinutes();
            break;
          case 'lead_contact':
            aValue = (a.lead_name || a.contact_name || '').toLowerCase();
            bValue = (b.lead_name || b.contact_name || '').toLowerCase();
            break;
          case 'status':
            aValue = getEffectiveStatus(a);
            bValue = getEffectiveStatus(b);
            break;
        }
        if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return filtered;
  }, [meetings, searchTerm, statusFilter, organizerFilter, sortColumn, sortDirection]);

  useEffect(() => {
    setFilteredMeetings(sortedAndFilteredMeetings);
    setCurrentPage(1); // Reset to first page when filters change
  }, [sortedAndFilteredMeetings]);

  // Pagination calculations
  const totalPages = Math.ceil(filteredMeetings.length / ITEMS_PER_PAGE);
  const paginatedMeetings = useMemo(() => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredMeetings.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  }, [filteredMeetings, currentPage]);

  const handleDelete = async (id: string) => {
    try {
      const {
        error
      } = await supabase.from('meetings').delete().eq('id', id);
      if (error) throw error;
      toast({
        title: "Success",
        description: "Meeting deleted successfully"
      });
      fetchMeetings();
    } catch (error) {
      console.error('Delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete meeting",
        variant: "destructive"
      });
    }
  };

  const handleBulkDelete = async () => {
    try {
      const {
        error
      } = await supabase.from('meetings').delete().in('id', selectedMeetings);
      if (error) throw error;
      toast({
        title: "Success",
        description: `${selectedMeetings.length} meeting(s) deleted successfully`
      });
      setSelectedMeetings([]);
      fetchMeetings();
    } catch (error) {
      console.error('Bulk delete error:', error);
      toast({
        title: "Error",
        description: "Failed to delete meetings",
        variant: "destructive"
      });
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMeetings(paginatedMeetings.map(m => m.id));
    } else {
      setSelectedMeetings([]);
    }
  };

  const handleSelectMeeting = (meetingId: string, checked: boolean) => {
    if (checked) {
      setSelectedMeetings(prev => [...prev, meetingId]);
    } else {
      setSelectedMeetings(prev => prev.filter(id => id !== meetingId));
    }
  };

  const isAllSelected = paginatedMeetings.length > 0 && paginatedMeetings.every(m => selectedMeetings.includes(m.id));
  const isSomeSelected = paginatedMeetings.some(m => selectedMeetings.includes(m.id)) && !isAllSelected;

  const getStatusBadge = (meeting: Meeting) => {
    const status = getEffectiveStatus(meeting);
    if (status === "cancelled") {
      return <Badge variant="destructive">Cancelled</Badge>;
    }
    if (status === "ongoing") {
      return <Badge variant="secondary">Ongoing</Badge>;
    }
    if (status === "completed") {
      return <Badge variant="outline">Completed</Badge>;
    }
    return <Badge variant="default">Scheduled</Badge>;
  };

  const getOutcomeBadge = (outcome: string | null) => {
    if (!outcome) return <span className="text-muted-foreground">—</span>;
    const outcomeConfig: Record<string, {
      label: string;
      icon: React.ReactNode;
      className: string;
    }> = {
      successful: {
        label: "Successful",
        icon: <CheckCircle2 className="h-3 w-3" />,
        className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
      },
      follow_up_needed: {
        label: "Follow-up",
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
    const config = outcomeConfig[outcome];
    if (!config) return <span className="text-muted-foreground">—</span>;
    return <Badge variant="outline" className={`gap-1 ${config.className}`}>
        {config.icon}
        {config.label}
      </Badge>;
  };

  const isColumnVisible = (field: string) => {
    const col = columns.find(c => c.field === field);
    return col ? col.visible : true;
  };

  const handleClearOwnerFilter = () => {
    const newParams = new URLSearchParams(searchParams);
    newParams.delete('owner');
    setSearchParams(newParams);
    setOrganizerFilter('all');
  };

  const hasActiveFilters = statusFilter !== 'all' || organizerFilter !== 'all' || searchTerm !== '';

  const handleClearAllFilters = () => {
    setStatusFilter('all');
    setOrganizerFilter('all');
    setSearchTerm('');
    const newParams = new URLSearchParams();
    setSearchParams(newParams);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImport(file);
      e.target.value = ''; // Reset input
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading meetings...</p>
        </div>
      </div>;
  }

  return <div className="h-screen flex flex-col bg-background overflow-hidden">
      {/* Hidden file input for import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".csv"
        className="hidden"
      />

      {/* Fixed Header */}
      <div className="flex-shrink-0 bg-background">
        <div className="px-6 h-16 flex items-center border-b w-full">
          <div className="flex items-center justify-between w-full">
            <div className="min-w-0 flex-1 flex items-center gap-3">
              <h1 className="text-xl text-foreground font-semibold">Meetings</h1>
              {ownerParam === 'me' && (
                <Badge variant="secondary" className="gap-1">
                  <User className="h-3 w-3" />
                  My Meetings
                  <button
                    onClick={handleClearOwnerFilter}
                    className="ml-1 hover:bg-muted-foreground/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* View Toggle */}
              <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
                <Button variant={viewMode === 'table' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('table')} className="gap-1.5 h-8 px-2.5 text-xs">
                  <List className="h-3.5 w-3.5" />
                  List
                </Button>
                <Button variant={viewMode === 'calendar' ? 'secondary' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} className="gap-1.5 h-8 px-2.5 text-xs">
                  <CalendarDays className="h-3.5 w-3.5" />
                  Calendar
                </Button>
              </div>

              {/* Actions Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1">
                    Actions
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => setShowColumnCustomizer(true)}>
                    <Columns className="h-4 w-4 mr-2" />
                    Columns
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={triggerFileInput} disabled={isImporting}>
                    <Upload className="h-4 w-4 mr-2" />
                    {isImporting ? 'Importing...' : 'Import CSV'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport(filteredMeetings)} disabled={isExporting || filteredMeetings.length === 0}>
                    <Download className="h-4 w-4 mr-2" />
                    {isExporting ? 'Exporting...' : 'Export CSV'}
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    disabled={selectedMeetings.length === 0} 
                    className="text-destructive focus:text-destructive"
                    onClick={() => setShowBulkDeleteDialog(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Selected ({selectedMeetings.length})
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              
              <Button size="sm" onClick={() => {
              setEditingMeeting(null);
              setShowModal(true);
            }}>
                Add Meeting
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-auto px-4 pt-2 pb-4">
        {viewMode === 'calendar' ? <MeetingsCalendarView meetings={filteredMeetings} onMeetingClick={meeting => {
        setEditingMeeting(meeting);
        setShowModal(true);
      }} onMeetingUpdated={fetchMeetings} /> : <div className="space-y-3">
            {/* Search and Bulk Actions */}
            <div className="flex items-center gap-4 flex-wrap">
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search meetings..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" inputSize="control" />
              </div>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>

              <Select value={organizerFilter} onValueChange={setOrganizerFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Organizers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizers</SelectItem>
                  {allProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.full_name || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Clear Filters Button */}
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={handleClearAllFilters} className="gap-1">
                  <X className="h-4 w-4" />
                  Clear Filters
                </Button>
              )}

              {/* Bulk Actions */}
              {selectedMeetings.length > 0 && <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-lg">
                  <span className="text-sm text-muted-foreground">
                    {selectedMeetings.length} selected
                  </span>
                  <Button variant="destructive" size="sm" onClick={() => setShowBulkDeleteDialog(true)} className="gap-2">
                    <Trash2 className="h-4 w-4" />
                    Delete Selected
                  </Button>
                </div>}
            </div>

            {/* Table */}
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox checked={isAllSelected} ref={el => {
                    if (el) {
                      (el as any).indeterminate = isSomeSelected;
                    }
                  }} onCheckedChange={handleSelectAll} aria-label="Select all" />
                    </TableHead>
                    {isColumnVisible('subject') && (
                      <TableHead className="min-w-[200px]">
                        <button onClick={() => handleSort('subject')} className="group flex items-center hover:text-foreground transition-colors">
                          Subject {getSortIcon('subject')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('date') && (
                      <TableHead>
                        <button onClick={() => handleSort('date')} className="group flex items-center hover:text-foreground transition-colors">
                          Date {getSortIcon('date')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('time') && (
                      <TableHead>
                        <button onClick={() => handleSort('time')} className="group flex items-center hover:text-foreground transition-colors">
                          Time {getSortIcon('time')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('lead_contact') && (
                      <TableHead>
                        <button onClick={() => handleSort('lead_contact')} className="group flex items-center hover:text-foreground transition-colors">
                          Lead/Contact {getSortIcon('lead_contact')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('status') && (
                      <TableHead>
                        <button onClick={() => handleSort('status')} className="group flex items-center hover:text-foreground transition-colors">
                          Status {getSortIcon('status')}
                        </button>
                      </TableHead>
                    )}
                    {isColumnVisible('outcome') && <TableHead>Outcome</TableHead>}
                    {isColumnVisible('join_url') && <TableHead>Join URL</TableHead>}
                    {isColumnVisible('organizer') && <TableHead>Organizer</TableHead>}
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedMeetings.length === 0 ? <TableRow>
                      <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                        <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        No meetings found
                      </TableCell>
                    </TableRow> : paginatedMeetings.map(meeting => <TableRow key={meeting.id} className={selectedMeetings.includes(meeting.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox checked={selectedMeetings.includes(meeting.id)} onCheckedChange={checked => handleSelectMeeting(meeting.id, !!checked)} aria-label={`Select ${meeting.subject}`} />
                        </TableCell>
                        {isColumnVisible('subject') && (
                          <TableCell className="font-medium text-primary cursor-pointer hover:underline" onClick={() => {
                            setEditingMeeting(meeting);
                            setShowModal(true);
                          }}>
                            {meeting.subject}
                          </TableCell>
                        )}
                        {isColumnVisible('date') && (
                          <TableCell className="text-sm">
                            {format(new Date(meeting.start_time), 'dd/MM/yyyy')}
                          </TableCell>
                        )}
                        {isColumnVisible('time') && (
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(meeting.start_time), 'HH:mm')} - {format(new Date(meeting.end_time), 'HH:mm')}
                          </TableCell>
                        )}
                        {isColumnVisible('lead_contact') && (
                          <TableCell>
                            {meeting.lead_name && <div>Lead: {meeting.lead_name}</div>}
                            {meeting.contact_name && <div>Contact: {meeting.contact_name}</div>}
                            {!meeting.lead_name && !meeting.contact_name && <span className="text-muted-foreground">—</span>}
                          </TableCell>
                        )}
                        {isColumnVisible('status') && <TableCell>{getStatusBadge(meeting)}</TableCell>}
                        {isColumnVisible('outcome') && <TableCell>{getOutcomeBadge(meeting.outcome || null)}</TableCell>}
                        {isColumnVisible('join_url') && (
                          <TableCell>
                            {meeting.join_url ? (
                              <a 
                                href={meeting.join_url} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-primary hover:underline flex items-center gap-1"
                              >
                                <Video className="h-4 w-4" />
                                {meeting.join_url.includes('teams') ? 'Join (Teams)' :
                                 meeting.join_url.includes('zoom') ? 'Join (Zoom)' :
                                 meeting.join_url.includes('meet.google') ? 'Join (Meet)' :
                                 meeting.join_url.includes('webex') ? 'Join (Webex)' :
                                 'Join Meeting'}
                              </a>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        )}
                        {isColumnVisible('organizer') && (
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <User className="h-3 w-3 text-muted-foreground" />
                              <span className="truncate max-w-[120px]">
                                {meeting.created_by ? organizerNames[meeting.created_by] || 'Loading...' : '-'}
                              </span>
                            </div>
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" onClick={() => {
                              setEditingMeeting(meeting);
                              setShowModal(true);
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => {
                              setMeetingToDelete(meeting.id);
                              setShowDeleteDialog(true);
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>)}
                </TableBody>
              </Table>
              
              {/* Pagination */}
              {filteredMeetings.length > ITEMS_PER_PAGE && (
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  itemsPerPage={ITEMS_PER_PAGE}
                  totalItems={filteredMeetings.length}
                  onPageChange={setCurrentPage}
                  entityName="meetings"
                />
              )}
            </Card>
          </div>}
      </div>

      {/* Modals */}
      <MeetingModal open={showModal} onOpenChange={setShowModal} meeting={editingMeeting} onSuccess={() => {
      fetchMeetings();
      setEditingMeeting(null);
    }} />

      <MeetingColumnCustomizer
        open={showColumnCustomizer}
        onOpenChange={setShowColumnCustomizer}
        columns={columns}
        onColumnsChange={setColumns}
      />

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this meeting? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
            if (meetingToDelete) {
              handleDelete(meetingToDelete);
              setMeetingToDelete(null);
            }
          }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={showBulkDeleteDialog} onOpenChange={setShowBulkDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedMeetings.length} Meeting(s)</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedMeetings.length} selected meeting(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
            handleBulkDelete();
            setShowBulkDeleteDialog(false);
          }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete {selectedMeetings.length} Meeting(s)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>;
};
export default Meetings;
