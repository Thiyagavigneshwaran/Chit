import PDFDocument from 'pdfkit';

/**
 * Generates a PDF buffer containing the installment schedule for a chit group.
 * @param {Object} group - Chit group record from DB
 * @param {Array}  members - enrolled members array
 * @returns {Promise<Buffer>} - PDF as a Buffer ready for email attachment
 */
export const generateInstallmentPDF = (group, members = []) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Helper: Format INR currency ────────────────────────────────────
      const fmt = (val) =>
        'INR ' + Number(val || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });

      // ── Parse installment schedule ─────────────────────────────────────
      let schedule = [];
      if (group.installment_schedule) {
        try {
          schedule = typeof group.installment_schedule === 'string'
            ? JSON.parse(group.installment_schedule)
            : group.installment_schedule;
        } catch (e) {
          schedule = [];
        }
      }

      // ─────────────────────────────────────────────────────────────────
      // HEADER BANNER
      // ─────────────────────────────────────────────────────────────────
      doc.rect(0, 0, doc.page.width, 90).fill('#0F172A');

      // Title text
      doc.fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(18)
        .text('Sri Vinayaga Chit Funds', 40, 20, { align: 'left' });

      doc.fillColor('#F59E0B')
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('INSTALLMENT SCHEDULE — OFFICIAL DOCUMENT', 40, 46, { align: 'left' });

      doc.fillColor('#94A3B8')
        .font('Helvetica')
        .fontSize(8)
        .text(`Generated: ${new Date().toLocaleString('en-IN', { dateStyle: 'full', timeStyle: 'short' })}`, 40, 64);

      doc.fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`Sri Vinayaga Chit Fund Management System`, 0, 64, { align: 'right', width: doc.page.width - 40 });

      doc.moveDown(3.5);

      // ─────────────────────────────────────────────────────────────────
      // GROUP INFO CARD
      // ─────────────────────────────────────────────────────────────────
      const cardTop = doc.y;
      doc.rect(40, cardTop, doc.page.width - 80, 90).fill('#EFF6FF').stroke('#BFDBFE');

      doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(9).text('GROUP DETAILS', 56, cardTop + 10);

      const infoY = cardTop + 26;
      const col1 = 56, col2 = 220, col3 = 380;

      const infoLine = (label, value, x, y) => {
        doc.fillColor('#64748B').font('Helvetica').fontSize(8).text(label, x, y);
        doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(9).text(value, x, y + 11);
      };

      infoLine('Group Code', group.id, col1, infoY);
      infoLine('Group Name', group.name, col2, infoY);
      infoLine('Chit Value', fmt(group.value), col3, infoY);

      const infoY2 = infoY + 32;
      infoLine('Monthly Contribution', fmt(group.monthly_contribution), col1, infoY2);
      infoLine('Total Installments', `${group.installments} Months`, col2, infoY2);
      infoLine('Active Members', `${members.length}`, col3, infoY2);

      doc.moveDown(5.5);

      // ─────────────────────────────────────────────────────────────────
      // INSTALLMENT SCHEDULE TABLE
      // ─────────────────────────────────────────────────────────────────
      doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(10)
        .text('INSTALLMENT SCHEDULE', 40, doc.y + 6);
      doc.moveDown(0.4);

      if (schedule.length === 0) {
        doc.fillColor('#94A3B8').font('Helvetica').fontSize(9)
          .text('No installment schedule defined for this group.', 40, doc.y);
      } else {
        // Table header
        const tblTop = doc.y;
        const colWidths = { no: 30, date: 72, actual: 75, paying: 75, bid: 75, repay: 75 };
        const colX = {
          no: 40,
          date: 40 + colWidths.no,
          actual: 40 + colWidths.no + colWidths.date,
          paying: 40 + colWidths.no + colWidths.date + colWidths.actual,
          bid: 40 + colWidths.no + colWidths.date + colWidths.actual + colWidths.paying,
          repay: 40 + colWidths.no + colWidths.date + colWidths.actual + colWidths.paying + colWidths.bid,
        };
        const rowH = 18;

        // Header row
        doc.rect(40, tblTop, doc.page.width - 80, rowH).fill('#1E40AF');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
        doc.text('No.', colX.no, tblTop + 5, { width: colWidths.no, align: 'center' });
        doc.text('Due Date', colX.date, tblTop + 5, { width: colWidths.date, align: 'center' });
        doc.text('Actual Amt', colX.actual, tblTop + 5, { width: colWidths.actual, align: 'right' });
        doc.text('Paying Amt', colX.paying, tblTop + 5, { width: colWidths.paying, align: 'right' });
        doc.text('Bid Payout', colX.bid, tblTop + 5, { width: colWidths.bid, align: 'right' });
        doc.text('Repayment', colX.repay, tblTop + 5, { width: colWidths.repay, align: 'right' });

        let currentY = tblTop + rowH;

        schedule.forEach((item, idx) => {
          // Page break check
          if (currentY + rowH > doc.page.height - 60) {
            doc.addPage();
            currentY = 40;

            // Repeat header on new page
            doc.rect(40, currentY, doc.page.width - 80, rowH).fill('#1E40AF');
            doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
            doc.text('No.', colX.no, currentY + 5, { width: colWidths.no, align: 'center' });
            doc.text('Due Date', colX.date, currentY + 5, { width: colWidths.date, align: 'center' });
            doc.text('Actual Amt', colX.actual, currentY + 5, { width: colWidths.actual, align: 'right' });
            doc.text('Paying Amt', colX.paying, currentY + 5, { width: colWidths.paying, align: 'right' });
            doc.text('Bid Payout', colX.bid, currentY + 5, { width: colWidths.bid, align: 'right' });
            doc.text('Repayment', colX.repay, currentY + 5, { width: colWidths.repay, align: 'right' });
            currentY += rowH;
          }

          const isEven = idx % 2 === 0;
          doc.rect(40, currentY, doc.page.width - 80, rowH)
            .fill(isEven ? '#F8FAFC' : '#FFFFFF');

          const actVal = item.actualAmount !== undefined ? item.actualAmount : (item.amount || 0);
          const payVal = item.payingAmount !== undefined ? item.payingAmount : (item.amount || 0);
          const bidVal = item.bidAmount !== undefined ? item.bidAmount : 0;
          const repayVal = item.repaymentAmount !== undefined ? item.repaymentAmount : 0;
          const dateVal = item.dueDate
            ? new Date(item.dueDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
            : '—';

          doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(7.5)
            .text(`M${idx + 1}`, colX.no, currentY + 5, { width: colWidths.no, align: 'center' });

          doc.fillColor('#475569').font('Helvetica').fontSize(7.5)
            .text(dateVal, colX.date, currentY + 5, { width: colWidths.date, align: 'center' });

          doc.fillColor('#1E293B').font('Helvetica').fontSize(7.5)
            .text(fmt(actVal), colX.actual, currentY + 5, { width: colWidths.actual, align: 'right' });

          doc.fillColor('#059669').font('Helvetica-Bold').fontSize(7.5)
            .text(fmt(payVal), colX.paying, currentY + 5, { width: colWidths.paying, align: 'right' });

          doc.fillColor('#1E293B').font('Helvetica').fontSize(7.5)
            .text(fmt(bidVal), colX.bid, currentY + 5, { width: colWidths.bid, align: 'right' });

          doc.fillColor('#D97706').font('Helvetica').fontSize(7.5)
            .text(fmt(repayVal), colX.repay, currentY + 5, { width: colWidths.repay, align: 'right' });

          // Row bottom border
          doc.moveTo(40, currentY + rowH)
            .lineTo(doc.page.width - 40, currentY + rowH)
            .strokeColor('#E2E8F0').lineWidth(0.5).stroke();

          currentY += rowH;
        });

        // Table outer border
        doc.rect(40, tblTop, doc.page.width - 80, currentY - tblTop)
          .strokeColor('#CBD5E1').lineWidth(1).stroke();

        // Summary totals row
        const totalPaying = schedule.reduce((s, r) => s + (parseFloat(r.payingAmount || r.amount) || 0), 0);
        const totalBid = schedule.reduce((s, r) => s + (parseFloat(r.bidAmount) || 0), 0);

        doc.y = currentY + 10;
        doc.rect(40, doc.y, doc.page.width - 80, 22).fill('#1E293B');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8)
          .text('TOTALS', colX.no, doc.y + 7, { width: colWidths.no + colWidths.date + colWidths.actual - 4 })
          .text(fmt(totalPaying), colX.paying, doc.y + 7, { width: colWidths.paying, align: 'right' })
          .text(fmt(totalBid), colX.bid, doc.y + 7, { width: colWidths.bid, align: 'right' });
        doc.moveDown(2.5);
      }

      // ─────────────────────────────────────────────────────────────────
      // MEMBERS SECTION (compact list)
      // ─────────────────────────────────────────────────────────────────
      if (members.length > 0) {
        if (doc.y + 100 > doc.page.height - 60) {
          doc.addPage();
        }

        doc.fillColor('#1E293B').font('Helvetica-Bold').fontSize(10)
          .text('ENROLLED MEMBERS', 40, doc.y + 6);
        doc.moveDown(0.4);

        const mTblTop = doc.y;
        const mRowH = 17;
        const mColX = { no: 40, name: 70, mobile: 240, email: 360 };
        const mColW = { no: 30, name: 170, mobile: 120, email: 165 };

        doc.rect(40, mTblTop, doc.page.width - 80, mRowH).fill('#1E40AF');
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(7.5);
        doc.text('#', mColX.no, mTblTop + 5, { width: mColW.no, align: 'center' });
        doc.text('Name', mColX.name, mTblTop + 5, { width: mColW.name });
        doc.text('Mobile', mColX.mobile, mTblTop + 5, { width: mColW.mobile });
        doc.text('Email', mColX.email, mTblTop + 5, { width: mColW.email });

        let mY = mTblTop + mRowH;
        members.forEach((m, idx) => {
          if (mY + mRowH > doc.page.height - 60) {
            doc.addPage();
            mY = 40;
          }
          doc.rect(40, mY, doc.page.width - 80, mRowH).fill(idx % 2 === 0 ? '#F8FAFC' : '#FFFFFF');

          doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(7.5)
            .text(`${idx + 1}`, mColX.no, mY + 5, { width: mColW.no, align: 'center' });
          doc.fillColor('#1E293B').font('Helvetica').fontSize(7.5)
            .text(m.name || '—', mColX.name, mY + 5, { width: mColW.name })
            .text(m.mobile || '—', mColX.mobile, mY + 5, { width: mColW.mobile })
            .text(m.email || '—', mColX.email, mY + 5, { width: mColW.email });

          doc.moveTo(40, mY + mRowH).lineTo(doc.page.width - 40, mY + mRowH)
            .strokeColor('#E2E8F0').lineWidth(0.5).stroke();

          mY += mRowH;
        });
        doc.rect(40, mTblTop, doc.page.width - 80, mY - mTblTop)
          .strokeColor('#CBD5E1').lineWidth(1).stroke();
      }

      // ─────────────────────────────────────────────────────────────────
      // FOOTER
      // ─────────────────────────────────────────────────────────────────
      const footerY = doc.page.height - 44;
      doc.rect(0, footerY, doc.page.width, 44).fill('#F8FAFC');
      doc.moveTo(0, footerY).lineTo(doc.page.width, footerY).strokeColor('#E2E8F0').lineWidth(1).stroke();
      doc.fillColor('#94A3B8').font('Helvetica-Oblique').fontSize(7.5)
        .text(
          'This is a system-generated document from Sri Vinayaga Chit Fund Management System. Please do not alter this document.',
          40, footerY + 10, { align: 'center', width: doc.page.width - 80 }
        );
      doc.fillColor('#1E40AF').font('Helvetica-Bold').fontSize(7.5)
        .text('Sri Vinayaga Chit Funds', 40, footerY + 24, { align: 'center', width: doc.page.width - 80 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
