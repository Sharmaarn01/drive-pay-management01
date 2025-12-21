import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MapPin, 
  Calendar, 
  Wallet, 
  LayoutDashboard, 
  History,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Trash2,
  X,
  TrendingUp,
  Route as RouteIcon,
  Search,
  ChevronDown,
  Database,
  Info,
  ExternalLink
} from 'lucide-react';

// FIX: Import the configured client from your local file
import { supabase } from './services/supabase';

import { 
  Driver, 
  Route, 
  Trip, 
  Settlement, 
  PaymentPreference
} from './types';

// --- Reusable UI Components ---

const StatCard = ({ title, value, icon: Icon, color, subValue }: { title: string, value: string | number, icon: any, color: string, subValue?: string }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 transition-transform hover:scale-[1.02]">
    <div className={`p-3 rounded-xl ${color}`}>
      <Icon className="w-6 h-6 text-white" />
    </div>
    <div className="flex-1">
      <p className="text-sm text-slate-500 font-medium">{title}</p>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-slate-900">{value}</p>
        {subValue && <span className="text-xs text-slate-400">{subValue}</span>}
      </div>
    </div>
  </div>
);

const Modal = ({ title, isOpen, onClose, children }: { title: string, isOpen: boolean, onClose: () => void, children: React.ReactNode }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-900">{title}</h3>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
};

