const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const XLSX = require('xlsx');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(bodyParser.json());
app.use(express.static('public'));

const dbPath = path.join(__dirname, 'rentals.db');
const db = new sqlite3.Database(dbPath);

// Migrate: add new columns if they don't exist (safe to run repeatedly)
db.run(`ALTER TABLE rentals ADD COLUMN otherCharges TEXT DEFAULT '[]'`, () => {});
db.run(`ALTER TABLE rentals ADD COLUMN otherChargesTotal REAL DEFAULT 0`, () => {});
db.run(`ALTER TABLE rentals ADD COLUMN otherAdditions TEXT DEFAULT '[]'`, () => {});
db.run(`ALTER TABLE rentals ADD COLUMN otherDeductions TEXT DEFAULT '[]'`, () => {});
db.run(`ALTER TABLE rentals ADD COLUMN additionsTotal REAL DEFAULT 0`, () => {});
db.run(`ALTER TABLE rentals ADD COLUMN deductionsTotal REAL DEFAULT 0`, () => {});

const calculateDays = (start, end) => Math.max(1, Math.ceil((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24)));

const calc = (d) => {
    const days = calculateDays(d.rentalDate, d.rentalEndDate);
    const dayAmt = days * parseFloat(d.dayRate);
    const allocKm = days * 100;
    const actKm = parseInt(d.endMileage) - parseInt(d.startMileage);
    const exKm = Math.max(0, actKm - allocKm);
    const exCharge = exKm * parseFloat(d.extraKmRate);
    const deposit = parseFloat(d.depositPaid) || 0;
    const parseArr = (v) => Array.isArray(v) ? v : (() => { try { return JSON.parse(v || '[]'); } catch(e) { return []; } })();
    const addArr = parseArr(d.otherAdditions);
    const dedArr = parseArr(d.otherDeductions);
    const addTotal = addArr.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    const dedTotal = dedArr.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
    const total = dayAmt + exCharge + addTotal - dedTotal;
    const depRem = deposit - total;
    return { days, dayAmount: dayAmt.toFixed(2), allocatedKm: allocKm, actualKm: actKm, extraKm: exKm, extraKmCharge: exCharge.toFixed(2), additionsTotal: addTotal.toFixed(2), deductionsTotal: dedTotal.toFixed(2), depositRemaining: depRem.toFixed(2) };
};

app.get('/api/rentals', (req, res) => {
    db.all('SELECT * FROM rentals ORDER BY createdAt DESC', (err, rows) => res.json(rows || []));
});

app.get('/api/rentals/export/xlsx', (req, res) => {
    db.all('SELECT * FROM rentals ORDER BY createdAt DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: 'Failed to export rentals' });

        const data = (rows || []).map((r) => ({
            ID: r.id,
            Client: r.clientName,
            Phone: r.clientPhone,
            Address: r.clientAddress,
            NIC: r.clientNIC,
            Vehicle: r.vehicle,
            RentalDate: r.rentalDate,
            RentalEndDate: r.rentalEndDate,
            Days: r.days,
            DayRate: r.dayRate,
            DayAmount: r.dayAmount,
            DepositPaid: r.depositPaid,
            StartMileage: r.startMileage,
            EndMileage: r.endMileage,
            AllocatedKm: r.allocatedKm,
            ActualKm: r.actualKm,
            ExtraKm: r.extraKm,
            ExtraKmRate: r.extraKmRate,
            ExtraKmCharge: r.extraKmCharge,
            OtherAdditions: r.otherAdditions,
            OtherDeductions: r.otherDeductions,
            AdditionsTotal: r.additionsTotal,
            DeductionsTotal: r.deductionsTotal,
            DepositRemaining: r.depositRemaining,
            Status: r.status,
            CreatedAt: r.createdAt,
            UpdatedAt: r.updatedAt
        }));

        const workbook = XLSX.utils.book_new();
        const worksheet = XLSX.utils.json_to_sheet(data);
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Rentals');

        const now = new Date().toISOString().slice(0, 10);
        const fileName = `rental-records-${now}.xlsx`;
        const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        return res.send(buffer);
    });
});

