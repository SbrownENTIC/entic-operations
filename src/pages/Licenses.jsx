import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, AlertTriangle, Pencil } from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import LicenseForm from "../components/licenses/LicenseForm";

export default function Licenses() {
  const [showForm, setShowForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingLicense, setEditingLicense] = useState(null);
  const queryClient = useQueryClient();

  const { data: licenses = [] } = useQuery({
    queryKey: ['licenses'],
    queryFn: () => base44.entities.License.list('-expiration_date')
  });

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      // Generate internal license number
      const sameLicenseType = licenses.filter(l => l.license_type === data.license_type);
      const nextId = sameLicenseType.length + 1;
      const internalNumber = `${data.license_type}-${String(nextId).padStart(3, '0')}`;
      
      return base44.entities.License.create({
        ...data,
        internal_license_number: internalNumber
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setShowForm(false);
      setEditingLicense(null);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.License.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['licenses'] });
      setShowForm(false);
      setEditingLicense(null);
    }
  });

  // Check for licenses that need reminder emails
  useEffect(() => {
    const checkLicenseReminders = async () => {
      const today = new Date();
      
      for (const license of licenses) {
        const daysUntil = differenceInDays(parseISO(license.expiration_date), today);
        const provider = providers.find(p => p.id === license.provider_id);
        
        if (!provider) continue;

        // Send 30-day reminder
        if (daysUntil === 30 && !license.reminder_30_sent) {
          await base44.integrations.Core.SendEmail({
            to: provider.email,
            subject: `License Expiration Reminder - 30 Days`,
            body: `Dear ${provider.full_name},\n\nThis is a reminder that your ${license.license_type} license (Internal #: ${license.internal_license_number}) will expire in 30 days on ${format(parseISO(license.expiration_date), 'MMMM d, yyyy')}.\n\nPlease take action to renew your license.\n\nBest regards,\nMedPractice Management`
          });
          await base44.entities.License.update(license.id, { reminder_30_sent: true });
        }

        // Send 14-day reminder
        if (daysUntil === 14 && !license.reminder_14_sent) {
          await base44.integrations.Core.SendEmail({
            to: provider.email,
            subject: `License Expiration Reminder - 14 Days`,
            body: `Dear ${provider.full_name},\n\nThis is a reminder that your ${license.license_type} license (Internal #: ${license.internal_license_number}) will expire in 14 days on ${format(parseISO(license.expiration_date), 'MMMM d, yyyy')}.\n\nPlease take immediate action to renew your license.\n\nBest regards,\nMedPractice Management`
          });
          await base44.entities.License.update(license.id, { reminder_14_sent: true });
        }

        // Send 7-day reminder
        if (daysUntil === 7 && !license.reminder_7_sent) {
          await base44.integrations.Core.SendEmail({
            to: provider.email,
            subject: `URGENT: License Expiration Reminder - 7 Days`,
            body: `Dear ${provider.full_name},\n\nURGENT: Your ${license.license_type} license (Internal #: ${license.internal_license_number}) will expire in 7 days on ${format(parseISO(license.expiration_date), 'MMMM d, yyyy')}.\n\nPlease renew your license immediately to avoid any disruptions.\n\nBest regards,\nMedPractice Management`
          });
          await base44.entities.License.update(license.id, { reminder_7_sent: true });
        }
      }
    };

    if (licenses.length > 0 && providers.length > 0) {
      checkLicenseReminders();
    }
  }, [licenses, providers]);

  const handleSubmit = (data) => {
    if (editingLicense) {
      updateMutation.mutate({ id: editingLicense.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const licensesWithProviders = licenses.map(license => ({
    ...license,
    provider: providers.find(p => p.id === license.provider_id),
    daysUntilExpiration: differenceInDays(parseISO(license.expiration_date), new Date())
  }));

  const filteredLicenses = licensesWithProviders.filter(license =>
    license.provider?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    license.license_type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    license.internal_license_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">License Management</h1>
            <p className="text-slate-600 mt-1">Track provider licenses and expiration dates</p>
          </div>
          <Button
            onClick={() => {
              setEditingLicense(null);
              setShowForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add License
          </Button>
        </div>

        {showForm && (
          <LicenseForm
            license={editingLicense}
            providers={providers}
            onSubmit={handleSubmit}
            onCancel={() => {
              setShowForm(false);
              setEditingLicense(null);
            }}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center gap-4">
              <Search className="w-5 h-5 text-slate-400" />
              <Input
                placeholder="Search licenses..."
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
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Provider</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">License Type</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Internal #</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">State</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Expiration</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Days Until</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-right p-4 text-sm font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLicenses.map((license) => {
                    const isExpired = license.daysUntilExpiration <= 0;
                    const isExpiringSoon = license.daysUntilExpiration > 0 && license.daysUntilExpiration <= 30;

                    return (
                      <tr key={license.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="p-4">
                          <p className="font-medium text-slate-900">{license.provider?.full_name}</p>
                        </td>
                        <td className="p-4">
                          <Badge variant="outline" className="font-mono">
                            {license.license_type}
                          </Badge>
                        </td>
                        <td className="p-4 text-slate-600 font-mono text-sm">{license.internal_license_number}</td>
                        <td className="p-4 text-slate-600">{license.issuing_state || '-'}</td>
                        <td className="p-4 text-slate-600">
                          {format(parseISO(license.expiration_date), 'MMM d, yyyy')}
                        </td>
                        <td className="p-4">
                          {isExpired ? (
                            <span className="text-red-600 font-medium flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              Expired
                            </span>
                          ) : isExpiringSoon ? (
                            <span className="text-orange-600 font-semibold">{license.daysUntilExpiration} days</span>
                          ) : (
                            <span className="text-slate-600 font-medium">{license.daysUntilExpiration} days</span>
                          )}
                        </td>
                        <td className="p-4">
                          <Badge 
                            variant={isExpired ? "destructive" : isExpiringSoon ? "outline" : "secondary"}
                            className={isExpiringSoon && !isExpired ? "border-orange-300 text-orange-700" : ""}
                          >
                            {isExpired ? 'Expired' : isExpiringSoon ? 'Expiring Soon' : 'Active'}
                          </Badge>
                        </td>
                        <td className="p-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => {
                              setEditingLicense(license);
                              setShowForm(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {filteredLicenses.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No licenses found
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}