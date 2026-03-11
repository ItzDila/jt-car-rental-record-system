const { useState, useEffect } = React;

const API = window.location.origin + '/api';

function App() {
    const [tab, setTab] = useState('form');
    const [rentals, setRentals] = useState([]);
    const [stats, setStats] = useState(null);
    const [edit, setEdit] = useState(null);
    const [search, setSearch] = useState('');
    const [form, setForm] = useState({
        clientName: '', clientPhone: '', clientAddress: '', clientNIC: '', vehicle: '',
        rentalDate: '', rentalEndDate: '', dayRate: '', startMileage: '', endMileage: '', extraKmRate: '', depositPaid: ''
    });
    const [calc, setCalc] = useState({
        days: 0, dayAmount: 0, allocatedKm: 0, actualKm: 0, extraKm: 0, extraKmCharge: 0, additionsTotal: 0, deductionsTotal: 0, depositRemaining: 0
    });
    const [otherAdditions, setOtherAdditions] = useState([]);
    const [otherDeductions, setOtherDeductions] = useState([]);

    useEffect(() => {
        loadRentals();
        loadStats();
    }, []);

    const calcDays = (s, e) => Math.max(1, Math.ceil((new Date(e) - new Date(s)) / (1000 * 60 * 60 * 24)));

    const updateCalc = (f = form, oa = otherAdditions, od = otherDeductions) => {
        const days = calcDays(f.rentalDate, f.rentalEndDate);
        const dayAmt = days * parseFloat(f.dayRate || 0);
        const allocKm = days * 100;
        const actKm = parseInt(f.endMileage || 0) - parseInt(f.startMileage || 0);
        const exKm = Math.max(0, actKm - allocKm);
        const exCharge = exKm * parseFloat(f.extraKmRate || 0);
        const deposit = parseFloat(f.depositPaid || 0);
        const addTotal = oa.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
        const dedTotal = od.reduce((sum, c) => sum + (parseFloat(c.amount) || 0), 0);
        const total = dayAmt + exCharge + addTotal - dedTotal;
        const depRem = deposit - total;

        setCalc({ days, dayAmount: dayAmt, allocatedKm: allocKm, actualKm: actKm, extraKm: exKm, extraKmCharge: exCharge, additionsTotal: addTotal, deductionsTotal: dedTotal, depositRemaining: depRem });
    };

    const handleChange = (e) => {
        const f = { ...form, [e.target.name]: e.target.value };
        setForm(f);
        updateCalc(f, otherAdditions, otherDeductions);
    };

    const addOtherAddition = () => setOtherAdditions(oa => [...oa, { label: '', amount: '' }]);
    const removeOtherAddition = (i) => {
        const oa = otherAdditions.filter((_, idx) => idx !== i);
        setOtherAdditions(oa);
        updateCalc(form, oa, otherDeductions);
    };
    const handleOtherAdditionChange = (i, field, value) => {
        const oa = otherAdditions.map((c, idx) => idx === i ? { ...c, [field]: value } : c);
        setOtherAdditions(oa);
        updateCalc(form, oa, otherDeductions);
    };
    const addOtherDeduction = () => setOtherDeductions(od => [...od, { label: '', amount: '' }]);
    const removeOtherDeduction = (i) => {
        const od = otherDeductions.filter((_, idx) => idx !== i);
        setOtherDeductions(od);
        updateCalc(form, otherAdditions, od);
    };
    const handleOtherDeductionChange = (i, field, value) => {
        const od = otherDeductions.map((c, idx) => idx === i ? { ...c, [field]: value } : c);
        setOtherDeductions(od);
        updateCalc(form, otherAdditions, od);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const url = edit ? `${API}/rentals/${edit}` : `${API}/rentals`;
        const method = edit ? 'PUT' : 'POST';
        try {
            await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, otherAdditions, otherDeductions }) });
            resetForm();
            loadRentals();
            loadStats();
            setTab('records');
        } catch (err) { alert('Error: ' + err.message); }
    };

    const loadRentals = async () => {
        try {
            const res = await fetch(`${API}/rentals`);
            if (!res.ok) throw new Error('Server error');
            setRentals(await res.json());
        } catch (err) { console.error('Failed to load rentals:', err); }
    };

    const loadStats = async () => {
        try {
            const res = await fetch(`${API}/statistics`);
            if (!res.ok) throw new Error('Server error');
            setStats(await res.json());
        } catch (err) { console.error('Failed to load stats:', err); }
    };

    const editRental = (r) => {
        const f = {
            clientName: r.clientName, clientPhone: r.clientPhone, clientAddress: r.clientAddress, clientNIC: r.clientNIC,
            vehicle: r.vehicle, rentalDate: r.rentalDate, rentalEndDate: r.rentalEndDate, dayRate: r.dayRate,
            startMileage: r.startMileage, endMileage: r.endMileage, extraKmRate: r.extraKmRate, depositPaid: r.depositPaid
        };
        const oa = r.otherAdditions ? (typeof r.otherAdditions === 'string' ? JSON.parse(r.otherAdditions) : r.otherAdditions) : (r.otherCharges ? (typeof r.otherCharges === 'string' ? JSON.parse(r.otherCharges) : r.otherCharges) : []);
        const od = r.otherDeductions ? (typeof r.otherDeductions === 'string' ? JSON.parse(r.otherDeductions) : r.otherDeductions) : [];
        setForm(f);
        setOtherAdditions(oa);
        setOtherDeductions(od);
        updateCalc(f, oa, od);
        setEdit(r.id);
        setTab('form');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const deleteRental = async (id) => {
        if (confirm('Delete?')) {
            await fetch(`${API}/rentals/${id}`, { method: 'DELETE' });
            loadRentals();
            loadStats();
        }
    };

    const resetForm = () => {
        setForm({ clientName: '', clientPhone: '', clientAddress: '', clientNIC: '', vehicle: '', rentalDate: '', rentalEndDate: '', dayRate: '', startMileage: '', endMileage: '', extraKmRate: '', depositPaid: '' });
        setOtherAdditions([]);
        setOtherDeductions([]);
        setEdit(null);
        setCalc({ days: 0, dayAmount: 0, allocatedKm: 0, actualKm: 0, extraKm: 0, extraKmCharge: 0, additionsTotal: 0, deductionsTotal: 0, depositRemaining: 0 });
    };

    const filtered = rentals.filter(r => r.clientName.toLowerCase().includes(search.toLowerCase()) || r.vehicle.toLowerCase().includes(search.toLowerCase()));

    const tabActive = 'px-4 py-3 font-semibold whitespace-nowrap transition-all duration-200 bg-red-700 text-white border-b-2 border-red-400';
    const tabInactive = 'px-4 py-3 font-semibold whitespace-nowrap transition-all duration-200 bg-zinc-900 text-zinc-300 hover:bg-zinc-800';
    const primaryBtn = 'w-full bg-gradient-to-r from-red-700 to-black hover:from-red-600 hover:to-zinc-900 text-white font-bold py-3 rounded-lg text-lg border border-red-600 shadow-lg transition-all duration-200';
    const neutralBtn = 'bg-zinc-800 hover:bg-zinc-700 text-zinc-100 px-4 py-2 rounded-lg border border-zinc-600 transition-all duration-200';
    const editBtn = 'bg-zinc-800 hover:bg-zinc-700 text-red-300 border border-red-700 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200';
    const pdfBtn = 'bg-red-900 hover:bg-red-800 text-red-100 border border-red-700 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200';
    const deleteBtn = 'bg-black hover:bg-zinc-900 text-red-400 border border-red-600 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200';
    const exportBtn = 'inline-flex items-center bg-red-800 hover:bg-red-700 text-white px-4 py-2 rounded-lg border border-red-600 font-semibold transition-all duration-200';
    const inputBase = 'px-4 py-2 border border-zinc-700 bg-zinc-900 text-zinc-100 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none placeholder-zinc-500';

    return (
        <div className="min-h-screen bg-black text-zinc-100">
            {/* Header */}
            <nav className="bg-gradient-to-r from-red-600 to-black text-white sticky top-0 z-50 shadow-lg">
                <div className="max-w-7xl mx-auto px-4 py-4">
                    <h1 className="text-3xl md:text-4xl font-bold">🚗 JT CAR RENTALS</h1>
                    <p className="text-red-100 text-sm">Rental Management System</p>
                </div>
            </nav>

            {/* Tabs */}
            <div className="bg-zinc-950/95 border-y border-zinc-800 sticky top-16 z-40 shadow-lg backdrop-blur">
                <div className="max-w-7xl mx-auto px-4 flex gap-2 overflow-x-auto">
                    {['form', 'records', 'analytics'].map(t => (
                        <button key={t} onClick={() => setTab(t)} className={tab === t ? tabActive : tabInactive}>
                            {t === 'form' && '📋 New'} {t === 'records' && '📊 Records'} {t === 'analytics' && '📈 Analytics'}
                        </button>
                    ))}
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-4 md:p-6">
                {/* Form */}
                {tab === 'form' && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl p-4 md:p-8 fade">
                        <h2 className="text-3xl font-bold text-red-200 mb-6">{edit ? '✏️ Edit Rental' : '📝 Add New Rental'}</h2>
                        {edit && <button onClick={resetForm} className={`mb-4 ${neutralBtn}`}>Cancel</button>}

                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Customer */}
                            <div className="bg-zinc-900 border-2 border-red-900 rounded-lg p-6">
                                <h3 className="text-lg font-bold text-red-300 mb-4">👤 Customer</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input type="text" name="clientName" placeholder="Full Name" value={form.clientName} onChange={handleChange} required className={inputBase} />
                                    <input type="tel" name="clientPhone" placeholder="Phone" value={form.clientPhone} onChange={handleChange} required className={inputBase} />
                                    <input type="text" name="clientAddress" placeholder="Address" value={form.clientAddress} onChange={handleChange} required className={`${inputBase} md:col-span-2`} />
                                    <input type="text" name="clientNIC" placeholder="NIC" value={form.clientNIC} onChange={handleChange} required className={`${inputBase} md:col-span-2`} />
                                </div>
                            </div>

                            {/* Vehicle */}
                            <div className="bg-zinc-900 border-2 border-red-900 rounded-lg p-6">
                                <h3 className="text-lg font-bold text-red-300 mb-4">🚗 Vehicle</h3>
                                <input type="text" name="vehicle" placeholder="Vehicle Type" value={form.vehicle} onChange={handleChange} required className={`w-full ${inputBase} mb-4`} />
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input type="number" name="startMileage" placeholder="Start KM" value={form.startMileage} onChange={handleChange} required className={inputBase} />
                                    <input type="number" name="endMileage" placeholder="End KM" value={form.endMileage} onChange={handleChange} required className={inputBase} />
                                    <input type="text" disabled value={`Actual: ${calc.actualKm}km`} className="px-4 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-red-300 font-semibold" />
                                </div>
                            </div>

                            {/* Dates */}
                            <div className="bg-zinc-900 border-2 border-red-900 rounded-lg p-6">
                                <h3 className="text-lg font-bold text-red-300 mb-4">📅 Dates</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input type="date" name="rentalDate" value={form.rentalDate} onChange={handleChange} required className={inputBase} />
                                    <input type="date" name="rentalEndDate" value={form.rentalEndDate} onChange={handleChange} required className={inputBase} />
                                    <input type="text" disabled value={`Days: ${calc.days}`} className="px-4 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-red-300 font-semibold" />
                                </div>
                            </div>

                            {/* Charges */}
                            <div className="bg-zinc-900 border-2 border-red-900 rounded-lg p-6">
                                <h3 className="text-lg font-bold text-red-300 mb-4">💰 Charges</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <input type="number" name="dayRate" placeholder="Day Rate" step="0.01" value={form.dayRate} onChange={handleChange} required className={inputBase} />
                                    <input type="text" disabled value={`Day Amt: Rs.${calc.dayAmount.toFixed(2)}`} className="px-4 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-red-300 font-semibold" />
                                    <input type="number" name="extraKmRate" placeholder="Extra Rate" step="0.01" value={form.extraKmRate} onChange={handleChange} required className={inputBase} />
                                    <input type="text" disabled value={`Extra Charge: Rs.${calc.extraKmCharge.toFixed(2)}`} className="px-4 py-2 border border-zinc-700 rounded-lg bg-zinc-800 text-red-300 font-semibold" />
                                    <input type="number" name="depositPaid" placeholder="Deposit" step="0.01" value={form.depositPaid} onChange={handleChange}  className={`${inputBase} md:col-span-2`} />
                                </div>
                            </div>

                            {/* Other Additions */}
                            <div className="bg-zinc-900 border-2 border-blue-900 rounded-lg p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-blue-300">➕ Other Additions</h3>
                                    <button type="button" onClick={addOtherAddition} className="flex items-center gap-2 bg-blue-800 hover:bg-blue-700 text-white px-4 py-2 rounded-lg border border-blue-600 text-sm font-bold transition-all duration-200">＋ Add</button>
                                </div>
                                {otherAdditions.length === 0 ? (
                                    <p className="text-zinc-500 text-sm">No additions. Click ＋ Add to include extra charges (e.g. Fuel, Extra Day).</p>
                                ) : (
                                    <div className="space-y-3">
                                        {otherAdditions.map((c, i) => (
                                            <div key={i} className="flex gap-3 items-center">
                                                <input type="text" placeholder="Description (e.g. Fuel, Extra Day)" value={c.label} onChange={e => handleOtherAdditionChange(i, 'label', e.target.value)} className={`flex-1 ${inputBase}`} />
                                                <input type="number" placeholder="Amount" step="0.01" value={c.amount} onChange={e => handleOtherAdditionChange(i, 'amount', e.target.value)} className={`w-36 ${inputBase}`} />
                                                <button type="button" onClick={() => removeOtherAddition(i)} className="bg-black hover:bg-zinc-900 text-red-400 border border-red-600 px-3 py-2 rounded-lg font-bold transition-all duration-200">✕</button>
                                            </div>
                                        ))}
                                        <p className="text-right text-blue-300 font-semibold text-sm pt-2 border-t border-zinc-700">Additions Total: +Rs.{calc.additionsTotal.toFixed(2)}</p>
                                    </div>
                                )}
                            </div>

                            {/* Other Deductions */}
                            <div className="bg-zinc-900 border-2 border-yellow-900 rounded-lg p-6">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold text-yellow-300">➖ Other Deductions</h3>
                                    <button type="button" onClick={addOtherDeduction} className="flex items-center gap-2 bg-yellow-800 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg border border-yellow-600 text-sm font-bold transition-all duration-200">＋ Add</button>
                                </div>
                                {otherDeductions.length === 0 ? (
                                    <p className="text-zinc-500 text-sm">No deductions. Click ＋ Add to include discounts or deductions (e.g. Discount, Refund).</p>
                                ) : (
                                    <div className="space-y-3">
                                        {otherDeductions.map((c, i) => (
                                            <div key={i} className="flex gap-3 items-center">
                                                <input type="text" placeholder="Description (e.g. Discount, Refund)" value={c.label} onChange={e => handleOtherDeductionChange(i, 'label', e.target.value)} className={`flex-1 ${inputBase}`} />
                                                <input type="number" placeholder="Amount" step="0.01" value={c.amount} onChange={e => handleOtherDeductionChange(i, 'amount', e.target.value)} className={`w-36 ${inputBase}`} />
                                                <button type="button" onClick={() => removeOtherDeduction(i)} className="bg-black hover:bg-zinc-900 text-red-400 border border-red-600 px-3 py-2 rounded-lg font-bold transition-all duration-200">✕</button>
                                            </div>
                                        ))}
                                        <p className="text-right text-yellow-300 font-semibold text-sm pt-2 border-t border-zinc-700">Deductions Total: −Rs.{calc.deductionsTotal.toFixed(2)}</p>
                                    </div>
                                )}
                            </div>

                            {/* Summary */}
                            <div className="bg-gradient-to-r from-zinc-950 to-zinc-900 border-2 border-red-900 rounded-lg p-6">
                                <h3 className="text-lg font-bold text-red-300 mb-4">✅ Summary</h3>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                    <div className="bg-zinc-900 p-4 rounded-lg border border-green-700"><p className="text-xs text-zinc-400">Alloc KM</p><p className="text-2xl font-bold text-green-400">{calc.allocatedKm}</p></div>
                                    <div className="bg-zinc-900 p-4 rounded-lg border border-purple-700"><p className="text-xs text-zinc-400">Extra KM</p><p className="text-2xl font-bold text-purple-400">{calc.extraKm}</p></div>
                                    <div className="bg-zinc-900 p-4 rounded-lg border border-blue-700"><p className="text-xs text-zinc-400">Additions</p><p className="text-2xl font-bold text-blue-400">+Rs.{calc.additionsTotal.toFixed(2)}</p></div>
                                    <div className="bg-zinc-900 p-4 rounded-lg border border-yellow-700"><p className="text-xs text-zinc-400">Deductions</p><p className="text-2xl font-bold text-yellow-400">−Rs.{calc.deductionsTotal.toFixed(2)}</p></div>
                                    <div className={`bg-zinc-900 p-4 rounded-lg border ${calc.depositRemaining >= 0 ? 'border-green-700' : 'border-red-500'}`}>
                                        <p className="text-xs text-zinc-400">Balance</p>
                                        <p className={`text-2xl font-bold ${calc.depositRemaining >= 0 ? 'text-green-400' : 'text-red-500'}`}>Rs.{calc.depositRemaining.toFixed(2)}</p>
                                    </div>
                                </div>
                                {calc.depositRemaining < 0 && (
                                    <div className="mt-4 p-3 bg-yellow-900 border border-yellow-700 rounded-lg">
                                        <p className="text-yellow-200 text-sm font-semibold">⚠️ Customer owes Rs.{Math.abs(calc.depositRemaining).toFixed(2)}</p>
                                        <p className="text-yellow-100 text-xs mt-1">Total: Day Amount (Rs.{calc.dayAmount.toFixed(2)}) + Extra (Rs.{calc.extraKmCharge.toFixed(2)}){calc.additionsTotal > 0 ? ` + Additions (Rs.${calc.additionsTotal.toFixed(2)})` : ''}{calc.deductionsTotal > 0 ? ` − Deductions (Rs.${calc.deductionsTotal.toFixed(2)})` : ''} − Deposit (Rs.{parseFloat(form.depositPaid || 0).toFixed(2)})</p>
                                    </div>
                                )}
                            </div>

                            <button type="submit" className={primaryBtn}>
                                {edit ? '💾 Update' : '✅ Add'} Rental
                            </button>
                        </form>
                    </div>
                )}

                {/* Records */}
                {tab === 'records' && (
                    <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-xl p-4 md:p-8 fade">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                            <h2 className="text-3xl font-bold text-red-200">📊 Records</h2>
                            <a href={`${API}/rentals/export/xlsx`} className={exportBtn}>⬇️ Export XLSX</a>
                        </div>
                        <input type="text" placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className={`w-full ${inputBase} mb-6`} />
                        {filtered.length === 0 ? (
                            <p className="text-center text-zinc-500 py-8">📭 No records</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gradient-to-r from-red-800 to-black text-white">
                                        <tr>
                                            <th className="p-3 text-left">Client</th>
                                            <th className="p-3 text-left">Vehicle</th>
                                            <th className="p-3 text-center">Days</th>
                                            <th className="p-3 text-right">Amount</th>
                                            <th className="p-3 text-right">Deposit</th>
                                            <th className="p-3 text-right">Balance</th>
                                            <th className="p-3 text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filtered.map(r => (
                                            <tr key={r.id} className="border-b border-zinc-800 hover:bg-zinc-900">
                                                <td className="p-3"><div><p className="font-semibold text-zinc-100">{r.clientName}</p><p className="text-xs text-zinc-400">{r.clientPhone}</p></div></td>
                                                <td className="p-3">{r.vehicle}</td>
                                                <td className="p-3 text-center font-semibold">{r.days}</td>
                                                <td className="p-3 text-right">Rs.{parseFloat(r.dayAmount || 0).toFixed(2)}</td>
                                                <td className="p-3 text-right">Rs.{parseFloat(r.depositPaid || 0).toFixed(2)}</td>
                                                <td className={`p-3 text-right font-bold flex flex-col ${parseFloat(r.depositRemaining || 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                    <span>Rs.{parseFloat(r.depositRemaining || 0).toFixed(2)}</span>
                                                    {parseFloat(r.depositRemaining || 0) < 0 && <span className="text-xs text-yellow-300">Need to Pay Rs.{Math.abs(parseFloat(r.depositRemaining || 0)).toFixed(2)}</span>}
                                                </td>
                                                <td className="p-3 text-center"><div className="flex gap-2 justify-center">
                                                    <button onClick={() => editRental(r)} className={editBtn}>✏️ Edit</button>
                                                    <a href={`${API}/rentals/${r.id}/pdf`} className={pdfBtn}>📄 PDF</a>
                                                    <button onClick={() => deleteRental(r.id)} className={deleteBtn}>🗑️ Delete</button>
                                                </div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* Analytics */}
                {tab === 'analytics' && stats && (
                    <div className="fade space-y-6">
                        {/* Summary Cards */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="bg-gradient-to-br from-red-800 to-black text-white p-6 rounded-lg shadow-lg border border-red-900">
                                <p className="text-sm opacity-80">Total Rentals</p>
                                <p className="text-5xl font-bold mt-2">{stats.totalRentals}</p>
                            </div>
                            <div className="bg-gradient-to-br from-green-900 to-black text-white p-6 rounded-lg shadow-lg border border-green-800 md:col-span-2">
                                <p className="text-sm opacity-80">Total Earned</p>
                                <p className="text-5xl font-bold mt-2 text-green-400">Rs.{(stats.totalEarned || 0).toFixed(2)}</p>
                                <p className="text-xs text-zinc-400 mt-2">Day Amount (Rs.{(stats.totalDayAmount || 0).toFixed(2)}) + Extra KM (Rs.{(stats.totalExtraCharges || 0).toFixed(2)}) + Additions (Rs.{(stats.totalAdditions || 0).toFixed(2)}) − Deductions (Rs.{(stats.totalDeductions || 0).toFixed(2)})</p>
                            </div>
                        </div>

                        {/* Per-Vehicle Breakdown */}
                        <div className="bg-zinc-950 border border-zinc-800 rounded-lg shadow-lg p-6">
                            <h3 className="text-2xl font-bold text-red-200 mb-5">🚗 Earnings by Vehicle</h3>
                            {(!stats.vehicles || stats.vehicles.length === 0) ? (
                                <p className="text-zinc-500 text-sm">No data yet.</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="bg-gradient-to-r from-red-900 to-zinc-900 text-zinc-200">
                                                <th className="p-3 text-left">Vehicle</th>
                                                <th className="p-3 text-center">Rentals</th>
                                                <th className="p-3 text-right">Day Amount</th>
                                                <th className="p-3 text-right">Extra KM</th>
                                                <th className="p-3 text-right text-blue-300">Additions</th>
                                                <th className="p-3 text-right text-yellow-300">Deductions</th>
                                                <th className="p-3 text-right font-bold text-green-400">Total Earned</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {stats.vehicles.map((v, i) => (
                                                <tr key={i} className="border-b border-zinc-800 hover:bg-zinc-900">
                                                    <td className="p-3 font-semibold text-zinc-100">{v.vehicle}</td>
                                                    <td className="p-3 text-center text-zinc-300">{v.rentals}</td>
                                                    <td className="p-3 text-right text-zinc-300">Rs.{v.dayAmount.toFixed(2)}</td>
                                                    <td className="p-3 text-right text-zinc-300">Rs.{v.extraCharges.toFixed(2)}</td>
                                                    <td className="p-3 text-right text-blue-400">Rs.{(v.additions || 0).toFixed(2)}</td>
                                                    <td className="p-3 text-right text-yellow-400">Rs.{(v.deductions || 0).toFixed(2)}</td>
                                                    <td className="p-3 text-right font-bold text-green-400">Rs.{v.earned.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-zinc-900 font-bold">
                                                <td className="p-3 text-zinc-100">Total</td>
                                                <td className="p-3 text-center text-zinc-200">{stats.totalRentals}</td>
                                                <td className="p-3 text-right text-zinc-200">Rs.{(stats.totalDayAmount || 0).toFixed(2)}</td>
                                                <td className="p-3 text-right text-zinc-200">Rs.{(stats.totalExtraCharges || 0).toFixed(2)}</td>
                                                <td className="p-3 text-right text-blue-400">Rs.{(stats.totalAdditions || 0).toFixed(2)}</td>
                                                <td className="p-3 text-right text-yellow-400">Rs.{(stats.totalDeductions || 0).toFixed(2)}</td>
                                                <td className="p-3 text-right text-green-400">Rs.{(stats.totalEarned || 0).toFixed(2)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));