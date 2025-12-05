import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { useLocation } from "react-router-dom";
import ProgramLocationForm from "../components/programlocations/ProgramLocationForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function ProgramLocations() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingLocation, setEditingLocation] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sortField, setSortField] = useState('program_group');
  const [sortDirection, setSortDirection] = useState('asc');
  const queryClient = useQueryClient();
  const location = useLocation();

  const { data: programLocations = [], isLoading } = useQuery({
    queryKey: ['program-locations'],
    queryFn: () => base44.entities.ProgramLocation.list('program_location')
  });

  // Close form when navigating to root URL
  React.useEffect(() => {
    if (location.search === '' && showForm) {
      setShowForm(false);
      setEditingLocation(null);
    }
  }, [location.search]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ProgramLocation.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-locations'] });
      setShowForm(false);
      setEditingLocation(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProgramLocation.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-locations'] });
      setShowForm(false);
      setEditingLocation(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ProgramLocation.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['program-locations'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingLocation) {
      updateMutation.mutate({ id: editingLocation.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const filteredLocations = programLocations.filter(location =>
    location.program_location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    location.program_group?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedLocations = [...filteredLocations].sort((a, b) => {
    let aValue, bValue;
    
    if (sortField === 'daily_rate') {
      aValue = a.daily_rate || 0;
      bValue = b.daily_rate || 0;
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    }
    
    aValue = a[sortField] || '';
    bValue = b[sortField] || '';
    
    const comparison = aValue.toString().toLowerCase().localeCompare(bValue.toString().toLowerCase());
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Group by program_group
  const groupedLocations = sortedLocations.reduce((acc, location) => {
    const group = location.program_group || 'Uncategorized';
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(location);
    return acc;
  }, {});

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 ml-1 inline" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4 ml-1 inline" /> : 
      <ArrowDown className="w-4 h-4 ml-1 inline" />;
  };

  const programTypeColors = {
    'On-Call': 'bg-blue-100 text-blue-800',
    'Directorship': 'bg-purple-100 text-purple-800',
    'Other': 'bg-slate-100 text-slate-800'
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Program Locations</h1>
            <p className="text-slate-600 mt-1">Manage programs, locations, and rates</p>
          </div>
          <Button
            onClick={() => {
              setEditingLocation(null);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Location
          </Button>
        </div>

        {showForm && (
          <ProgramLocationForm
            location={editingLocation}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingLocation(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search locations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md border-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[calc(100vh-300px)]">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                  <tr>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('program_group')}
                    >
                      Program Group <SortIcon field="program_group" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('program_location')}
                    >
                      Program/Location <SortIcon field="program_location" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('program_type')}
                    >
                      Type <SortIcon field="program_type" />
                    </th>
                    <th 
                      className="text-left p-4 text-sm font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 bg-slate-50"
                      onClick={() => handleSort('daily_rate')}
                    >
                      Daily Rate <SortIcon field="daily_rate" />
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700 bg-slate-50">
                      Invoice Counter
                    </th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700 bg-slate-50">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(groupedLocations).map(([groupName, locations]) => (
                    <React.Fragment key={groupName}>
                      <tr className="bg-slate-100">
                        <td colSpan="6" className="px-4 py-2">
                          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                            {groupName}
                            <Badge variant="outline" className="font-normal">
                              {locations.length} {locations.length === 1 ? 'location' : 'locations'}
                            </Badge>
                          </h3>
                        </td>
                      </tr>
                      {locations.map((location) => (
                        <tr key={location.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-slate-600">
                            {location.program_group}
                          </td>
                          <td className="p-4">
                            <p className="font-medium text-slate-900">{location.program_location}</p>
                          </td>
                          <td className="p-4">
                            <Badge className={programTypeColors[location.program_type] || 'bg-slate-100 text-slate-800'}>
                              {location.program_type}
                            </Badge>
                          </td>
                          <td className="p-4 text-slate-900 font-medium">
                            {location.daily_rate > 0 ? `$${location.daily_rate.toFixed(2)}` : '-'}
                          </td>
                          <td className="p-4 text-slate-600">
                            {location.invoice_counter || 0}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex gap-2 justify-end">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => {
                                  setEditingLocation(location);
                                  setShowForm(true);
                                }}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setDeleteConfirm(location)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
              {sortedLocations.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No program locations found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Program Location</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {deleteConfirm?.program_location}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(deleteConfirm.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}