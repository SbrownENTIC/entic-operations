import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, FileText, Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import OutsideIncomeForm from "../components/income/OutsideIncomeForm";
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

export default function OutsideIncome() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingIncome, setEditingIncome] = useState(null);
  const [selectedIncomes, setSelectedIncomes] = useState([]);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: incomes = [] } = useQuery({
    queryKey: ['outside-income'],
    queryFn: () => base44.entities.OutsideIncome.list('-created_date')
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.OutsideIncome.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setShowForm(false);
      setEditingIncome(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.OutsideIncome.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setShowForm(false);
      setEditingIncome(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.OutsideIncome.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outside-income'] });
      setDeleteConfirm(null);
    }
  });

  const handleSubmit = (data) => {
    if (editingIncome) {
      updateMutation.mutate({ id: editingIncome.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleCreateInvoice = () => {
    if (selectedIncomes.length === 0) return;
    navigate(createPageUrl(`Invoices?create=true&incomes=${selectedIncomes.join(',')}`));
  };

  const toggleSelection = (id) => {
    setSelectedIncomes(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const incomesWithProviders = incomes.map(income => ({
    ...income,
    provider: providers.find(p => p.id === income.provider_id)
  }));

  const filteredIncomes = incomesWithProviders.filter(income =>
    income.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    income.facility_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusColors = {
    pending: "bg-yellow-100 text-yellow-800",
    invoiced: "bg-blue-100 text-blue-800",
    paid: "bg-green-100 text-green-800"
  };

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Outside Income</h1>
            <p className="text-slate-600 mt-1">Track provider work at external facilities</p>
          </div>
          <div className="flex gap-3">
            {selectedIncomes.length > 0 && (
              <Button
                onClick={handleCreateInvoice}
                variant="outline"
                className="bg-green-50 hover:bg-green-100 text-green-700 border-green-300"
              >
                <FileText className="w-4 h-4 mr-2" />
                Create Invoice ({selectedIncomes.length})
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingIncome(null);
                setShowForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Income
            </Button>
          </div>
        </div>

        {showForm && (
          <OutsideIncomeForm
            income={editingIncome}
            providers={providers}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingIncome(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search income records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-md border-slate-200"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="p-4 w-12">
                      <input
                        type="checkbox"
                        checked={selectedIncomes.length === filteredIncomes.filter(i => i.status === 'pending').length && filteredIncomes.some(i => i.status === 'pending')}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedIncomes(filteredIncomes.filter(i => i.status === 'pending').map(i => i.id));
                          } else {
                            setSelectedIncomes([]);
                          }
                        }}
                        className="w-4 h-4"
                      />
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Provider</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Facility</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Work Dates</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Days</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Amount</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredIncomes.map((income) => (
                    <tr key={income.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4">
                        {income.status === 'pending' && (
                          <input
                            type="checkbox"
                            checked={selectedIncomes.includes(income.id)}
                            onChange={() => toggleSelection(income.id)}
                            className="w-4 h-4"
                          />
                        )}
                      </td>
                      <td className="p-4">
                        <p className="font-medium text-slate-900">{income.provider?.full_name}</p>
                      </td>
                      <td className="p-4 text-slate-600">{income.facility_name}</td>
                      <td className="p-4 text-slate-600">
                        {income.work_dates && income.work_dates.length > 0 ? (
                          <div className="text-sm">
                            {income.work_dates.slice(0, 2).map((date, idx) => (
                              <div key={idx}>{format(parseISO(date), 'MMM d, yyyy')}</div>
                            ))}
                            {income.work_dates.length > 2 && (
                              <div className="text-slate-500">+{income.work_dates.length - 2} more</div>
                            )}
                          </div>
                        ) : '-'}
                      </td>
                      <td className="p-4 text-slate-600">{income.days_worked || 0}</td>
                      <td className="p-4 font-medium text-slate-900">
                        ${income.total_amount?.toFixed(2)}
                      </td>
                      <td className="p-4">
                        <Badge className={statusColors[income.status]}>
                          {income.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex gap-2 justify-end">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingIncome(income);
                              setShowForm(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setDeleteConfirm(income)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredIncomes.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No income records found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Outside Income</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this income record for {deleteConfirm?.provider?.full_name} at {deleteConfirm?.facility_name}? This action cannot be undone.
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