import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle, AlertCircle, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import SupplyRequestForm from "../components/supplies/SupplyRequestForm";
import { format, parseISO } from "date-fns";

export default function SupplyRequest() {
  const [showForm, setShowForm] = useState(false);
  const [user, setUser] = useState(null);
  const [submitMessage, setSubmitMessage] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const { data: myRequests = [] } = useQuery({
    queryKey: ['mySupplyRequests', user?.email],
    queryFn: async () => {
      if (!user?.email) return [];
      const allOrders = await base44.entities.SupplyOrder.filter({ 
        created_by: user.email
      });
      // Filter to only show pending/active requests (not ordered or received)
      return allOrders.filter(order => 
        ['pending_review', 'pending_fulfillment', 'approved', 'rejected'].includes(order.status)
      );
    },
    enabled: !!user?.email
  });

  const submitRequestMutation = useMutation({
    mutationFn: async (requestData) => {
      const response = await base44.functions.invoke('processSupplyRequest', requestData);
      return response.data;
    },
    onSuccess: (data) => {
      setShowForm(false);
      setSubmitMessage(data.message || 'Request submitted successfully!');
      setTimeout(() => setSubmitMessage(''), 5000);
    },
    onError: (error) => {
      setSubmitMessage('Error: ' + (error.response?.data?.error || error.message));
      setTimeout(() => setSubmitMessage(''), 5000);
    }
  });

  const handleSubmit = (formData) => {
    submitRequestMutation.mutate(formData);
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      pending_review: { label: 'Pending Review', className: 'bg-yellow-100 text-yellow-800', icon: Clock },
      pending_fulfillment: { label: 'Approved', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      approved: { label: 'Approved', className: 'bg-green-100 text-green-800', icon: CheckCircle },
      rejected: { label: 'Rejected', className: 'bg-red-100 text-red-800', icon: AlertCircle }
    };
    
    const config = statusConfig[status] || { label: status, className: 'bg-gray-100 text-gray-800', icon: Clock };
    const Icon = config.icon;
    
    return (
      <Badge className={config.className}>
        <Icon className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  return (
    <div className="p-6 md:p-8 bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Supply Request</h1>
            <p className="text-slate-600 mt-1">Request supplies for your location</p>
          </div>
          <Button
            onClick={() => setShowForm(true)}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Request
          </Button>
        </div>

        {submitMessage && (
          <Card className={`border ${submitMessage.includes('Error') ? 'border-red-200 bg-red-50' : 'border-green-200 bg-green-50'}`}>
            <CardContent className="p-4">
              <p className={`text-sm ${submitMessage.includes('Error') ? 'text-red-900' : 'text-green-900'}`}>
                {submitMessage}
              </p>
            </CardContent>
          </Card>
        )}

        {showForm && (
          <SupplyRequestForm
            onSubmit={handleSubmit}
            onCancel={() => setShowForm(false)}
            isLoading={submitRequestMutation.isPending}
            userLocation={user?.location}
          />
        )}

        <Card className="border-slate-200 shadow-sm bg-white/80 backdrop-blur-sm">
          <CardHeader className="border-b border-slate-100">
            <CardTitle>My Requests</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Request Date</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Location</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Items</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Total</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Status</th>
                    <th className="text-left p-4 text-sm font-semibold text-slate-700">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {myRequests.map((request) => (
                    <tr key={request.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                      <td className="p-4 text-slate-600">
                        {request.order_date ? format(parseISO(request.order_date), 'MM/dd/yyyy') : '-'}
                      </td>
                      <td className="p-4 text-slate-900 font-medium">{request.location}</td>
                      <td className="p-4 text-slate-600">{request.items?.length || 0} items</td>
                      <td className="p-4 text-slate-900 font-medium">
                        ${(request.total_amount || 0).toFixed(2)}
                      </td>
                      <td className="p-4">
                        {getStatusBadge(request.status)}
                      </td>
                      <td className="p-4 text-slate-600 text-sm">
                        {request.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {myRequests.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  No requests yet. Click "New Request" to submit your first supply request.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}