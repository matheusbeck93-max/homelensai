import React, { useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileSpreadsheet, Download, Loader2 } from "lucide-react";
import type { WorkflowExcelBlock as WorkflowExcelBlockType } from "@/types/ui-blocks";

interface WorkflowExcelBlockProps {
  block: WorkflowExcelBlockType;
}

export const WorkflowExcelBlock: React.FC<WorkflowExcelBlockProps> = ({ block }) => {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const wb = XLSX.utils.book_new();

      for (const sheet of block.sheets) {
        const data: (string | number)[][] = [sheet.headers, ...sheet.rows];

        if (sheet.summaryRows && sheet.summaryRows.length > 0) {
          // Add empty row before summary
          data.push([]);
          for (const sr of sheet.summaryRows) {
            data.push([sr.label, sr.value]);
          }
        }

        const ws = XLSX.utils.aoa_to_sheet(data);

        // Bold header row
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[addr]) {
            ws[addr].s = { font: { bold: true } };
          }
        }

        // Bold summary rows
        if (sheet.summaryRows) {
          const summaryStart = sheet.rows.length + 2; // +1 header +1 empty
          sheet.summaryRows.forEach((sr, i) => {
            if (sr.bold) {
              for (let c = 0; c <= 1; c++) {
                const addr = XLSX.utils.encode_cell({ r: summaryStart + i, c });
                if (ws[addr]) {
                  ws[addr].s = { font: { bold: true } };
                }
              }
            }
          });
        }

        // Auto-size columns
        const colWidths = sheet.headers.map((h, ci) => {
          let max = h.length;
          for (const row of sheet.rows) {
            const val = row[ci];
            if (val !== undefined && val !== null) {
              max = Math.max(max, String(val).length);
            }
          }
          return { wch: Math.min(max + 2, 40) };
        });
        ws["!cols"] = colWidths;

        XLSX.utils.book_append_sheet(wb, ws, sheet.name.substring(0, 31));
      }

      XLSX.writeFile(wb, block.filename);
    } catch (err) {
      console.error("Error generating Excel:", err);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <Card className="border-primary/20 bg-card">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5 text-primary" />
          <CardTitle className="text-base">{block.title}</CardTitle>
        </div>
        <CardDescription className="text-sm">{block.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {block.sheets.map((sheet) => (
            <Badge key={sheet.name} variant="secondary" className="text-xs">
              {sheet.name}
            </Badge>
          ))}
        </div>
        <Button onClick={handleDownload} disabled={downloading} className="w-full gap-2">
          {downloading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="h-4 w-4" />
              Download Excel
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
