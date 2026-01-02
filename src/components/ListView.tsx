import { useState, useEffect, useMemo, useRef } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Deal, DealStage, DEAL_STAGES, STAGE_COLORS } from "@/types/deal";
import { Search, Filter, X, ArrowUp, ArrowDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RowActionsDropdown, Edit, Trash2, CheckSquare } from "./RowActionsDropdown";
import { format } from "date-fns";
import { InlineEditCell } from "./InlineEditCell";
import { DealColumnCustomizer, DealColumnConfig, defaultDealColumns } from "./DealColumnCustomizer";
import { BulkActionsBar } from "./BulkActionsBar";
import { DealsAdvancedFilter, AdvancedFilterState } from "./DealsAdvancedFilter";
import { TaskModal } from "./tasks/TaskModal";
import { useTasks } from "@/hooks/useTasks";
import { DealActionsDropdown } from "./DealActionsDropdown";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useColumnPreferences } from "@/hooks/useColumnPreferences";
import { DeleteConfirmDialog } from "./shared/DeleteConfirmDialog";

interface ListViewProps {
  deals: Deal[];
  onDealClick: (deal: Deal) => void;
  onUpdateDeal: (dealId: string, updates: Partial<Deal>) => void;
  onDeleteDeals: (dealIds: string[]) => void;
  onImportDeals: (deals: Partial<Deal>[]) => void;
  initialStageFilter?: string;
}

