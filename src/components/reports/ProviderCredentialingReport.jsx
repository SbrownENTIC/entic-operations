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
    wb.creator = "ENTIC Operations Center";

    // ── Shared constants ─────────────────────────────────────────────────────
    const DARK_NAVY  = "FF1F3864";
    const HEADER_BG  = "FF2E5096";
    const FAC_HDR_BG = "FFD6E4F7";  // light blue for facility group headers
    const WHITE      = "FFFFFFFF";
    const ALT_ROW    = "FFEEF2FA";
    const GREEN_BG   = "FFC6EFCE"; const GREEN_FG  = "FF276221";
    const RED_BG     = "FFFFC7CE"; const RED_FG    = "FF9C0006";
    const YELLOW_BG  = "FFFFFF99"; const YELLOW_FG = "FF7D6608";
    const GRAY_FG    = "FF808080";

    const mkFont = (opts) => ({ name: "Calibri", size: 11, ...opts });
    const mkFill = (argb) => ({ type: "pattern", pattern: "solid", fgColor: { argb } });
    const thin = { style: "thin", color: { argb: "FFCCCCCC" } };

    const fmtDate = (d) => {
      if (!d) return "";
      try { return format(parseISO(d.split("T")[0]), "M/d/yyyy"); } catch { return d; }
    };

    const allFacilities = [
      "Hartford Hospital", "St. Francis", "UConn",
      "Manchester / ECHN", "Bloomfield", "CCMC", "CTSC- CT Surgery Center"
    ];

    // Helper: determine status display + colors for a privilege record
    const getPrivStyle = (priv) => {
      if (!priv) return { label: "—", bg: WHITE, fg: GRAY_FG, statusText: "" };
      const isExpired = priv.status === "expired" || (priv.expiration_date && isPast(parseISO(priv.expiration_date)));
      const isPending = priv.status === "pending";
      let bg = GREEN_BG; let fg = GREEN_FG; let label = "Active";
      if (isExpired)  { bg = RED_BG;    fg = RED_FG;    label = "Expired"; }
      else if (isPending) { bg = YELLOW_BG; fg = YELLOW_FG; label = "Pending"; }
      const statusText = priv.expiration_date ? `${label} – ${fmtDate(priv.expiration_date)}` : label;
      return { label, bg, fg, statusText };
    };

    // ════════════════════════════════════════════════════════════════════════
    // WORKSHEET 1: "Privileges by Location"
    // ════════════════════════════════════════════════════════════════════════
    const ws1 = wb.addWorksheet("Privileges by Location", { views: [{ showGridLines: false }] });

    // Columns: Provider Name | Privilege Status | Start Date | Through Date | Staff Status | Department | Specialty | Notes
    const W1_COLS = 8;
    ws1.columns = [
      { width: 32 }, // Provider Name
      { width: 16 }, // Privilege Status
      { width: 18 }, // Privileges Start Date
      { width: 20 }, // Privileges Through Date
      { width: 14 }, // Staff Status
      { width: 26 }, // Department
      { width: 20 }, // Specialty
      { width: 38 }, // Notes
    ];

    // Title row
    ws1.addRow(["Provider Credentialing — Privileges by Location", ...Array(W1_COLS - 1).fill("")]);
    ws1.mergeCells(`A1:H1`);
    const t1 = ws1.getCell("A1");
    t1.font      = mkFont({ bold: true, size: 16, color: { argb: WHITE } });
    t1.fill      = mkFill(DARK_NAVY);
    t1.alignment = { horizontal: "center", vertical: "middle" };
    ws1.getRow(1).height = 38;

    // Generated on
    ws1.addRow([`Generated: ${format(new Date(), "MMMM d, yyyy")}`, ...Array(W1_COLS - 1).fill("")]);
    ws1.mergeCells("A2:H2");
    ws1.getCell("A2").font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
    ws1.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
    ws1.getRow(2).height = 16;

    // Freeze after row 1 (title)
    ws1.views = [{ showGridLines: false, state: "frozen", ySplit: 1, xSplit: 0 }];

    // Column header row definition (reusable per facility section)
    const COL_HEADERS = ["Provider Name", "Privilege Status", "Privileges Start Date", "Privileges Through Date", "Staff Status", "Department", "Specialty", "Notes"];

    // Group by facility
    allFacilities.forEach((facility) => {
      // Blank spacer row before each section
      ws1.addRow([]);

      // Facility group header row
      ws1.addRow([facility.toUpperCase(), ...Array(W1_COLS - 1).fill("")]);
      ws1.mergeCells(`A${ws1.rowCount}:H${ws1.rowCount}`);
      const facCell = ws1.getCell(`A${ws1.rowCount}`);
      facCell.font      = mkFont({ bold: true, size: 13, color: { argb: DARK_NAVY } });
      facCell.fill      = mkFill(FAC_HDR_BG);
      facCell.alignment = { horizontal: "left", vertical: "middle", indent: 1 };
      ws1.getRow(ws1.rowCount).height = 24;

      // Column headers for this section
      const colHdrRow = ws1.addRow(COL_HEADERS);
      colHdrRow.height = 20;
      colHdrRow.eachCell({ includeEmpty: true }, (cell) => {
        cell.font      = mkFont({ bold: true, color: { argb: WHITE } });
        cell.fill      = mkFill(HEADER_BG);
        cell.alignment = { horizontal: "center", vertical: "middle" };
        cell.border    = { bottom: { style: "medium", color: { argb: DARK_NAVY } }, right: thin };
      });

      // Providers for this facility, sorted A-Z
      const sectionProviders = processedData
        .slice()
        .sort((a, b) => a.full_name.localeCompare(b.full_name));

      sectionProviders.forEach((provider, idx) => {
        const priv = provider.facilityStatus[facility];
        const { label, bg, fg, statusText } = getPrivStyle(priv);
        const hasPriv = !!priv;
        const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
        const staffStatus = hasPriv && priv.status
          ? priv.status.charAt(0).toUpperCase() + priv.status.slice(1)
          : "";

        const row = ws1.addRow([
          provider.full_name,
          hasPriv ? label : "—",
          hasPriv && priv.granted_date    ? fmtDate(priv.granted_date)    : "",
          hasPriv && priv.expiration_date ? fmtDate(priv.expiration_date) : "",
          staffStatus,
          "", // Department
          "", // Specialty
          priv?.notes || "",
        ]);
        row.height = 18;
        row.eachCell({ includeEmpty: true }, (cell, colNum) => {
          cell.fill      = mkFill(bgArgb);
          cell.font      = mkFont({});
          cell.alignment = { horizontal: colNum === 1 || colNum === 8 ? "left" : "center", vertical: "middle" };
          cell.border    = { bottom: thin, right: thin };
        });

        // Color the status cell (col 2)
        if (hasPriv) {
          row.getCell(2).fill = mkFill(bg);
          row.getCell(2).font = mkFont({ bold: true, color: { argb: fg } });
        } else {
          row.getCell(2).font = mkFont({ color: { argb: GRAY_FG } });
        }
      });
    });

    // ════════════════════════════════════════════════════════════════════════
    // WORKSHEET 2: "Credentialing Matrix"
    // ════════════════════════════════════════════════════════════════════════
    const ws2 = wb.addWorksheet("Credentialing Matrix", { views: [{ showGridLines: false }] });

    // For each provider/facility, pick the privilege with the most recent expiration_date
    const getBestPriv = (provider, facility) => {
      const matches = privileges.filter(
        p => p.provider_id === provider.id && p.facility_name === facility
      );
      if (!matches.length) return null;
      return matches.sort((a, b) => {
        if (!a.expiration_date) return 1;
        if (!b.expiration_date) return -1;
        return b.expiration_date.localeCompare(a.expiration_date);
      })[0];
    };

    // Providers sorted A-Z
    const matrixProviders = processedData.slice().sort((a, b) => a.full_name.localeCompare(b.full_name));

    const numFacCols = allFacilities.length;

    // Column widths: Provider Name + one col per facility
    ws2.columns = [
      { width: 32 },
      ...allFacilities.map(() => ({ width: 22 })),
    ];

    // Title row
    ws2.addRow(["Provider Credentialing Matrix", ...Array(numFacCols).fill("")]);
    ws2.mergeCells(`A1:${String.fromCharCode(65 + numFacCols)}1`);
    const t2 = ws2.getCell("A1");
    t2.font      = mkFont({ bold: true, size: 16, color: { argb: WHITE } });
    t2.fill      = mkFill(DARK_NAVY);
    t2.alignment = { horizontal: "center", vertical: "middle" };
    ws2.getRow(1).height = 38;

    // Generated on
    ws2.addRow([`Generated: ${format(new Date(), "MMMM d, yyyy")}`, ...Array(numFacCols).fill("")]);
    ws2.mergeCells(`A2:${String.fromCharCode(65 + numFacCols)}2`);
    ws2.getCell("A2").font      = mkFont({ italic: true, size: 9, color: { argb: "FFAAAAAA" } });
    ws2.getCell("A2").alignment = { horizontal: "left", vertical: "middle" };
    ws2.getRow(2).height = 16;

    // Header row (row 3): Provider Name + facility names
    const matHdrRow = ws2.addRow(["Provider Name", ...allFacilities]);
    matHdrRow.height = 24;
    matHdrRow.eachCell({ includeEmpty: true }, (cell, colNum) => {
      cell.font      = mkFont({ bold: true, color: { argb: WHITE } });
      cell.fill      = mkFill(HEADER_BG);
      cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle", wrapText: true };
      cell.border    = { bottom: { style: "medium", color: { argb: DARK_NAVY } }, right: thin };
    });

    // Freeze row 3 (header)
    ws2.views = [{ showGridLines: false, state: "frozen", ySplit: 3, xSplit: 0 }];

    // Data rows
    matrixProviders.forEach((provider, idx) => {
      const bgArgb = idx % 2 === 0 ? WHITE : ALT_ROW;
      const rowValues = [provider.full_name, ...allFacilities.map(facility => {
        const priv = getBestPriv(provider, facility);
        if (!priv) return "";
        const { statusText } = getPrivStyle(priv);
        return statusText;
      })];

      const row = ws2.addRow(rowValues);
      row.height = 18;
      row.eachCell({ includeEmpty: true }, (cell, colNum) => {
        cell.fill      = mkFill(bgArgb);
        cell.font      = mkFont({});
        cell.alignment = { horizontal: colNum === 1 ? "left" : "center", vertical: "middle" };
        cell.border    = { bottom: thin, right: thin };
      });

      // Color each facility cell
      allFacilities.forEach((facility, fIdx) => {
        const priv = getBestPriv(provider, facility);
        const cell = row.getCell(fIdx + 2);
        if (priv) {
          const { bg, fg } = getPrivStyle(priv);
          cell.fill = mkFill(bg);
          cell.font = mkFont({ color: { argb: fg } });
        }
      });
    });

    // Register matrix as Excel Table with filters
    const matTableEnd = ws2.rowCount;
    if (matTableEnd >= 3) {
      ws2.addTable({
        name: "CredentialingMatrix",
        ref: `A3:${String.fromCharCode(65 + numFacCols)}${matTableEnd}`,
        headerRow: true,
        totalsRow: false,
        style: { theme: "TableStyleMedium2", showRowStripes: true },
        columns: [
          { name: "Provider Name", filterButton: true },
          ...allFacilities.map(f => ({ name: f, filterButton: true })),
        ],
        rows: [],
      });
    }

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
            <Button onClick={exportToExcel} variant="outline" className="gap-2">
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