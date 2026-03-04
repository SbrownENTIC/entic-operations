import React, { useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, CheckCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, isPast, addDays } from "date-fns";
import ExcelJS from "exceljs";

export default function ProviderCredentialingReport() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: providers = [] } = useQuery({
    queryKey: ['providers'],
    queryFn: () => base44.entities.Provider.list()
  });

  const { data: privileges = [] } = useQuery({
    queryKey: ['clinical-privileges'],
    queryFn: () => base44.entities.ClinicalPrivilege.list()
  });

  // Define known facilities from the entity schema to ensure consistent column order
  const facilities = [
    "Hartford Hospital",
    "St. Francis",
    "UConn",
    "Manchester / ECHN",
    "Bloomfield",
    "CCMC",
    "CTSC- CT Surgery Center"
  ];

  const processedData = useMemo(() => {
    // Filter active providers only for the report generally, or maybe all? 
    // Usually reports want active providers. Let's include active and pending.
    // Also filtering for MD in role as requested.
    const activeProviders = providers.filter(p => 
      p.status !== 'inactive' && 
      p.role && 
      p.role.toUpperCase().includes('MD')
    );

    return activeProviders.map(provider => {
      const providerPrivileges = privileges.filter(p => p.provider_id === provider.id);
      
      const facilityStatus = {};
      facilities.forEach(facility => {
        const priv = providerPrivileges.find(p => p.facility_name === facility);
        facilityStatus[facility] = priv;
      });

      return {
        ...provider,
        facilityStatus
      };
    }).sort((a, b) => a.full_name.localeCompare(b.full_name));
  }, [providers, privileges]);

  const filteredData = useMemo(() => {
    return processedData.filter(provider => {
      const matchesSearch = provider.full_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      if (filterStatus === "all") return matchesSearch;

      // Check if provider has ANY facility with the filtered status
      const hasStatus = Object.values(provider.facilityStatus).some(priv => {
        if (!priv) return filterStatus === "missing";
        if (filterStatus === "expired") return priv.status === 'expired' || (priv.expiration_date && isPast(parseISO(priv.expiration_date)));
        if (filterStatus === "expiring_soon") {
             if (!priv.expiration_date) return false;
             const expDate = parseISO(priv.expiration_date);
             const today = new Date();
             const ninetyDays = addDays(today, 90);
             return expDate > today && expDate <= ninetyDays;
        }
        return priv.status === filterStatus;
      });

      return matchesSearch && hasStatus;
    });
  }, [processedData, searchTerm, filterStatus]);

  const getStatusBadge = (priv) => {
    if (!priv) {
      return <span className="text-slate-300">-</span>;
    }

    const isExpired = priv.status === 'expired' || (priv.expiration_date && isPast(parseISO(priv.expiration_date)));
    
    if (isExpired) {
      return (
        <div className="flex flex-col items-center">
             <Badge variant="destructive" className="mb-1">Expired</Badge>
             <span className="text-[10px] text-red-600 font-medium">
                {priv.expiration_date ? format(parseISO(priv.expiration_date), 'MM/dd/yy') : 'No Date'}
             </span>
        </div>
      );
    }

    if (priv.status === 'pending') {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">Pending</Badge>;
    }

    // Check for expiring soon (within 90 days)
    if (priv.expiration_date) {
        const expDate = parseISO(priv.expiration_date);
        const today = new Date();
        const ninetyDays = addDays(today, 90);
        
        if (expDate > today && expDate <= ninetyDays) {
            return (
                <div className="flex flex-col items-center">
                    <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 mb-1">Expiring Soon</Badge>
                    <span className="text-[10px] text-orange-700 font-medium">
                        {format(expDate, 'MM/dd/yy')}
                    </span>
                </div>
            );
        }
    }

    return (
        <div className="flex flex-col items-center group cursor-help" title={`Expires: ${priv.expiration_date}`}>
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity absolute mt-6 bg-white px-1 rounded shadow border">
                {priv.expiration_date ? format(parseISO(priv.expiration_date), 'MM/dd/yy') : ''}
            </span>
        </div>
    );
  };

  const exportToExcel = async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Privileges by Location", { views: [{ showGridLines: false }] });

    const DARK_NAVY   = "FF1F3864";
    const HEADER_BG   = "FF2E5096";
    const WHITE       = "FFFFFFFF";
    const ALT_ROW     = "FFEEF2FA";
    const GREEN_BG    = "FFC6EFCE"; const GREEN_FG = "FF276221";
    const RED_BG      = "FFFFC7CE"; const RED_FG   = "FF9C0006";
    const ORANGE_BG   = "FFFFEB9C"; const ORANGE_FG = "FF9C6500";
    const YELLOW_BG   = "FFFFFF99"; const YELLOW_FG = "FF7D6608";
    const GRAY_BG     = "FFF2F2F2"; const GRAY_FG  = "FF808080";

    const mkFont = (opts) => ({ name: "Calibri", size: 11, ...opts });
    const mkFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const thin   = { style: "thin", color: { argb: "FFCCCCCC" } };
    const med    = { style: "medium", color: { argb: DARK_NAVY } };

    const fmtDate = (d) => {
      if (!d) return "";
      try { return format(parseISO(d.split("T")[0]), "M/d/yyyy"); } catch { return d; }
    };

    const allFacilities = [
      "Hartford Hospital", "St. Francis", "UConn",
      "Manchester / ECHN", "Bloomfield", "CCMC", "CTSC- CT Surgery Center"
    ];

    // ── Column definitions ──────────────────────────────────────────────────
    // Provider Name | Facility | Privileges | Location | Staff Status | Department | Specialty | Start Date | Through Date | Notes
    ws.columns = [
      { width: 28 }, // Provider Name
      { width: 30 }, // Facility Name
      { width: 12 }, // Privileges
      { width: 20 }, // Location / Contact
      { width: 14 }, // Staff Status
      { width: 28 }, // Department
      { width: 20 }, // Specialty
      { width: 18 }, // Privileges Start Date
      { width: 20 }, // Privileges Through Date
      { width: 35 }, // Notes
    ];

    // ── Title row ───────────────────────────────────────────────────────────
    ws.addRow(["Provider Credentialing — Privileges by Location", ...Array(9).fill("")]);
    ws.mergeCells("A1:J1");
    const titleCell = ws.getCell("A1");
    titleCell.font      = mkFont({ bold: true, size: 16, color: { argb: WHITE } });
    titleCell.fill      = mkFill(DARK_NAVY);
    titleCell.alignment = { horizontal: "center", vertical: "middle" };
    ws.getRow(1).height = 38;

    // Generated on
    ws.addRow([`Generated: ${format(new Date(), "MMMM d, yyyy")}`, ...Array(9).fill("")]);
    ws.mergeCells("A2:J2");
    ws.getCell("A2").font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
    ws.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
    ws.getRow(2).height = 16;

    ws.addRow([]); ws.getRow(3).height = 6;

    // ── Table header (row 4) ────────────────────────────────────────────────
    const hRow = ws.addRow([
      "Provider Name", "Facility Name", "Privileges", "Location",
      "Staff Status", "Department", "Specialty",
      "Privileges Start Date", "Privileges Through Date", "Notes"
    ]);
    hRow.height = 22;
    hRow.eachCell({ includeEmpty: true }, (cell) => {
      cell.font      = mkFont({ bold: true, color: { argb: WHITE } });
      cell.fill      = mkFill(HEADER_BG);
      cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
      cell.border    = { bottom: med, right: thin };
    });

    // ── Data rows: one row per provider-facility combo ──────────────────────
    let rowIdx = 0;
    processedData.forEach(provider => {
      allFacilities.forEach(facility => {
        const priv = provider.facilityStatus[facility];
        const hasPriv = !!priv;

        // Determine status label + colors
        let statusLabel = "Yes";
        let statusBg = GREEN_BG; let statusFg = GREEN_FG;
        let staffStatus = "";
        if (!hasPriv) {
          statusLabel = "—";
          statusBg = GRAY_BG; statusFg = GRAY_FG;
        } else {
          staffStatus = priv.status ? priv.status.charAt(0).toUpperCase() + priv.status.slice(1) : "";
          const isExpired = priv.status === "expired" || (priv.expiration_date && isPast(parseISO(priv.expiration_date)));
          if (isExpired) { statusBg = RED_BG; statusFg = RED_FG; }
          else if (priv.status === "pending") { statusBg = YELLOW_BG; statusFg = YELLOW_FG; }
          else if (priv.expiration_date) {
            const exp = parseISO(priv.expiration_date);
            if (exp > new Date() && exp <= addDays(new Date(), 90)) { statusBg = ORANGE_BG; statusFg = ORANGE_FG; }
          }
        }

        const bgArgb = rowIdx % 2 === 0 ? WHITE : ALT_ROW;
        const row = ws.addRow([
          provider.full_name,
          facility,
          hasPriv ? statusLabel : "—",
          "", // Location / Contact — not stored in our entity, leave blank
          staffStatus,
          "", // Department
          "", // Specialty
          hasPriv && priv.granted_date   ? fmtDate(priv.granted_date)    : "",
          hasPriv && priv.expiration_date ? fmtDate(priv.expiration_date) : "",
          priv?.notes || "",
        ]);
        row.height = 18;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.fill      = mkFill(bgArgb);
          cell.font      = mkFont({});
          cell.alignment = { horizontal: colNum === 1 ? "left" : colNum === 10 ? "left" : "center", vertical: "middle" };
          cell.border    = { bottom: thin, right: thin };
        });

        // Color-code the "Privileges" cell (col 3)
        const privCell = row.getCell(3);
        if (hasPriv) {
          privCell.fill = mkFill(statusBg);
          privCell.font = mkFont({ bold: true, color: { argb: statusFg } });
        } else {
          privCell.font = mkFont({ color: { argb: GRAY_FG } });
        }

        rowIdx++;
      });
    });

    // ── Register as Excel Table ─────────────────────────────────────────────
    const tableEndRow = ws.rowCount;
    if (tableEndRow >= 4) {
      ws.addTable({
        name: "PrivilegesByLocation",
        ref: `A4:J${tableEndRow}`,
        headerRow: true,
        totalsRow: false,
        style: { theme: "TableStyleMedium2", showRowStripes: true },
        columns: [
          { name: "Provider Name",          filterButton: true },
          { name: "Facility Name",          filterButton: true },
          { name: "Privileges",             filterButton: true },
          { name: "Location",               filterButton: true },
          { name: "Staff Status",           filterButton: true },
          { name: "Department",             filterButton: true },
          { name: "Specialty",              filterButton: true },
          { name: "Privileges Start Date",  filterButton: true },
          { name: "Privileges Through Date", filterButton: true },
          { name: "Notes",                  filterButton: true },
        ],
        rows: [], // rows already added above
      });
    }

    // Freeze header row
    ws.views = [{ showGridLines: false, state: "frozen", ySplit: 4, xSplit: 0 }];

    // ── Download ────────────────────────────────────────────────────────────
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Provider_Credentialing_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="border-b border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <CardTitle>Provider Credentialing Matrix</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Overview of credentialing status by facility for all active providers
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search providers..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 w-full sm:w-[200px]"
                />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full sm:w-[180px]">
                    <SelectValue placeholder="Filter by Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="expiring_soon">Expiring Soon</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                    <SelectItem value="missing">Not Credentialed</SelectItem>
                </SelectContent>
            </Select>
            <Button onClick={exportToCSV} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="text-left p-4 font-semibold text-slate-700 min-w-[200px] sticky left-0 bg-slate-50 z-10 border-r">Provider</th>
              {facilities.map(facility => (
                <th key={facility} className="text-center p-4 font-semibold text-slate-700 min-w-[120px]">
                    <div className="flex flex-col items-center">
                        <span>{facility.replace('Hospital', 'Hosp.').replace('Center', 'Ctr.')}</span>
                    </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.length === 0 ? (
                <tr>
                    <td colSpan={facilities.length + 1} className="p-8 text-center text-slate-500">
                        No providers found matching your filters.
                    </td>
                </tr>
            ) : (
                filteredData.map((provider) => (
                <tr key={provider.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-medium text-slate-900 sticky left-0 bg-white group-hover:bg-slate-50 border-r z-10">
                    <div className="flex flex-col">
                        <span>{provider.full_name}</span>
                        <span className="text-xs text-slate-500 font-normal">{provider.role}</span>
                    </div>
                    </td>
                    {facilities.map(facility => (
                    <td key={facility} className="p-4 text-center align-middle border-l border-slate-50">
                        {getStatusBadge(provider.facilityStatus[facility])}
                    </td>
                    ))}
                </tr>
                ))
            )}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}