export const ListView = ({ 
  deals, 
  onDealClick, 
  onUpdateDeal, 
  onDeleteDeals, 
  onImportDeals,
  initialStageFilter = 'all'
}: ListViewProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [leadOwnerFilter, setLeadOwnerFilter] = useState("all");
  const [filters, setFilters] = useState<AdvancedFilterState>(() => ({
    stages: initialStageFilter !== 'all' ? [initialStageFilter as DealStage] : [],
    regions: [],
    leadOwners: [],
    priorities: [],
    probabilities: [],
    handoffStatuses: [],
    searchTerm: "",
    probabilityRange: [0, 100],
  }));
  const [sortBy, setSortBy] = useState<string>("modified_at");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedDeals, setSelectedDeals] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);

  // Sync stage filter when initialStageFilter prop changes (from URL)
  useEffect(() => {
    if (initialStageFilter !== 'all') {
      setFilters(prev => ({ ...prev, stages: [initialStageFilter as DealStage] }));
    }
  }, [initialStageFilter]);
  
  // Task Modal state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [taskDealId, setTaskDealId] = useState<string | null>(null);
  const { createTask } = useTasks();

  // Delete confirmation state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [dealToDelete, setDealToDelete] = useState<Deal | null>(null);

  // Column customizer state
  const [columnCustomizerOpen, setColumnCustomizerOpen] = useState(false);

  // Fetch all profiles for lead owner dropdown
  const { data: allProfiles = [] } = useQuery({
    queryKey: ['all-profiles'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('id, full_name');
      return data || [];
    },
  });

  const [columns, setColumns] = useState<DealColumnConfig[]>([
    { field: 'project_name', label: 'Project', visible: true, order: 0 },
    { field: 'customer_name', label: 'Customer', visible: true, order: 1 },
    { field: 'lead_name', label: 'Lead Name', visible: true, order: 2 },
    { field: 'stage', label: 'Stage', visible: true, order: 3 },
    { field: 'priority', label: 'Priority', visible: true, order: 4 },
    { field: 'total_contract_value', label: 'Value', visible: true, order: 5 },
    { field: 'probability', label: 'Probability', visible: true, order: 6 },
    { field: 'expected_closing_date', label: 'Expected Close', visible: true, order: 7 },
    { field: 'region', label: 'Region', visible: false, order: 8 },
    { field: 'project_duration', label: 'Duration', visible: false, order: 9 },
    { field: 'start_date', label: 'Start Date', visible: false, order: 10 },
    { field: 'end_date', label: 'End Date', visible: false, order: 11 },
    { field: 'proposal_due_date', label: 'Proposal Due', visible: false, order: 12 },
    { field: 'total_revenue', label: 'Total Revenue', visible: false, order: 13 },
    { field: 'lead_owner', label: 'Lead Owner', visible: true, order: 14 },
  ]);

  // Column width state
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({
    'project_name': 200,
    'customer_name': 150,
    'lead_name': 150,
    'lead_owner': 140,
    'stage': 120,
    'priority': 100,
    'total_contract_value': 120,
    'probability': 120,
    'expected_closing_date': 140,
    'region': 120,
    'project_duration': 120,
    'start_date': 120,
    'end_date': 120,
    'proposal_due_date': 140,
    'total_revenue': 120,
  });

  // Resize state
  const [isResizing, setIsResizing] = useState<string | null>(null);
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);
  const tableRef = useRef<HTMLTableElement>(null);

  const { toast } = useToast();

  const formatCurrency = (amount: number | undefined, currency: string = 'EUR') => {
    if (!amount) return '-';
    const symbols = { USD: '$', EUR: '€', INR: '₹' };
    return `${symbols[currency as keyof typeof symbols] || '€'}${amount.toLocaleString()}`;
  };

  const formatDate = (date: string | undefined) => {
    if (!date) return '-';
    try {
      return format(new Date(date), 'dd/MM/yyyy');
    } catch {
      return '-';
    }
  };

  // Handle column resize
  const handleMouseDown = (e: React.MouseEvent, field: string) => {
    setIsResizing(field);
    setStartX(e.clientX);
    setStartWidth(columnWidths[field] || 120);
    e.preventDefault();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - startX;
    const newWidth = Math.max(80, startWidth + deltaX); // Minimum width of 80px
    
    setColumnWidths(prev => ({
      ...prev,
      [isResizing]: newWidth
    }));
  };

  const handleMouseUp = () => {
    if (isResizing) {
      // Save to localStorage
      localStorage.setItem('deals-column-widths', JSON.stringify(columnWidths));
      setIsResizing(null);
    }
  };

  // Mouse event listeners
  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, startX, startWidth, columnWidths]);

  // Load column widths from localStorage
  useEffect(() => {
    const savedWidths = localStorage.getItem('deals-column-widths');
    if (savedWidths) {
      try {
        const parsed = JSON.parse(savedWidths);
        setColumnWidths(parsed);
      } catch (e) {
        console.error('Failed to parse saved column widths:', e);
      }
    }
  }, []);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDeals(new Set(filteredAndSortedDeals.map(deal => deal.id)));
    } else {
      setSelectedDeals(new Set());
    }
  };

  const handleSelectDeal = (dealId: string, checked: boolean) => {
    const newSelected = new Set(selectedDeals);
    if (checked) {
      newSelected.add(dealId);
    } else {
      newSelected.delete(dealId);
    }
    setSelectedDeals(newSelected);
  };

  const handleBulkDelete = () => {
    if (selectedDeals.size === 0) return;
    
    onDeleteDeals(Array.from(selectedDeals));
    setSelectedDeals(new Set());
    
    toast({
      title: "Deals deleted",
      description: `Successfully deleted ${selectedDeals.size} deals`,
    });
  };

  const handleBulkExport = () => {
    const selectedDealObjects = deals.filter(deal => selectedDeals.has(deal.id));
    // Export logic handled by DealActionsDropdown
  };

  const handleInlineEdit = async (dealId: string, field: string, value: any) => {
    try {
      await onUpdateDeal(dealId, { [field]: value });
      toast({
        title: "Deal updated",
        description: "Field updated successfully",
      });
    } catch (error) {
      toast({
        title: "Update failed",
        description: "Failed to update deal field",
        variant: "destructive",
      });
    }
  };

  const getFieldType = (field: string): 'text' | 'number' | 'date' | 'select' | 'textarea' | 'boolean' | 'stage' | 'priority' | 'currency' | 'userSelect' => {
    if (field === 'stage') return 'stage';
    if (field === 'priority') return 'priority';
    if (field === 'lead_owner') return 'userSelect';
    if (['total_contract_value', 'total_revenue'].includes(field)) return 'currency';
    if (['expected_closing_date', 'start_date', 'end_date', 'proposal_due_date'].includes(field)) return 'date';
    if (['probability', 'project_duration'].includes(field)) return 'number';
    return 'text';
  };

  const getFieldOptions = (field: string): string[] => {
    return [];
  };

  const visibleColumns = columns
    .filter(col => col.visible)
    .sort((a, b) => a.order - b.order);

  // Generate available options for multi-select filters
  const availableOptions = useMemo(() => {
    const regions = Array.from(new Set(deals.map(d => d.region).filter(Boolean)));
    const leadOwners = Array.from(new Set(deals.map(d => d.lead_owner).filter(Boolean)));
    const priorities = Array.from(new Set(deals.map(d => String(d.priority)).filter(p => p !== 'undefined')));
    const probabilities = Array.from(new Set(deals.map(d => String(d.probability)).filter(p => p !== 'undefined')));
    const handoffStatuses = Array.from(new Set(deals.map(d => d.handoff_status).filter(Boolean)));
    
    return {
      regions,
      leadOwners,
      priorities,
      probabilities,
      handoffStatuses,
    };
  }, [deals]);

  useEffect(() => {
    const savedFilters = localStorage.getItem('deals-filters');
    if (savedFilters) {
      try {
        const parsed = JSON.parse(savedFilters);
        setFilters(parsed);
        setSearchTerm(parsed.searchTerm || "");
      } catch (e) {
        console.error('Failed to parse saved filters:', e);
      }
    }
  }, []);

  useEffect(() => {
    const filtersWithSearch = { ...filters, searchTerm };
    localStorage.setItem('deals-filters', JSON.stringify(filtersWithSearch));
  }, [filters, searchTerm]);

  const filteredAndSortedDeals = deals
    .filter(deal => {
      // Combine search from both searchTerm and filters.searchTerm
      const allSearchTerms = [searchTerm, filters.searchTerm].filter(Boolean).join(' ').toLowerCase();
      const matchesSearch = !allSearchTerms || 
        deal.deal_name?.toLowerCase().includes(allSearchTerms) ||
        deal.project_name?.toLowerCase().includes(allSearchTerms) ||
        deal.lead_name?.toLowerCase().includes(allSearchTerms) ||
        deal.customer_name?.toLowerCase().includes(allSearchTerms) ||
        deal.region?.toLowerCase().includes(allSearchTerms);
      
      // Apply lead owner filter (standalone dropdown)
      const matchesLeadOwnerDropdown = leadOwnerFilter === "all" || deal.lead_owner === leadOwnerFilter;
      
      // Apply multi-select filters
      const matchesStages = filters.stages.length === 0 || filters.stages.includes(deal.stage);
      const matchesRegions = filters.regions.length === 0 || filters.regions.includes(deal.region || '');
      const matchesLeadOwners = filters.leadOwners.length === 0 || filters.leadOwners.includes(deal.lead_owner || '');
      const matchesPriorities = filters.priorities.length === 0 || filters.priorities.includes(String(deal.priority || ''));
      const matchesProbabilities = filters.probabilities.length === 0 || filters.probabilities.includes(String(deal.probability || ''));
      const matchesHandoffStatuses = filters.handoffStatuses.length === 0 || filters.handoffStatuses.includes(deal.handoff_status || '');
      
      // Probability range filter
      const dealProbability = deal.probability || 0;
      const matchesProbabilityRange = dealProbability >= filters.probabilityRange[0] && dealProbability <= filters.probabilityRange[1];
      
      return matchesSearch && matchesLeadOwnerDropdown && matchesStages && matchesRegions && matchesLeadOwners && 
             matchesPriorities && matchesProbabilities && matchesHandoffStatuses && matchesProbabilityRange;
    })
    .sort((a, b) => {
      let aValue: any;
      let bValue: any;

      // Get the values for the sort field
      if (['priority', 'probability', 'project_duration'].includes(sortBy)) {
        aValue = a[sortBy as keyof Deal] || 0;
        bValue = b[sortBy as keyof Deal] || 0;
      } else if (['total_contract_value', 'total_revenue'].includes(sortBy)) {
        aValue = a[sortBy as keyof Deal] || 0;
        bValue = b[sortBy as keyof Deal] || 0;
      } else if (['expected_closing_date', 'start_date', 'end_date', 'created_at', 'modified_at', 'proposal_due_date'].includes(sortBy)) {
        const aDateValue = a[sortBy as keyof Deal];
        const bDateValue = b[sortBy as keyof Deal];
        aValue = new Date(typeof aDateValue === 'string' ? aDateValue : 0);
        bValue = new Date(typeof bDateValue === 'string' ? bDateValue : 0);
      } else {
        // String fields
        aValue = String(a[sortBy as keyof Deal] || '').toLowerCase();
        bValue = String(b[sortBy as keyof Deal] || '').toLowerCase();
      }

      if (sortOrder === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedDeals.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedDeals = filteredAndSortedDeals.slice(startIndex, startIndex + itemsPerPage);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, searchTerm, leadOwnerFilter]);

  const getActiveFiltersCount = () => {
    let count = 0;
    if (filters.stages.length > 0) count++;
    if (filters.regions.length > 0) count++;
    if (filters.leadOwners.length > 0) count++;
    if (filters.priorities.length > 0) count++;
    if (filters.probabilities.length > 0) count++;
    if (filters.handoffStatuses.length > 0) count++;
    if (filters.searchTerm) count++;
    if (filters.probabilityRange[0] > 0 || filters.probabilityRange[1] < 100) count++;
    return count;
  };

  const clearAllFilters = () => {
    setFilters({
      stages: [],
      regions: [],
      leadOwners: [],
      priorities: [],
      probabilities: [],
      handoffStatuses: [],
      searchTerm: "",
      probabilityRange: [0, 100],
    });
    setSearchTerm("");
  };

  const activeFiltersCount = getActiveFiltersCount();
  const hasActiveFilters = activeFiltersCount > 0 || searchTerm;

  // Get selected deal objects for export
  const selectedDealObjects = deals.filter(deal => selectedDeals.has(deal.id));

  const handleCreateTask = (deal: Deal) => {
    setTaskDealId(deal.id);
    setTaskModalOpen(true);
  };

  return (
    <div className="h-full flex flex-col bg-background space-y-3">
      <div className="flex-shrink-0 px-4 py-2 bg-background border-b border-border">
        <div className="flex flex-col lg:flex-row gap-2 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 flex-1 min-w-0">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none" />
              <Input
                placeholder="Search deals..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
                inputSize="control"
              />
            </div>
            
            <Select value={leadOwnerFilter} onValueChange={setLeadOwnerFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="All Lead Owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Lead Owners</SelectItem>
                {availableOptions.leadOwners.map((owner) => (
                  <SelectItem key={owner} value={owner}>
                    {owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <DealsAdvancedFilter 
              filters={filters} 
              onFiltersChange={setFilters}
              availableRegions={availableOptions.regions}
              availableLeadOwners={availableOptions.leadOwners}
              availablePriorities={availableOptions.priorities}
              availableProbabilities={availableOptions.probabilities}
              availableHandoffStatuses={availableOptions.handoffStatuses}
            />

            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={clearAllFilters}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground h-8 px-3 text-sm"
              >
                <X className="w-4 h-4" />
                Clear All
              </Button>
            )}

            <div className="flex items-center gap-2 flex-shrink-0">
              <DealActionsDropdown
                deals={deals}
                onImport={onImportDeals}
                onRefresh={() => {}}
                selectedDeals={selectedDealObjects}
                onColumnCustomize={() => setColumnCustomizerOpen(true)}
                showColumns={true}
              />
            </div>
          </div>
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col">
        <div className="relative overflow-auto flex-1">
        <Table ref={tableRef} className="w-full">
          <TableHeader>
            <TableRow className="sticky top-0 z-20 bg-muted border-b-2">
              <TableHead className="w-12 min-w-12 text-center font-bold text-foreground">
                <Checkbox
                  checked={selectedDeals.size === paginatedDeals.length && paginatedDeals.length > 0}
                  onCheckedChange={handleSelectAll}
                  className="transition-all hover:scale-110"
                />
              </TableHead>
              {visibleColumns.map(column => (
                <TableHead 
                  key={column.field} 
                  className="font-bold text-foreground px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors relative whitespace-nowrap"
                  style={{ 
                    width: `${columnWidths[column.field] || 120}px`,
                    minWidth: `${columnWidths[column.field] || 120}px`,
                    maxWidth: `${columnWidths[column.field] || 120}px`
                  }}
                  onClick={() => {
                    if (sortBy === column.field) {
                      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                    } else {
                      setSortBy(column.field);
                      setSortOrder("desc");
                    }
                  }}
                >
                  <div className="flex items-center gap-2 pr-4 text-foreground font-bold">
                    {column.label}
                    {sortBy === column.field && (
                      sortOrder === "asc" ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />
                    )}
                  </div>
                  <div
                    className="absolute right-0 top-0 w-1 h-full cursor-col-resize hover:bg-primary/40 bg-transparent"
                    onMouseDown={(e) => handleMouseDown(e, column.field)}
                    style={{
                      background: isResizing === column.field ? 'hsl(var(--primary) / 0.5)' : undefined
                    }}
                  />
                </TableHead>
              ))}
              <TableHead className="w-32 text-center font-bold text-foreground px-4 py-3">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedDeals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 2} className="text-center py-8 text-muted-foreground">
                  No deals found
                </TableCell>
              </TableRow>
            ) : (
              paginatedDeals.map((deal) => (
                <TableRow 
                  key={deal.id} 
                  className={`hover:bg-muted/20 border-b group ${selectedDeals.has(deal.id) ? 'bg-muted/30' : ''}`}
                  data-state={selectedDeals.has(deal.id) ? "selected" : undefined}
                >
                  <TableCell onClick={(e) => e.stopPropagation()} className="text-center px-4 py-3">
                    <div className="flex justify-center">
                      <Checkbox
                        checked={selectedDeals.has(deal.id)}
                        onCheckedChange={(checked) => handleSelectDeal(deal.id, Boolean(checked))}
                      />
                    </div>
                  </TableCell>
                  {visibleColumns.map(column => (
                    <TableCell 
                      key={column.field} 
                      className="text-left px-4 py-3 align-middle whitespace-nowrap overflow-hidden text-ellipsis max-w-[200px]"
                      style={{ 
                        width: `${columnWidths[column.field] || 120}px`,
                        minWidth: `${columnWidths[column.field] || 120}px`,
                        maxWidth: `${columnWidths[column.field] || 120}px`
                      }}
                    >
                      <InlineEditCell
                        value={deal[column.field as keyof Deal]}
                        field={column.field}
                        dealId={deal.id}
                        onSave={handleInlineEdit}
                        type={getFieldType(column.field)}
                        options={getFieldOptions(column.field)}
                        userOptions={column.field === 'lead_owner' ? allProfiles : undefined}
                      />
                    </TableCell>
                  ))}
                  <TableCell className="w-20 px-4 py-3">
                    <div className="flex items-center justify-center">
                      <RowActionsDropdown
                        actions={[
                          {
                            label: "Create Task",
                            icon: <CheckSquare className="w-4 h-4" />,
                            onClick: () => handleCreateTask(deal)
                          },
                          {
                            label: "Edit",
                            icon: <Edit className="w-4 h-4" />,
                            onClick: () => onDealClick(deal)
                          },
                          {
                            label: "Delete",
                            icon: <Trash2 className="w-4 h-4" />,
                            onClick: () => {
                              setDealToDelete(deal);
                              setDeleteDialogOpen(true);
                            },
                            destructive: true,
                            separator: true
                          }
                        ]}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          </Table>
        </div>
      </Card>

      <div className="flex-shrink-0 bg-background">
        {selectedDeals.size > 0 && (
          <BulkActionsBar
            selectedCount={selectedDeals.size}
            onDelete={handleBulkDelete}
            onExport={handleBulkExport}
            onClearSelection={() => setSelectedDeals(new Set())}
          />
        )}

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Showing {filteredAndSortedDeals.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredAndSortedDeals.length)} of {filteredAndSortedDeals.length} deals
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
                Previous
              </Button>
              <span className="text-sm">
                Page {currentPage} of {totalPages || 1}
              </span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onSubmit={createTask}
        context={taskDealId ? { module: 'deals', recordId: taskDealId, locked: true } : undefined}
      />

      <DealColumnCustomizer
        open={columnCustomizerOpen}
        onOpenChange={setColumnCustomizerOpen}
        columns={columns}
        onColumnsChange={setColumns}
      />

      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => {
          if (dealToDelete) {
            onDeleteDeals([dealToDelete.id]);
            toast({
              title: "Deal deleted",
              description: `Successfully deleted ${dealToDelete.project_name || 'deal'}`,
            });
            setDealToDelete(null);
          }
        }}
        title="Delete Deal"
        itemName={dealToDelete?.project_name || 'this deal'}
        itemType="deal"
      />
    </div>
  );
};
