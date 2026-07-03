import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { type SensorData, type PredictionResult, FEATURES } from "./config";

export function downloadPDFReport(
  sensorData: SensorData,
  result: PredictionResult,
  mechanicAdvice: string,
  rulValue: number | null // Pudhusa RUL parameter add panniyachu
) {
  const doc = new jsPDF();
  const timestamp = new Date().toLocaleString();

  doc.setFontSize(18);
  doc.setTextColor(41, 128, 185);
  doc.text("EdgePredict AI - Diagnostic Report", 14, 22);

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated on: ${timestamp}`, 14, 30);

  // Add RUL to the Results Table
  const resultsBody = [
    ["Predicted Status", result.label_name],
    ["Health Score", `${result.health_score}%`],
    ["Confidence", `${(result.confidence * 100).toFixed(1)}%`],
    ["Severity", result.analysis.severity.toUpperCase()],
    ["Affected Component", result.analysis.component],
  ];

  // RUL iruntha athaiyum PDF table-la add pandrom
  if (rulValue !== null) {
    resultsBody.push(["Remaining Useful Life", `${rulValue} Cycles`]);
  }

  autoTable(doc, {
    startY: 35,
    head: [["Metric", "Value"]],
    body: resultsBody,
    theme: "grid",
    headStyles: { fillColor: [41, 128, 185] },
  });

  autoTable(doc, {
    startY: (doc as any).lastAutoTable.finalY + 10,
    head: [["Sensor Name", "Reading"]],
    body: FEATURES.map((f) => [f, String(sensorData[f] ?? "N/A")]),
    theme: "striped",
    headStyles: { fillColor: [52, 73, 94] },
  });

  const currentY = (doc as any).lastAutoTable.finalY + 15;
  doc.setFontSize(14);
  doc.setTextColor(41, 128, 185);
  doc.text("GenAI Mechanic Advice", 14, currentY);

  doc.setFontSize(11);
  doc.setTextColor(0);
  
  const adviceText = mechanicAdvice || "No AI advice was requested during this session.";
  const splitAdvice = doc.splitTextToSize(adviceText, 180);
  doc.text(splitAdvice, 14, currentY + 7);

  doc.save(`EdgePredict_Report_${new Date().getTime()}.pdf`);
}