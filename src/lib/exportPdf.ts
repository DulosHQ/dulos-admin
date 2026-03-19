import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface PdfExportData {
  revenue: number;
  aov: number;
  completedOrders: number;
  occupancyPercent: number;
  eventRevenues: { event_name: string; tickets: number; orders: number; revenue: number }[];
  commissionData: { totalRevenue: number; dulosCommission: number; producerShare: number };
  zoneRevenues: { zone: string; revenue: number }[];
  selectedEvent?: string; // filter context
}

function fmtCurrency(value: number): string {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', minimumFractionDigits: 0 }).format(value);
}

export function exportFinancePdf(data: PdfExportData) {
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = 20;

  // === HEADER BAR (elegant gradient effect) ===
  doc.setFillColor(26, 26, 46); // #1a1a2e
  doc.rect(0, 0, pageWidth, 38, 'F');

  // Subtle red accent at bottom of header
  doc.setFillColor(239, 68, 68);
  doc.rect(0, 38, pageWidth, 0.8, 'F');

  // Dulos branding
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(239, 68, 68); // #EF4444
  doc.text('DULOS', margin, 17);

  // Subtitle
  doc.setFontSize(10);
  doc.setTextColor(200, 200, 210);
  doc.text('Reporte Financiero', margin, 25);

  // Filter context if applicable
  if (data.selectedEvent && data.selectedEvent !== 'all') {
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 170);
    doc.text(`Filtro: ${data.selectedEvent}`, margin, 32);
  }

  // Date — right aligned
  const now = new Date();
  const dateStr = now.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
  doc.setFontSize(9);
  doc.setTextColor(160, 160, 170);
  doc.text(dateStr, pageWidth - margin, 17, { align: 'right' });
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 140);
  doc.text(timeStr + ' hrs', pageWidth - margin, 23, { align: 'right' });

  y = 48;

  // === SCORECARD ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 46);
  doc.text('RESUMEN EJECUTIVO', margin, y);
  y += 2;

  // Thin separator line
  doc.setDrawColor(230, 230, 230);
  doc.setLineWidth(0.3);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  const metrics = [
    { label: 'INGRESOS TOTALES', value: fmtCurrency(data.revenue), accent: false },
    { label: 'TICKET PROMEDIO', value: fmtCurrency(data.aov), accent: false },
    { label: 'ÓRDENES COMPLETADAS', value: data.completedOrders.toLocaleString(), accent: false },
    { label: 'OCUPACIÓN', value: `${data.occupancyPercent.toFixed(1)}%`, accent: data.occupancyPercent > 80 },
  ];

  const cardW = contentWidth / 4 - 2.5;
  const cardGap = (contentWidth - cardW * 4) / 3;
  metrics.forEach((m, i) => {
    const x = margin + i * (cardW + cardGap);
    // Card with subtle shadow effect (double rect)
    doc.setFillColor(252, 252, 253);
    doc.roundedRect(x + 0.3, y + 0.3, cardW, 24, 2, 2, 'F');
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, cardW, 24, 2, 2, 'F');
    doc.setDrawColor(235, 235, 240);
    doc.roundedRect(x, y, cardW, 24, 2, 2, 'S');

    // Red top accent for first card
    if (i === 0) {
      doc.setFillColor(239, 68, 68);
      doc.rect(x + 2, y, cardW - 4, 0.8, 'F');
    }

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(140, 140, 150);
    doc.text(m.label, x + cardW / 2, y + 9, { align: 'center' });
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(m.accent ? 239 : 26, m.accent ? 68 : 26, m.accent ? 68 : 46);
    doc.text(m.value, x + cardW / 2, y + 19, { align: 'center' });
  });

  y += 34;

  // === REVENUE BY EVENT TABLE ===
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 46);
  doc.text('INGRESOS POR EVENTO', margin, y);
  y += 2;
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, margin + contentWidth, y);
  y += 3;

  const eventRows = data.eventRevenues.map(e => [
    e.event_name,
    e.tickets.toLocaleString(),
    e.orders.toLocaleString(),
    fmtCurrency(e.revenue),
    fmtCurrency(e.revenue * 0.15),
  ]);

  // Total row
  const totalRev = data.eventRevenues.reduce((s, e) => s + e.revenue, 0);
  const totalTix = data.eventRevenues.reduce((s, e) => s + e.tickets, 0);
  const totalOrd = data.eventRevenues.reduce((s, e) => s + e.orders, 0);
  eventRows.push(['TOTAL', totalTix.toLocaleString(), totalOrd.toLocaleString(), fmtCurrency(totalRev), fmtCurrency(totalRev * 0.15)]);

  autoTable(doc, {
    startY: y,
    head: [['Evento', 'Boletos', 'Órdenes', 'Revenue', 'Comisión 15%']],
    body: eventRows,
    margin: { left: margin, right: margin },
    headStyles: {
      fillColor: [26, 26, 46],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3,
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [50, 50, 50],
      cellPadding: 2.5,
    },
    alternateRowStyles: {
      fillColor: [250, 250, 252],
    },
    columnStyles: {
      0: { cellWidth: 55 },
      3: { halign: 'right', fontStyle: 'bold' },
      4: { halign: 'right' },
    },
    didParseCell: (hookData) => {
      // Total row — dark
      if (hookData.section === 'body' && hookData.row.index === eventRows.length - 1) {
        hookData.cell.styles.fillColor = [26, 26, 46];
        hookData.cell.styles.textColor = [255, 255, 255];
        hookData.cell.styles.fontStyle = 'bold';
      }
      // Commission column — red
      if (hookData.section === 'body' && hookData.column.index === 4 && hookData.row.index !== eventRows.length - 1) {
        hookData.cell.styles.textColor = [239, 68, 68];
        hookData.cell.styles.fontStyle = 'bold';
      }
    },
    theme: 'grid',
    styles: {
      lineColor: [235, 235, 240],
      lineWidth: 0.15,
      overflow: 'ellipsize',
    },
  });

  // @ts-ignore
  y = doc.lastAutoTable.finalY + 12;

  // === COMMISSION SUMMARY ===
  // Check if we need a new page
  if (y > pageHeight - 60) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(26, 26, 46);
  doc.text('RESUMEN DE COMISIONES', margin, y);
  y += 2;
  doc.setDrawColor(230, 230, 230);
  doc.line(margin, y, margin + contentWidth, y);
  y += 6;

  // Commission visual — 3 elegant cards
  const commCards = [
    { label: 'INGRESOS BRUTOS', value: fmtCurrency(data.commissionData.totalRevenue), r: 26, g: 26, b: 46 },
    { label: 'COMISIÓN DULOS (15%)', value: fmtCurrency(data.commissionData.dulosCommission), r: 239, g: 68, b: 68 },
    { label: 'PRODUCTOR (85%)', value: fmtCurrency(data.commissionData.producerShare), r: 16, g: 185, b: 129 },
  ];

  const commCardW = contentWidth / 3 - 2;
  const commGap = (contentWidth - commCardW * 3) / 2;
  commCards.forEach((c, i) => {
    const x = margin + i * (commCardW + commGap);
    // Shadow
    doc.setFillColor(248, 248, 250);
    doc.roundedRect(x + 0.3, y + 0.3, commCardW, 26, 2, 2, 'F');
    // Card
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(x, y, commCardW, 26, 2, 2, 'F');
    doc.setDrawColor(235, 235, 240);
    doc.roundedRect(x, y, commCardW, 26, 2, 2, 'S');

    // Colored top accent
    doc.setFillColor(c.r, c.g, c.b);
    doc.rect(x + 2, y, commCardW - 4, 1, 'F');

    // Label
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(140, 140, 150);
    doc.text(c.label, x + commCardW / 2, y + 10, { align: 'center' });
    // Value
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(c.r, c.g, c.b);
    doc.text(c.value, x + commCardW / 2, y + 21, { align: 'center' });
  });

  y += 34;

  // === 15/85 DISTRIBUTION BAR ===
  if (data.commissionData.totalRevenue > 0) {
    const barY = y;
    const barH = 6;
    const dulosPct = 0.15;
    const prodPct = 0.85;

    // Bar background
    doc.setFillColor(16, 185, 129); // green (producer)
    doc.roundedRect(margin, barY, contentWidth, barH, 2, 2, 'F');
    // Dulos portion (red)
    doc.setFillColor(239, 68, 68);
    doc.roundedRect(margin, barY, contentWidth * dulosPct, barH, 2, 0, 'F');
    // Fix corner overlap
    doc.rect(margin + contentWidth * dulosPct - 2, barY, 4, barH, 'F');

    // Labels
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(255, 255, 255);
    doc.text('15% Dulos', margin + (contentWidth * dulosPct) / 2, barY + 4, { align: 'center' });
    doc.text('85% Productor', margin + contentWidth * dulosPct + (contentWidth * prodPct) / 2, barY + 4, { align: 'center' });

    y += 14;
  }

  // === ZONE REVENUE (if available) ===
  if (data.zoneRevenues.length > 0) {
    if (y > pageHeight - 50) {
      doc.addPage();
      y = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(26, 26, 46);
    doc.text('REVENUE POR ZONA', margin, y);
    y += 2;
    doc.setDrawColor(230, 230, 230);
    doc.line(margin, y, margin + contentWidth, y);
    y += 3;

    const zoneRows = data.zoneRevenues.map(z => [z.zone, fmtCurrency(z.revenue)]);

    autoTable(doc, {
      startY: y,
      head: [['Zona', 'Revenue']],
      body: zoneRows,
      margin: { left: margin, right: margin },
      headStyles: { fillColor: [26, 26, 46], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8, cellPadding: 3 },
      bodyStyles: { fontSize: 8, textColor: [50, 50, 50], cellPadding: 2.5 },
      alternateRowStyles: { fillColor: [250, 250, 252] },
      columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
      theme: 'grid',
      styles: { lineColor: [235, 235, 240], lineWidth: 0.15 },
    });

    // @ts-ignore
    y = doc.lastAutoTable.finalY + 10;
  }

  // === ELEGANT FOOTER ===
  const footerY = pageHeight - 14;

  // Footer bar
  doc.setFillColor(26, 26, 46);
  doc.rect(0, footerY - 2, pageWidth, 18, 'F');

  // Red accent
  doc.setFillColor(239, 68, 68);
  doc.rect(0, footerY - 3, pageWidth, 1, 'F');

  // Footer text
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 140);
  doc.text('Generado por Dulos Admin Dashboard · Confidencial', margin, footerY + 4);
  doc.text(`${dateStr} · ${timeStr}`, pageWidth - margin, footerY + 4, { align: 'right' });

  // Page number
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(6);
    doc.setTextColor(100, 100, 110);
    doc.text(`Página ${i} de ${totalPages}`, pageWidth / 2, footerY + 4, { align: 'center' });
  }

  doc.save(`Dulos_Reporte_Financiero_${now.toISOString().split('T')[0]}.pdf`);
}