app.post('/api/rentals', (req, res) => {
    const id = uuidv4();
    const c = calc(req.body);
    const now = new Date().toISOString();
    const addJson = JSON.stringify(Array.isArray(req.body.otherAdditions) ? req.body.otherAdditions : []);
    const dedJson = JSON.stringify(Array.isArray(req.body.otherDeductions) ? req.body.otherDeductions : []);
    db.run(`INSERT INTO rentals (id, clientName, clientPhone, clientAddress, clientNIC, vehicle, rentalDate, rentalEndDate, days, dayRate, dayAmount, depositPaid, startMileage, endMileage, allocatedKm, actualKm, extraKm, extraKmRate, extraKmCharge, depositRemaining, otherAdditions, otherDeductions, additionsTotal, deductionsTotal, status, createdAt, updatedAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id, req.body.clientName, req.body.clientPhone, req.body.clientAddress, req.body.clientNIC, req.body.vehicle,
         req.body.rentalDate, req.body.rentalEndDate, c.days, req.body.dayRate, c.dayAmount, req.body.depositPaid,
         req.body.startMileage, req.body.endMileage, c.allocatedKm, c.actualKm, c.extraKm, req.body.extraKmRate, c.extraKmCharge, c.depositRemaining,
         addJson, dedJson, c.additionsTotal, c.deductionsTotal, 'active', now, now],
        () => res.json({ id, ...req.body, ...c }));
});

app.put('/api/rentals/:id', (req, res) => {
    const c = calc(req.body);
    const now = new Date().toISOString();
    const addJson = JSON.stringify(Array.isArray(req.body.otherAdditions) ? req.body.otherAdditions : []);
    const dedJson = JSON.stringify(Array.isArray(req.body.otherDeductions) ? req.body.otherDeductions : []);
    db.run(`UPDATE rentals SET clientName=?, clientPhone=?, clientAddress=?, clientNIC=?, vehicle=?, rentalDate=?, rentalEndDate=?, days=?, dayRate=?, dayAmount=?, depositPaid=?, startMileage=?, endMileage=?, allocatedKm=?, actualKm=?, extraKm=?, extraKmRate=?, extraKmCharge=?, depositRemaining=?, otherAdditions=?, otherDeductions=?, additionsTotal=?, deductionsTotal=?, updatedAt=? WHERE id=?`,
        [req.body.clientName, req.body.clientPhone, req.body.clientAddress, req.body.clientNIC, req.body.vehicle,
         req.body.rentalDate, req.body.rentalEndDate, c.days, req.body.dayRate, c.dayAmount, req.body.depositPaid,
         req.body.startMileage, req.body.endMileage, c.allocatedKm, c.actualKm, c.extraKm, req.body.extraKmRate, c.extraKmCharge, c.depositRemaining,
         addJson, dedJson, c.additionsTotal, c.deductionsTotal, now, req.params.id],
        () => res.json({ id: req.params.id, ...req.body, ...c }));
});

app.delete('/api/rentals/:id', (req, res) => {
    db.run('DELETE FROM rentals WHERE id = ?', [req.params.id], () => res.json({ ok: true }));
});

app.get('/api/statistics', (req, res) => {
    db.all('SELECT * FROM rentals', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const r2 = rows || [];
        const vehicleMap = {};
        const stats = { totalRentals: r2.length, totalDayAmount: 0, totalExtraCharges: 0, totalAdditions: 0, totalDeductions: 0, totalEarned: 0, vehicles: [] };
        r2.forEach(r => {
            const dayAmt = parseFloat(r.dayAmount) || 0;
            const exCharge = parseFloat(r.extraKmCharge) || 0;
            const addAmt = parseFloat(r.additionsTotal) || parseFloat(r.otherChargesTotal) || 0;
            const dedAmt = parseFloat(r.deductionsTotal) || 0;
            const earned = dayAmt + exCharge + addAmt - dedAmt;
            stats.totalDayAmount += dayAmt;
            stats.totalExtraCharges += exCharge;
            stats.totalAdditions += addAmt;
            stats.totalDeductions += dedAmt;
            stats.totalEarned += earned;
            const vKey = (r.vehicle || 'Unknown').trim();
            if (!vehicleMap[vKey]) vehicleMap[vKey] = { vehicle: vKey, rentals: 0, dayAmount: 0, extraCharges: 0, additions: 0, deductions: 0, earned: 0 };
            vehicleMap[vKey].rentals += 1;
            vehicleMap[vKey].dayAmount += dayAmt;
            vehicleMap[vKey].extraCharges += exCharge;
            vehicleMap[vKey].additions += addAmt;
            vehicleMap[vKey].deductions += dedAmt;
            vehicleMap[vKey].earned += earned;
        });
        stats.vehicles = Object.values(vehicleMap).sort((a, b) => b.earned - a.earned);
        res.json(stats);
    });
});

app.get('/api/rentals/:id/pdf', (req, res) => {
    db.get('SELECT * FROM rentals WHERE id = ?', [req.params.id], (err, r) => {
        if (!r) return res.status(404).json({ error: 'Not found' });
        const doc = new PDFDocument({ size: 'A4', margin: 30, autoFirstPage: true });
        const safeClientName = String(r.clientName || 'client').replace(/[^a-z0-9\-_ ]/gi, '').trim() || 'client';
        const fn = `Rental Receipt-${safeClientName}.pdf`;
        const fp = path.join(__dirname, 'pdfs', fn);
        if (!fs.existsSync(path.join(__dirname, 'pdfs'))) fs.mkdirSync(path.join(__dirname, 'pdfs'));
        const stream = fs.createWriteStream(fp);
        doc.pipe(stream);

        const money = (value) => `Rs. ${Number(value || 0).toFixed(2)}`;
        const fmtDate = (value) => {
            const date = new Date(value);
            return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
        };
        const line = (label, value) => {
            doc.moveDown(0.2);
            doc.font('Helvetica-Bold').fillColor('#111827').fontSize(10).text(`${label}:`, { continued: true });
            doc.font('Helvetica').fillColor('#1f2937').fontSize(10).text(` ${value ?? '-'}`);
        };

        const left = 30;
        const top = 25;
        const pageWidth = doc.page.width;
        const usableWidth = pageWidth - left * 2;
        const logoPath = path.join(__dirname, 'public', 'assets', 'logo22 w-o bg.png');

        // Header: black background (76pt tall)
        doc.roundedRect(left, top, usableWidth, 76, 8).fill('#0d0d0d');
        // Red accent stripe at bottom of header
        doc.rect(left, top + 70, usableWidth, 6).fill('#dc2626');

        // Logo
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, left + 10, top + 6, { fit: [62, 62] });
        }

        // Company name & subtitle
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(20).text('JT CAR RENTALS', left + 84, top + 14);
        doc.fillColor('#ef4444').font('Helvetica-Bold').fontSize(9).text('RENTAL RECEIPT & PAYMENT SUMMARY', left + 84, top + 40);

        // Receipt info — top-right
        doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text(`Receipt No: ${String(r.id || '').slice(0, 8).toUpperCase() || '-'}`, left + usableWidth - 170, top + 16, { width: 170, align: 'right' });
        doc.fillColor('#d1d5db').font('Helvetica').fontSize(9).text(`Issued: ${fmtDate(r.createdAt)}`, left + usableWidth - 170, top + 34, { width: 170, align: 'right' });

        let y = top + 92;

        // Section header helper — 24pt tall
        const sectionHeader = (label) => {
            doc.roundedRect(left, y, usableWidth, 24, 4).fill('#991b1b');
            doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text(label, left + 12, y + 7);
            y += 30;
        };

        sectionHeader('Customer Details');
        doc.y = y + 6;
        line('Name', r.clientName);
        line('Phone', r.clientPhone);
        line('NIC', r.clientNIC);
        line('Address', r.clientAddress);

        y = doc.y + 14;
        sectionHeader('Rental and Vehicle Details');
        doc.y = y;
        line('Vehicle', r.vehicle);
        line('Rental Start', fmtDate(r.rentalDate));
        line('Rental End', fmtDate(r.rentalEndDate));
        line('Total Days', r.days);
        line('Start Mileage', `${r.startMileage} km`);
        line('End Mileage', `${r.endMileage} km`);
        line('Actual Mileage Used', `${r.actualKm} km`);

        y = doc.y + 8;
        sectionHeader('Charges Breakdown');

        const rowX = left;
        const rowW = usableWidth;
        const valueX = rowX + rowW - 170;
        const drawChargeRow = (label, value, bgColor = '#ffffff') => {
            doc.roundedRect(rowX, y, rowW, 20, 3).fill(bgColor);
            doc.fillColor('#111827').font('Helvetica').fontSize(9).text(label, rowX + 8, y + 6, { width: rowW - 190 });
            doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text(value, valueX, y + 6, { width: 165, align: 'right' });
            y += 23;
        };

        drawChargeRow(`Included Mileage (${r.days} x 100 km)`, `${r.allocatedKm} km`, '#f9fafb');
        drawChargeRow(`Extra Mileage (${r.extraKm} km x ${money(r.extraKmRate)})`, `${r.extraKm} km`, '#ffffff');
        drawChargeRow(`Day Rate x ${r.days} day(s)`, `${money(r.dayRate)} x ${r.days}`, '#f9fafb');
        drawChargeRow('Day Amount', money(r.dayAmount));
        drawChargeRow('Extra Mileage Charge', money(r.extraKmCharge), '#f9fafb');
        const parseArr = (v) => { try { return JSON.parse(v || '[]'); } catch(e) { return []; } };
        const additionsArr = r.otherAdditions ? parseArr(r.otherAdditions) : (r.otherCharges ? parseArr(r.otherCharges) : []);
        const deductionsArr = r.otherDeductions ? parseArr(r.otherDeductions) : [];
        if (additionsArr.length > 0) {
            additionsArr.forEach((c, i) => {
                drawChargeRow(`+ ${c.label || `Addition ${i + 1}`}`, money(c.amount), i % 2 === 0 ? '#f0fdf4' : '#dcfce7');
            });
            drawChargeRow('Additions Total', money(r.additionsTotal || 0), '#bbf7d0');
        }
        if (deductionsArr.length > 0) {
            const dedReasons = deductionsArr.map((c, i) => c.label || `Deduction ${i + 1}`).join(', ');
            drawChargeRow(`Total Deductions (${dedReasons})`, `- ${money(r.deductionsTotal || 0)}`, '#fef3c7');
        }
        drawChargeRow('Deposit Paid', money(r.depositPaid), '#ffffff');

        y += 6;
        const balLabel = Number(r.depositRemaining) >= 0 ? 'Balance / Refund' : 'Amount Due (Customer Owes)';
        const balColor = Number(r.depositRemaining) >= 0 ? '#16a34a' : '#dc2626';
        doc.roundedRect(left, y, usableWidth, 34, 6).fill('#111827');
        doc.fillColor('#f9fafb').font('Helvetica-Bold').fontSize(11).text(balLabel, left + 12, y + 11);
        const balDisplay = Number(r.depositRemaining) < 0 ? money(Math.abs(Number(r.depositRemaining))) : money(r.depositRemaining);
        doc.fillColor(balColor).font('Helvetica-Bold').fontSize(13).text(balDisplay, left + usableWidth - 170, y + 10, { width: 160, align: 'right' });

        y += 46;
        doc.strokeColor('#dc2626').lineWidth(1).moveTo(left, y).lineTo(left + usableWidth, y).stroke();
        y += 10;
        doc.fillColor('#6b7280').font('Helvetica').fontSize(8).text('This receipt summarizes the rental information and financial breakdown. Please review all details and contact JT Car Rentals for any corrections.', left, y, { width: usableWidth });
        doc.fillColor('#dc2626').font('Helvetica-Bold').fontSize(9).text('Thank you for choosing JT Car Rentals.', left, y + 18);

        doc.end();
        stream.on('finish', () => { res.download(fp, fn); setTimeout(() => fs.unlink(fp, ()=>{}), 1000); });
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`\n🚗 JT Car Rentals on http://localhost:${PORT}\n📱 Mobile: http://<YOUR_IP>:${PORT}\n`));
