const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'rentals.db');
const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS rentals (
        id TEXT PRIMARY KEY,
        clientName TEXT NOT NULL,
        clientPhone TEXT NOT NULL,
        clientAddress TEXT NOT NULL,
        clientNIC TEXT NOT NULL,
        vehicle TEXT NOT NULL,
        rentalDate TEXT NOT NULL,
        rentalEndDate TEXT NOT NULL,
        days INTEGER NOT NULL,
        dayRate REAL NOT NULL,
        dayAmount REAL NOT NULL,
        depositPaid REAL NOT NULL,
        startMileage INTEGER NOT NULL,
        endMileage INTEGER NOT NULL,
        allocatedKm INTEGER NOT NULL,
        actualKm INTEGER NOT NULL,
        extraKm INTEGER NOT NULL,
        extraKmRate REAL NOT NULL,
        extraKmCharge REAL NOT NULL,
        depositRemaining REAL NOT NULL,
        otherCharges TEXT DEFAULT '[]',
        otherChargesTotal REAL DEFAULT 0,
        status TEXT DEFAULT 'active',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL
    )`, () => {
        console.log('✅ Database initialized');
        db.close();
    });
});