// --- Main App Component ---

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'drivers' | 'routes' | 'trips' | 'settlements'>('dashboard');
  
  // Data State
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // UI State
  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showRouteModal, setShowRouteModal] = useState(false);
  const [showConfigWarning, setShowConfigWarning] = useState(!supabase);
  
  // Form States
  const [newDriver, setNewDriver] = useState<Partial<Driver>>({ preference: PaymentPreference.SPLIT });
  const [newRoute, setNewRoute] = useState<Partial<Route>>({ battaRate: 0, salaryRate: 0 });
  const [tripForm, setTripForm] = useState({ driverId: '', routeId: '' });

  // Initial Data Fetch
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      
      if (!supabase) {
        // Fallback to local storage
        const savedDrivers = localStorage.getItem('drive_pay_drivers');
        const savedRoutes = localStorage.getItem('drive_pay_routes');
        const savedTrips = localStorage.getItem('drive_pay_trips');
        const savedSettlements = localStorage.getItem('drive_pay_settlements');

        setDrivers(savedDrivers ? JSON.parse(savedDrivers) : []);
        setRoutes(savedRoutes ? JSON.parse(savedRoutes) : []);
        setTrips(savedTrips ? JSON.parse(savedTrips) : []);
        setSettlements(savedSettlements ? JSON.parse(savedSettlements) : []);
        setIsLoading(false);
        return;
      }

      try {
        const [dRes, rRes, tRes, sRes] = await Promise.all([
          supabase.from('drivers').select('*'),
          supabase.from('routes').select('*'),
          supabase.from('trips').select('*'),
          supabase.from('settlements').select('*').order('timestamp', { ascending: false })
        ]);

        if (dRes.data) setDrivers(dRes.data);
        if (rRes.data) setRoutes(rRes.data);
        if (tRes.data) setTrips(tRes.data);
        if (sRes.data) setSettlements(sRes.data);
      } catch (error) {
        console.error("Error fetching from Supabase:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Local Storage synchronization (only if Supabase is missing)
  useEffect(() => {
    if (!supabase) {
      localStorage.setItem('drive_pay_drivers', JSON.stringify(drivers));
      localStorage.setItem('drive_pay_routes', JSON.stringify(routes));
      localStorage.setItem('drive_pay_trips', JSON.stringify(trips));
      localStorage.setItem('drive_pay_settlements', JSON.stringify(settlements));
    }
  }, [drivers, routes, trips, settlements]);

  // Calculations
  const calculatePending = (driverId: string) => {
    const driver = drivers.find(d => d.id === driverId);
    if (!driver) return { batta: 0, salary: 0 };

    let pendingBatta = 0;
    let pendingSalary = 0;

    const driverTrips = trips.filter(t => t.driverId === driverId);

    driverTrips.forEach(trip => {
      const route = routes.find(r => r.id === trip.routeId);
      if (!route) return;
      const totalValue = route.battaRate + route.salaryRate;

      if (!trip.settledWeekly) {
        if (driver.preference === PaymentPreference.ALL_BATTA) pendingBatta += totalValue;
        else if (driver.preference === PaymentPreference.SPLIT) pendingBatta += route.battaRate;
      }
      if (!trip.settledMonthly) {
        if (driver.preference === PaymentPreference.ALL_SALARY) pendingSalary += totalValue;
        else if (driver.preference === PaymentPreference.SPLIT) pendingSalary += route.salaryRate;
      }
    });

    return { batta: pendingBatta, salary: pendingSalary };
  };

  // CRUD Handlers
  const addDriver = async () => {
    if (!newDriver.name || !newDriver.vehicleId) return;
    const driver: Driver = {
      id: Math.random().toString(36).substr(2, 9),
      name: newDriver.name,
      vehicleId: newDriver.vehicleId,
      preference: newDriver.preference || PaymentPreference.SPLIT
    };
    
    if (supabase) {
      const { error } = await supabase.from('drivers').insert([driver]);
      if (error) return console.error("Supabase Error:", error);
    }
    
    setDrivers([...drivers, driver]);
    setNewDriver({ preference: PaymentPreference.SPLIT });
    setShowDriverModal(false);
  };

  const removeDriver = async (id: string) => {
    if (window.confirm("Remove this driver? This action cannot be undone.")) {
      if (supabase) {
        const { error } = await supabase.from('drivers').delete().eq('id', id);
        if (error) return console.error("Supabase Error:", error);
      }
      setDrivers(drivers.filter(d => d.id !== id));
    }
  };

  const addRoute = async () => {
    if (!newRoute.from || !newRoute.to) return;
    const route: Route = {
      id: Math.random().toString(36).substr(2, 9),
      from: newRoute.from,
      to: newRoute.to,
      battaRate: Number(newRoute.battaRate),
      salaryRate: Number(newRoute.salaryRate)
    };
    
    if (supabase) {
      const { error } = await supabase.from('routes').insert([route]);
      if (error) return console.error("Supabase Error:", error);
    }
    
    setRoutes([...routes, route]);
    setNewRoute({ battaRate: 0, salaryRate: 0 });
    setShowRouteModal(false);
  };

  const removeRoute = async (id: string) => {
    if (supabase) {
      const { error } = await supabase.from('routes').delete().eq('id', id);
      if (error) return console.error("Supabase Error:", error);
    }
    setRoutes(routes.filter(r => r.id !== id));
  };

  const logTrip = async () => {
    if (!tripForm.driverId || !tripForm.routeId) return;
    const driver = drivers.find(d => d.id === tripForm.driverId);
    if (!driver) return;

    const newTrip: Trip = {
      id: Math.random().toString(36).substr(2, 9),
      driverId: tripForm.driverId,
      routeId: tripForm.routeId,
      timestamp: Date.now(),
      vehicleId: driver.vehicleId,
      settledWeekly: false,
      settledMonthly: false
    };

    if (supabase) {
      const { error } = await supabase.from('trips').insert([newTrip]);
      if (error) return console.error("Supabase Error:", error);
    }

    setTrips([newTrip, ...trips]);
    setTripForm({ ...tripForm, routeId: '' });
  };

  const settlePayment = async (driverId: string, type: 'WEEKLY' | 'MONTHLY') => {
    const { batta, salary } = calculatePending(driverId);
    const amount = type === 'WEEKLY' ? batta : salary;
    if (amount === 0) return;

    const targetTrips = trips.filter(t => 
      t.driverId === driverId && (type === 'WEEKLY' ? !t.settledWeekly : !t.settledMonthly)
    );
    const tripIds = targetTrips.map(t => t.id);

    const newSettlement: Settlement = {
      id: `S-${type.charAt(0)}-${Date.now()}`,
      driverId,
      type,
      amount,
      timestamp: Date.now(),
      tripIds
    };

    if (supabase) {
      const updateKey = type === 'WEEKLY' ? 'settledWeekly' : 'settledMonthly';
      const { error: tErr } = await supabase
          .from('trips')
          .update({ [updateKey]: true })
          .in('id', tripIds);

      const { error: sErr } = await supabase.from('settlements').insert([newSettlement]);

      if (tErr || sErr) return console.error("Supabase Error:", tErr || sErr);
    }

    setSettlements([newSettlement, ...settlements]);
    setTrips(trips.map(t => 
      tripIds.includes(t.id) 
        ? (type === 'WEEKLY' ? { ...t, settledWeekly: true } : { ...t, settledMonthly: true }) 
        : t
    ));
  };

  const totalPayout = settlements.reduce((acc, s) => acc + s.amount, 0);
  const totalPendingBatta = drivers.reduce((acc, d) => acc + calculatePending(d.id).batta, 0);
  const totalPendingSalary = drivers.reduce((acc, d) => acc + calculatePending(d.id).salary, 0);

  if (isLoading) {
      return (
          <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
              <Database className="w-12 h-12 text-indigo-600 animate-pulse mb-4" />
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs">Syncing Management Data...</p>
          </div>
      )
  }

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-[#f8fafc]">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-900 text-white p-6 flex flex-col shrink-0">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg shadow-indigo-500/20">
            <TrendingUp className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-black tracking-tight uppercase">DRIVE PAY</h1>
        </div>

        <nav className="flex-1 space-y-1">
          {[
            { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
            { id: 'drivers', icon: Users, label: 'Drivers' },
            { id: 'routes', icon: RouteIcon, label: 'Routes' },
            { id: 'trips', icon: MapPin, label: 'Log Trip' },
            { id: 'settlements', icon: History, label: 'Settlements' },
          ].map((item) => (
            <button 
              key={item.id}
              onClick={() => setActiveTab(item.id as any)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                activeTab === item.id 
                  ? 'bg-white/10 text-white font-bold shadow-sm' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-indigo-400' : ''}`} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        
        <div className="mt-auto pt-4 border-t border-white/10 flex flex-col items-center gap-2">
            <div className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${supabase ? 'text-emerald-500' : 'text-amber-500'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${supabase ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                {supabase ? 'Cloud Synchronized' : 'Local Storage Mode'}
            </div>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6 md:p-10">
          
          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <header>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">Fleet Overview</h2>
                <p className="text-slate-500 font-medium">Real-time compensation monitoring.</p>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard title="Disbursed Funds" value={`₹${totalPayout}`} icon={Wallet} color="bg-emerald-600" subValue="All time" />
                <StatCard title="Due: Weekly Batta" value={`₹${totalPendingBatta}`} icon={Calendar} color="bg-indigo-600" subValue="Next run" />
                <StatCard title="Due: Monthly Salary" value={`₹${totalPendingSalary}`} icon={Calendar} color="bg-amber-500" subValue="Month end" />
              </div>

              <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <h3 className="text-lg font-bold text-slate-900">Active Payroll Cycles</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest">Driver</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Weekly (Batta)</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Monthly (Salary)</th>
                        <th className="px-6 py-4 text-xs font-black text-slate-400 uppercase tracking-widest text-right">Settlement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {drivers.map(driver => {
                        const { batta, salary } = calculatePending(driver.id);
                        if (batta === 0 && salary === 0) return null;
                        return (
                          <tr key={driver.id} className="group hover:bg-slate-50/80 transition-all">
                            <td className="px-6 py-4 font-bold text-slate-900">
                                <div>{driver.name}</div>
                                <div className="text-[10px] text-slate-400 font-bold uppercase">{driver.preference.replace('_', ' ')}</div>
                            </td>
                            <td className="px-6 py-4 text-right font-black text-indigo-600">₹{batta}</td>
                            <td className="px-6 py-4 text-right font-black text-amber-600">₹{salary}</td>
                            <td className="px-6 py-4 text-right space-x-2">
                              <button onClick={() => settlePayment(driver.id, 'WEEKLY')} disabled={batta === 0} className="px-4 py-2 rounded-xl text-[10px] font-black bg-indigo-600 text-white disabled:bg-slate-100 hover:bg-indigo-700 transition-all shadow-sm uppercase">Pay Weekly</button>
                              <button onClick={() => settlePayment(driver.id, 'MONTHLY')} disabled={salary === 0} className="px-4 py-2 rounded-xl text-[10px] font-black bg-amber-600 text-white disabled:bg-slate-100 hover:bg-amber-700 transition-all shadow-sm uppercase">Pay Monthly</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'drivers' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
              <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Driver Fleet</h2>
                  <p className="text-slate-500 font-medium">Add or remove drivers from the active roster.</p>
                </div>
                <button onClick={() => setShowDriverModal(true)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all">
                  <Plus className="w-5 h-5" /> New Driver
                </button>
              </header>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {drivers.map(driver => (
                  <div key={driver.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xl">{driver.name.charAt(0)}</div>
                      <div>
                          <h4 className="text-lg font-black text-slate-900">{driver.name}</h4>
                          <p className="text-sm font-bold text-slate-400 uppercase tracking-tighter">{driver.vehicleId}</p>
                      </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black text-slate-400 bg-slate-50 px-2 py-1 rounded-md uppercase tracking-widest">{driver.preference.replace('_', ' ')}</span>
                          <button onClick={() => removeDriver(driver.id)} className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 className="w-5 h-5" /></button>
                      </div>
                  </div>
                  ))}
              </div>

              <Modal title="Register Driver" isOpen={showDriverModal} onClose={() => setShowDriverModal(false)}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2">Driver Name</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={newDriver.name || ''} onChange={e => setNewDriver({...newDriver, name: e.target.value})} placeholder="e.g. John Doe" />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-slate-400 uppercase mb-2">Vehicle Plate</label>
                    <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl outline-none" value={newDriver.vehicleId || ''} onChange={e => setNewDriver({...newDriver, vehicleId: e.target.value})} placeholder="e.g. MH 12 AB 1234" />
                  </div>
                  <button onClick={addDriver} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg">Add to Fleet</button>
                </div>
              </Modal>
            </div>
          )}

          {activeTab === 'routes' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500">
               <header className="flex justify-between items-end">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Routes</h2>
                </div>
                <button onClick={() => setShowRouteModal(true)} className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 shadow-lg">
                  <Plus className="w-5 h-5" /> Define Route
                </button>
              </header>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {routes.map(route => (
                <div key={route.id} className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-all">
                    <div className="flex items-center justify-between mb-4 font-black">
                      <span>{route.from} → {route.to}</span>
                      <button onClick={() => removeRoute(route.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <div className="flex gap-4 text-xs font-black text-slate-400 uppercase">
                      <div className="bg-slate-50 p-3 rounded-2xl flex-1">Weekly: ₹{route.battaRate}</div>
                      <div className="bg-slate-50 p-3 rounded-2xl flex-1">Monthly: ₹{route.salaryRate}</div>
                    </div>
                </div>
                ))}
              </div>

              <Modal title="Route Configuration" isOpen={showRouteModal} onClose={() => setShowRouteModal(false)}>
                <div className="space-y-4">
                  <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Origin" value={newRoute.from || ''} onChange={e => setNewRoute({...newRoute, from: e.target.value})} />
                  <input className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Destination" value={newRoute.to || ''} onChange={e => setNewRoute({...newRoute, to: e.target.value})} />
                  <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Weekly Rate" onChange={e => setNewRoute({...newRoute, battaRate: Number(e.target.value)})} />
                  <input type="number" className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" placeholder="Monthly Rate" onChange={e => setNewRoute({...newRoute, salaryRate: Number(e.target.value)})} />
                  <button onClick={addRoute} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black">Create Path</button>
                </div>
              </Modal>
            </div>
          )}

          {activeTab === 'trips' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <header><h2 className="text-4xl font-black text-slate-900 tracking-tight">Log Operation</h2></header>
              <div className="bg-white p-8 rounded-[40px] shadow-2xl border border-slate-100 max-w-2xl mx-auto space-y-6">
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-3">Driver</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" onChange={e => setTripForm({...tripForm, driverId: e.target.value})}>
                    <option value="">Select Driver</option>
                    {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-400 uppercase mb-3">Route</label>
                  <select className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl" onChange={e => setTripForm({...tripForm, routeId: e.target.value})}>
                    <option value="">Select Route</option>
                    {routes.map(r => <option key={r.id} value={r.id}>{r.from} → {r.to}</option>)}
                  </select>
                </div>
                <button onClick={logTrip} disabled={!tripForm.driverId || !tripForm.routeId} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-lg disabled:bg-slate-100 shadow-xl transition-all">Log Trip</button>
              </div>
            </div>
          )}

          {activeTab === 'settlements' && (
            <div className="space-y-8 animate-in fade-in slide-in-from-right-4">
              <header><h2 className="text-4xl font-black text-slate-900 tracking-tight">History</h2></header>
              {settlements.map(s => (
                <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-center justify-between">
                  <div className="font-bold">{drivers.find(d => d.id === s.driverId)?.name}</div>
                  <div className="text-right"><div className="text-2xl font-black">₹{s.amount}</div><div className="text-[10px] text-emerald-500 font-black">SETTLED</div></div>
                </div>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  );
};

export default App;