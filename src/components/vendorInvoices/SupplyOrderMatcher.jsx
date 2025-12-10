import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, Link as LinkIcon, AlertCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";

export default function SupplyOrderMatcher({ invoice, onLink }) {
    const [searchTerm, setSearchTerm] = useState("");
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState([]);

    // Fetch suggestions automatically
    const { data: suggestions = [], isLoading: isLoadingSuggestions } = useQuery({
        queryKey: ['suggested-matches', invoice?.id],
        queryFn: async () => {
            if (!invoice) return [];
            const res = await base44.functions.invoke('suggestSupplyOrderMatches', {
                vendor_name: invoice.vendor_name,
                total_amount: invoice.total_amount,
                invoice_date: invoice.invoice_date
            });
            return res.data.suggestions || [];
        },
        enabled: !!invoice
    });

    const handleSearch = async () => {
        setIsSearching(true);
        try {
            // Simple search implementation: fetch list and filter client side for now 
            // since we don't have a dedicated search endpoint for arbitrary text on entities yet
            // Ideally we'd use a backend function for this too if data grows large.
            const allOrders = await base44.entities.SupplyOrder.list('-order_date', 50);
            const lowerTerm = searchTerm.toLowerCase();
            
            const filtered = allOrders.filter(order => 
                (order.order_number?.toLowerCase().includes(lowerTerm) ||
                order.vendor?.toLowerCase().includes(lowerTerm)) &&
                order.category === 'clinical' // Restrict to clinical as requested
            );
            setSearchResults(filtered);
        } catch (err) {
            console.error(err);
        } finally {
            setIsSearching(false);
        }
    };

    const OrderCard = ({ order, isSuggestion }) => (
        <Card className="mb-2 border-slate-200">
            <CardContent className="p-3 flex justify-between items-center">
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-slate-900">{order.order_number}</span>
                        {isSuggestion && (
                            <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-700">
                                {order.match_reason || "Suggestion"}
                            </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                            {format(parseISO(order.order_date), 'MMM d, yyyy')}
                        </Badge>
                    </div>
                    <div className="text-xs text-slate-500 mt-1 flex gap-3">
                        <span>{order.vendor}</span>
                        <span className="font-medium text-slate-700">${order.total_amount?.toFixed(2)}</span>
                        <span>{order.items?.length || 0} items</span>
                    </div>
                </div>
                <Button 
                    size="sm" 
                    variant="outline" 
                    className="ml-3 text-blue-600 hover:text-blue-700 border-blue-200 hover:bg-blue-50"
                    onClick={() => onLink(order)}
                >
                    <LinkIcon className="w-3 h-3 mr-1" />
                    Link
                </Button>
            </CardContent>
        </Card>
    );

    return (
        <div className="space-y-4">
            {/* Suggestions Section */}
            <div>
                <h4 className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Suggested Matches
                </h4>
                {isLoadingSuggestions ? (
                    <div className="text-xs text-slate-400 flex items-center">
                        <Loader2 className="w-3 h-3 mr-1 animate-spin" /> Finding matches...
                    </div>
                ) : suggestions.length > 0 ? (
                    <div className="max-h-[200px] overflow-y-auto pr-1">
                        {suggestions.map(order => (
                            <OrderCard key={order.id} order={order} isSuggestion={true} />
                        ))}
                    </div>
                ) : (
                    <div className="text-xs text-slate-400 italic">No automatic matches found.</div>
                )}
            </div>

            {/* Manual Search Section */}
            <div className="pt-2 border-t border-slate-100">
                <h4 className="text-sm font-medium text-slate-700 mb-2">Manual Search</h4>
                <div className="flex gap-2 mb-3">
                    <Input 
                        placeholder="Search by order # or vendor..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="h-8 text-sm"
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    />
                    <Button 
                        size="sm" 
                        variant="secondary" 
                        onClick={handleSearch}
                        disabled={isSearching || !searchTerm}
                        className="h-8"
                    >
                        {isSearching ? <Loader2 className="w-3 h-3 animate-spin" /> : <Search className="w-3 h-3" />}
                    </Button>
                </div>
                
                {searchResults.length > 0 && (
                    <div className="max-h-[200px] overflow-y-auto pr-1">
                         {searchResults.map(order => (
                            <OrderCard key={order.id} order={order} isSuggestion={false} />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}