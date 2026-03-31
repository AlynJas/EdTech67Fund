import React, { useState, useEffect, useRef } from 'react';
import { 
  Wallet, Users, LayoutDashboard, LogOut, LogIn, PlusCircle, 
  CheckCircle2, Clock, ShieldAlert, Edit, Search, Calendar, 
  X, Bell, MessageSquare, Check, History, Target, PieChart, 
  ArrowUpCircle, ArrowDownCircle, FileText, Image as ImageIcon, 
  BookOpen, QrCode, Loader2, Upload 
} from 'lucide-react';

import { supabase } from './supabaseClient';
// --- ข้อมูลจำลอง (Mock Data) ---

const users = {
  'admin_room': { password: 'password', role: 'admin_room', name: 'ผู้ดูแลเงินห้อง' },
  'admin_trip': { password: 'password', role: 'admin_trip', name: 'ผู้ดูแลฟิวทริป' }
};

// --- ตั้งเป้าหมาย (Targets) ---
const TARGET_ROOM = 15000;
const TARGET_TRIP = 50000;
const STUDENT_TARGET_ROOM = 500; 
const STUDENT_TARGET_TRIP = 1500;

const TERMS = [
  '1/1', '1/2',
  '2/1', '2/2', '2/b2',
  '3/1', '3/b1', '3/2', '3/b2',
  '4/1', '4/b1', '4/2', '4/b2'
];

const formatTermName = (termValue) => {
  if (!termValue) return '';
  const [year, term] = termValue.split('/');
  if (term === 'b1') return `ปี ${year} ปิดเทอม 1`;
  if (term === 'b2') return `ปี ${year} ปิดเทอม 2`;
  return `ปี ${year} เทอม ${term}`;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [currentView, setCurrentView] = useState('overview'); 
  const [activeTab, setActiveTab] = useState('room'); 
  const [selectedTerm, setSelectedTerm] = useState('2/1'); 
  const [transactions, setTransactions] = useState([]); // เปลี่ยนมาใช้ array ว่างตอนเริ่ม
  const [students, setStudents] = useState([]);
  
  // Login State
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Payment Record Modal State
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordTarget, setRecordTarget] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentStep, setPaymentStep] = useState('input');
  const [qrTimeLeft, setQrTimeLeft] = useState(180);
  
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [otherRecordModalOpen, setOtherRecordModalOpen] = useState(false);
  const [otherType, setOtherType] = useState('income');
  const [otherAmount, setOtherAmount] = useState('');
  const [otherDescription, setOtherDescription] = useState('');
  const [otherSlip, setOtherSlip] = useState(null);

  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [currentSlip, setCurrentSlip] = useState(null);

  const [notifications, setNotifications] = useState([]);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyTx, setNotifyTx] = useState(null);
  const [notifyReason, setNotifyReason] = useState('');
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTx, setHistoryTx] = useState(null);

  const [searchQuery, setSearchQuery] = useState(''); 
  const [searchDate, setSearchDate] = useState(''); 
  const [studentSearchQuery, setStudentSearchQuery] = useState(''); 
  const [successMsg, setSuccessMsg] = useState('');

  const paymentTimeoutRef = useRef(null);
  const qrTimerRef = useRef(null);

  // Body Scroll Lock for Modals
  const isAnyModalOpen = recordModalOpen || editModalOpen || otherRecordModalOpen || slipModalOpen || notifyModalOpen || historyModalOpen;
  
  // โหลดข้อมูลจาก Supabase ตอนเปิดเว็บครั้งแรก
  useEffect(() => {
    fetchTransactions();
    fetchStudents();
  }, []);

  const fetchTransactions = async () => {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('timestamp', { ascending: false });
      
    if (data) {
      // แปลงข้อมูลจากฐานข้อมูลให้ชื่อตัวแปรตรงกับที่แอพของคุณใช้
      const formattedData = data.map(tx => ({
        ...tx,
        studentId: tx.student_id,
        studentName: tx.student_name,
        fundType: tx.fund_type,
        recordedBy: tx.recorded_by,
        slipUrl: tx.slip_url
      }));
      setTransactions(formattedData);
    }
  };

  const fetchStudents = async () => {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .order('id', { ascending: true }); // เรียงตามรหัสนักศึกษา
      
    if (data) {
      setStudents(data);
    }
  };

  useEffect(() => {
    if (isAnyModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isAnyModalOpen]);

  useEffect(() => {
    return () => {
      if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
      if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    };
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    let user = users[username];
    if (!user) {
      const student = students.find(s => s.id === username);
      if (student) user = { password: 'password', role: 'student', name: student.name };
    }
    if (user && user.password === password) {
      setCurrentUser({ username, ...user });
      setCurrentView('overview');
      setLoginError('');
      setUsername(''); setPassword('');
    } else {
      setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
    }
  };

  const handleLogout = () => { setCurrentUser(null); setCurrentView('overview'); };

  const openRecordModal = (student) => {
    setRecordTarget(student);
    setAmount('');
    setPaymentStep('input');
    setRecordModalOpen(true);
  };

  const closeRecordModal = () => {
    if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    setRecordModalOpen(false);
    setTimeout(() => setPaymentStep('input'), 300);
  };

  // --- Payment Rules Logic ---
  const getPaymentRules = () => {
    const [year, termStr] = selectedTerm.split('/');
    const isBreak = termStr.startsWith('b');
    
    if (isBreak) {
      if (activeTab === 'room') return { allowed: false, message: 'ไม่มีการเก็บเงินห้องในช่วงปิดเทอม' };
      return { allowed: true, rate: 10, maxAmount: 300, unit: 'วัน', minAmount: 10 }; 
    }
    
    // เทอมปกติ
    if (year === '1' || year === '2') {
      if (activeTab === 'room') return { allowed: true, rate: 10, maxAmount: 180, unit: 'สัปดาห์', minAmount: 10 };
      return { allowed: true, rate: 40, maxAmount: 720, unit: 'สัปดาห์', minAmount: 40 };
    } else { // ปี 3-4
      if (activeTab === 'room') return { allowed: true, rate: 10, maxAmount: 180, unit: 'สัปดาห์', minAmount: 10 };
      return { allowed: true, rate: 90, maxAmount: 1620, unit: 'สัปดาห์', minAmount: 90 };
    }
  };

  const rules = getPaymentRules();
  const parsedAmount = parseFloat(amount) || 0;
  
  const isAmountValid = rules.allowed && parsedAmount >= rules.minAmount && parsedAmount <= rules.maxAmount && (parsedAmount % rules.rate === 0);
  const calculatedUnits = rules.allowed && isAmountValid ? Number((parsedAmount / rules.rate).toFixed(2)) : 0;

  const handleGenerateQR = (e) => {
    e.preventDefault();
    if (!currentUser || !recordTarget || !isAmountValid) return;

    setPaymentStep('qr');
    setQrTimeLeft(180);

    qrTimerRef.current = setInterval(() => {
      setQrTimeLeft((prev) => {
        if (prev <= 1) { clearInterval(qrTimerRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const simulatePaymentReceived = async () => {
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    setPaymentStep('success');
    
    const newTimestamp = new Date().toISOString();
    const historyData = [{ action: 'create', amount: parsedAmount, recordedBy: currentUser.name, timestamp: newTimestamp }];
    
    const newDbTx = {
      type: 'student_payment', 
      student_id: recordTarget.id, 
      student_name: recordTarget.name,
      fund_type: activeTab, 
      term: selectedTerm, 
      amount: parsedAmount, 
      recorded_by: currentUser.name,
      timestamp: newTimestamp, 
      history: historyData
    };

    // ส่งข้อมูลบันทึกลง Supabase
    const { data, error } = await supabase.from('transactions').insert([newDbTx]).select();

    if (data && data.length > 0) {
      // เอาข้อมูลที่เพิ่งเซฟเสร็จมาอัปเดตหน้าจอทันที
      const formattedTx = {
        ...data[0],
        studentId: data[0].student_id,
        studentName: data[0].student_name,
        fundType: data[0].fund_type,
        recordedBy: data[0].recorded_by,
        slipUrl: data[0].slip_url
      };
      setTransactions(prev => [formattedTx, ...prev]);
    }

    setSuccessMsg(`บันทึกการชำระเงินให้ ${recordTarget.name} จำนวน ฿${parsedAmount} เรียบร้อยแล้ว!`);

    paymentTimeoutRef.current = setTimeout(() => {
      closeRecordModal();
      setTimeout(() => setSuccessMsg(''), 4000);
    }, 1500); 
  };

  const handleUploadSlip = (e, txId) => {
    const file = e.target.files[0];
    if (!file) return;
    const slipUrl = URL.createObjectURL(file);
    const updatedTx = transactions.map(t => t.id === txId ? { ...t, slipUrl } : t);
    setTransactions(updatedTx);
    setSuccessMsg('แนบสลิปการโอนเงินสำเร็จ!');
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleRecordOther = async (e) => {
    e.preventDefault();
    if (!currentUser || !otherAmount || !otherDescription) return;
    const newTimestamp = new Date().toISOString();
    const slipUrl = otherSlip ? URL.createObjectURL(otherSlip) : null;
    
    const historyData = [{ action: 'create', amount: parseFloat(otherAmount), description: otherDescription, recordedBy: currentUser.name, timestamp: newTimestamp }];
    
    const newDbTx = {
      type: otherType, 
      description: otherDescription, 
      slip_url: slipUrl, 
      fund_type: activeTab,
      term: selectedTerm, 
      amount: parseFloat(otherAmount), 
      recorded_by: currentUser.name, 
      timestamp: newTimestamp,
      history: historyData
    };

    // ส่งข้อมูลบันทึกลง Supabase
    const { data, error } = await supabase.from('transactions').insert([newDbTx]).select();

    if (data && data.length > 0) {
      const formattedTx = {
         ...data[0], fundType: data[0].fund_type, recordedBy: data[0].recorded_by, slipUrl: data[0].slip_url
      };
      setTransactions([formattedTx, ...transactions]);
    }

    setSuccessMsg(`บันทึก${otherType === 'income' ? 'รายรับ' : 'รายจ่าย'} สำเร็จ!`);
    setOtherRecordModalOpen(false); setOtherAmount(''); setOtherDescription(''); setOtherSlip(null);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editingTx || !editAmount) return;
    const newTimestamp = new Date().toISOString();
    const newAmount = parseFloat(editAmount);
    
    // ดึงประวัติเดิมมาเพิ่มประวัติใหม่
    const currentHistory = editingTx.history || [];
    const historyEntry = { action: 'edit', amount: newAmount, description: editingTx.type !== 'student_payment' ? editDescription : undefined, recordedBy: currentUser.name, timestamp: newTimestamp };
    const updatedHistory = [...currentHistory, historyEntry];

    const updateData = {
      amount: newAmount,
      description: editingTx.type !== 'student_payment' ? editDescription : editingTx.description,
      history: updatedHistory
    };

    // อัปเดตข้อมูลที่แก้ไขกลับไปที่ Supabase
    const { error } = await supabase.from('transactions').update(updateData).eq('id', editingTx.id);

    if (!error) {
      const updatedTx = transactions.map(t => {
        if (t.id === editingTx.id) {
          return { ...t, ...updateData };
        }
        return t;
      });
      setTransactions(updatedTx);
    }

    setEditModalOpen(false); setSuccessMsg('แก้ไขข้อมูลสำเร็จ!'); setTimeout(() => setSuccessMsg(''), 3000);
  };

  const handleNotifySubmit = (e) => {
    e.preventDefault();
    if (!notifyTx || !notifyReason) return;
    const newNotification = {
      id: Date.now(), txId: notifyTx.id, studentName: notifyTx.studentName, fundType: notifyTx.fundType, term: notifyTx.term,
      originalAmount: notifyTx.amount, reason: notifyReason, notifiedBy: currentUser.name, timestamp: new Date().toISOString(), status: 'pending'
    };
    setNotifications([newNotification, ...notifications]);
    setNotifyModalOpen(false); setSuccessMsg('ส่งคำขอแก้ไขไปยังแอดมินเรียบร้อยแล้ว'); setTimeout(() => setSuccessMsg(''), 3000);
  };

  const markNotificationResolved = (id) => setNotifications(notifications.map(n => n.id === id ? { ...n, status: 'resolved' } : n));
  const formatDate = (isoString) => new Date(isoString).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });

  // --- Data Filtering & Calculations ---
  const termTransactions = transactions.filter(t => t.term === selectedTerm);
  const calculateNetTotal = (txs) => txs.reduce((sum, tx) => tx.type === 'expense' ? sum - tx.amount : sum + tx.amount, 0);

  const currentFundTransactions = termTransactions.filter(t => t.fundType === activeTab);
  const totalActiveFund = calculateNetTotal(currentFundTransactions);

  const filteredStudents = students.filter(s => s.name.includes(studentSearchQuery) || s.id.includes(studentSearchQuery));
  const studentsWithSummary = filteredStudents.map(student => {
    const totalPaid = currentFundTransactions.filter(tx => tx.studentId === student.id && tx.type === 'student_payment').reduce((sum, tx) => sum + tx.amount, 0);
    const targetAmount = activeTab === 'room' ? STUDENT_TARGET_ROOM : STUDENT_TARGET_TRIP;
    const remainingAmount = Math.max(0, targetAmount - totalPaid);
    return { ...student, totalPaid, targetAmount, remainingAmount };
  });

  const filteredHistory = currentFundTransactions.filter(tx => {
    const targetName = tx.type === 'student_payment' ? tx.studentName : (tx.description || '');
    const targetId = tx.studentId || '';
    const matchName = targetName.toLowerCase().includes(searchQuery.toLowerCase()) || targetId.includes(searchQuery);
    const matchDate = searchDate ? tx.timestamp.startsWith(searchDate) : true;
    return matchName && matchDate;
  });

  const adminNotifications = notifications.filter(n => n.status === 'pending' && n.term === selectedTerm && currentUser && ((currentUser.role === 'admin_room' && n.fundType === 'room') || (currentUser.role === 'admin_trip' && n.fundType === 'trip')));

  const roomTransactions = termTransactions.filter(t => t.fundType === 'room');
  const tripTransactions = termTransactions.filter(t => t.fundType === 'trip');
  const totalRoomFundOverview = calculateNetTotal(roomTransactions);
  const totalTripFundOverview = calculateNetTotal(tripTransactions);
  const totalAllFunds = totalRoomFundOverview + totalTripFundOverview;
  const totalMembersCount = students.length;

  const roomPercent = Math.min((totalRoomFundOverview / TARGET_ROOM) * 100, 100);
  const tripPercent = Math.min((totalTripFundOverview / TARGET_TRIP) * 100, 100);
  const totalPercent = Math.min((totalAllFunds / (TARGET_ROOM + TARGET_TRIP)) * 100, 100);
  const pRoom = (totalRoomFundOverview / (TARGET_ROOM + TARGET_TRIP)) * 100 || 0;
  const pTrip = (totalTripFundOverview / (TARGET_ROOM + TARGET_TRIP)) * 100 || 0;

  // --- Theme Configuration ---
  const themeRoom = {
    bgActive: 'bg-purple-600 text-white shadow-md', bgHover: 'hover:bg-purple-50', text: 'text-purple-600', icon: 'text-purple-500',
    badge: 'bg-purple-100 text-purple-800', border: 'border-purple-200', gradient: 'bg-gradient-to-r from-purple-500 to-fuchsia-500',
    btnPrimary: 'bg-purple-600 hover:bg-purple-700', lightCard: 'bg-purple-50/50 border-purple-50', donutSlice: '#a855f7',
    progressBar: 'bg-gradient-to-r from-purple-400 to-fuchsia-500'
  };

  const themeTrip = {
    bgActive: 'bg-pink-600 text-white shadow-md', bgHover: 'hover:bg-pink-50', text: 'text-pink-600', icon: 'text-pink-500',
    badge: 'bg-pink-100 text-pink-800', border: 'border-pink-200', gradient: 'bg-gradient-to-r from-pink-500 to-rose-400',
    btnPrimary: 'bg-pink-600 hover:bg-pink-700', lightCard: 'bg-pink-50/50 border-pink-50', donutSlice: '#ec4899',
    progressBar: 'bg-gradient-to-r from-pink-400 to-rose-500'
  };

  const currentTheme = activeTab === 'room' ? themeRoom : themeTrip;

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-12">
      {/* Navbar - Modern Gradient Indigo Theme */}
      <nav className="bg-gradient-to-r from-indigo-800 via-indigo-600 to-violet-600 text-white shadow-lg sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <Wallet className="w-6 h-6 text-indigo-200" />
              <span className="text-xl font-bold tracking-wide">CS2 Fund<span className="text-indigo-200">Manager</span></span>
            </div>
            <div className="flex items-center space-x-3 md:space-x-4">
              <button onClick={() => setCurrentView('overview')} className={`px-3 md:px-4 py-2 rounded-xl transition-all font-medium text-sm md:text-base ${currentView === 'overview' ? 'bg-white/20 shadow-inner text-white' : 'hover:bg-white/10 text-indigo-100'}`}>แดชบอร์ด</button>
              <button onClick={() => setCurrentView('manage')} className={`px-3 md:px-4 py-2 rounded-xl transition-all font-medium text-sm md:text-base ${currentView === 'manage' ? 'bg-white/20 shadow-inner text-white' : 'hover:bg-white/10 text-indigo-100'}`}>จัดการเงิน</button>
              
              {currentUser ? (
                <div className="flex items-center space-x-3 ml-2 md:ml-4 border-l border-white/20 pl-3 md:pl-4">
                  <div className="text-sm text-indigo-50 flex flex-col items-end">
                    <span className="font-semibold tracking-wide">{currentUser.name}</span>
                    <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full mt-0.5 shadow-sm backdrop-blur-sm">{currentUser.role === 'admin_room' ? 'ผู้ดูแลห้อง' : currentUser.role === 'admin_trip' ? 'ผู้ดูแลฟิวทริป' : 'นักศึกษา'}</span>
                  </div>
                  <button onClick={handleLogout} className="p-2 hover:bg-white/20 rounded-full transition-all" title="ออกจากระบบ">
                    <LogOut className="w-5 h-5 text-indigo-100 hover:text-white" />
                  </button>
                </div>
              ) : (
                <button onClick={() => setCurrentView('login')} className="flex items-center space-x-1 bg-white/95 text-indigo-700 px-4 py-2 rounded-full font-bold hover:bg-white hover:scale-105 transition-all shadow-md ml-2 md:ml-4">
                  <LogIn className="w-4 h-4" /><span className="hidden md:inline">เข้าสู่ระบบ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Term Selector Header */}
      {currentView !== 'login' && (
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-[72px] z-10">
          <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-gray-400" />
              <span className="text-gray-500 font-medium text-sm md:text-base">ปีการศึกษา/เทอม:</span>
            </div>
            <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-200">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <select value={selectedTerm} onChange={(e) => setSelectedTerm(e.target.value)} className="text-sm font-bold text-indigo-700 bg-transparent outline-none cursor-pointer pr-4">
                {TERMS.map(t => <option key={t} value={t}>{formatTermName(t)}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        
        {/* OVERVIEW DASHBOARD */}
        {currentView === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                <LayoutDashboard className="text-indigo-600" /> ภาพรวมกองทุน ({formatTermName(selectedTerm)})
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full z-0 opacity-50"></div>
                <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2 relative z-10"><Wallet className="w-4 h-4 text-indigo-500"/> ยอดรวมทั้งหมด</p>
                <h3 className="text-3xl font-bold text-gray-900 relative z-10">฿{totalAllFunds.toLocaleString()}</h3>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full z-0 opacity-50"></div>
                <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2 relative z-10"><Users className="w-4 h-4 text-purple-500"/> ยอดรวมเงินห้อง</p>
                <h3 className="text-3xl font-bold text-gray-900 relative z-10">฿{totalRoomFundOverview.toLocaleString()}</h3>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-pink-50 rounded-full z-0 opacity-50"></div>
                <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2 relative z-10"><Wallet className="w-4 h-4 text-pink-500"/> ยอดรวมฟิวทริป</p>
                <h3 className="text-3xl font-bold text-gray-900 relative z-10">฿{totalTripFundOverview.toLocaleString()}</h3>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative overflow-hidden">
                <div className="absolute -right-4 -top-4 w-24 h-24 bg-gray-50 rounded-full z-0 opacity-50"></div>
                <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2 relative z-10"><Users className="w-4 h-4 text-gray-500"/> จำนวนสมาชิก</p>
                <h3 className="text-3xl font-bold text-gray-900 relative z-10">{totalMembersCount} <span className="text-base font-normal text-gray-500">คน</span></h3>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2"><Target className="w-5 h-5 text-indigo-500" />เป้าหมายความคืบหน้า (เทอมนี้)</h3>
                </div>
                <div className="space-y-4">
                  <div className="bg-indigo-50/50 rounded-xl p-4 border border-indigo-50 hover:shadow-sm transition-shadow">
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3"><div className="p-2 bg-white rounded-lg shadow-sm text-indigo-600"><Target className="w-4 h-4" /></div><span className="font-bold text-gray-800">ภาพรวมทั้งหมด</span></div>
                      <span className="px-2.5 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-bold shadow-sm">{totalPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200/80 rounded-full h-3.5 mb-2 shadow-inner overflow-hidden relative">
                      <div className="bg-gradient-to-r from-indigo-400 to-indigo-600 h-3.5 rounded-full transition-all duration-1000 relative" style={{ width: `${totalPercent}%`, minWidth: totalPercent > 0 ? '14px' : '0' }}></div>
                    </div>
                    <div className="flex justify-between text-xs font-medium"><span className="text-indigo-600">เก็บแล้ว: ฿{totalAllFunds.toLocaleString()}</span><span className="text-gray-500">เป้าหมาย: ฿{(TARGET_ROOM + TARGET_TRIP).toLocaleString()}</span></div>
                  </div>
                  <div className={`${themeRoom.lightCard} rounded-xl p-4 border hover:shadow-sm transition-shadow`}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3"><div className={`p-2 bg-white rounded-lg shadow-sm ${themeRoom.text}`}><Users className="w-4 h-4" /></div><span className="font-bold text-gray-800">เงินห้อง</span></div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${themeRoom.badge}`}>{roomPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200/80 rounded-full h-3 mb-2 shadow-inner overflow-hidden">
                      <div className="bg-gradient-to-r from-purple-400 to-fuchsia-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${roomPercent}%`, minWidth: roomPercent > 0 ? '12px' : '0' }}></div>
                    </div>
                    <div className="flex justify-between text-xs font-medium"><span className={themeRoom.text}>เก็บแล้ว: ฿{totalRoomFundOverview.toLocaleString()}</span><span className="text-gray-500">เป้าหมาย: ฿{TARGET_ROOM.toLocaleString()}</span></div>
                  </div>
                  <div className={`${themeTrip.lightCard} rounded-xl p-4 border hover:shadow-sm transition-shadow`}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3"><div className={`p-2 bg-white rounded-lg shadow-sm ${themeTrip.text}`}><Wallet className="w-4 h-4" /></div><span className="font-bold text-gray-800">เงินฟิวทริป</span></div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${themeTrip.badge}`}>{tripPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200/80 rounded-full h-3 mb-2 shadow-inner overflow-hidden">
                      <div className="bg-gradient-to-r from-pink-400 to-rose-500 h-3 rounded-full transition-all duration-1000" style={{ width: `${tripPercent}%`, minWidth: tripPercent > 0 ? '12px' : '0' }}></div>
                    </div>
                    <div className="flex justify-between text-xs font-medium"><span className={themeTrip.text}>เก็บแล้ว: ฿{totalTripFundOverview.toLocaleString()}</span><span className="text-gray-500">เป้าหมาย: ฿{TARGET_TRIP.toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2 mb-6"><PieChart className="w-5 h-5 text-indigo-500" />สัดส่วนความสำเร็จ</h3>
                <div className="flex items-center justify-center gap-8 h-48">
                  <div className="relative w-32 h-32 rounded-full flex items-center justify-center shadow-inner" style={{ background: `conic-gradient(${themeRoom.donutSlice} 0% ${pRoom}%, ${themeTrip.donutSlice} ${pRoom}% ${pRoom + pTrip}%, #f3f4f6 ${pRoom + pTrip}% 100%)` }}>
                    <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-sm">
                      <span className="text-xs text-gray-500">เก็บได้แล้ว</span><span className="font-bold text-gray-800 text-lg">{totalPercent.toFixed(0)}%</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full`} style={{backgroundColor: themeRoom.donutSlice}}></div><span className="text-sm text-gray-600">เงินห้อง ({pRoom.toFixed(1)}%)</span></div>
                    <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full`} style={{backgroundColor: themeTrip.donutSlice}}></div><span className="text-sm text-gray-600">เงินฟิวทริป ({pTrip.toFixed(1)}%)</span></div>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100"><div className="w-3 h-3 rounded-full bg-gray-200"></div><span className="text-sm text-gray-400">ยังขาดอีก ฿{(TARGET_ROOM + TARGET_TRIP - totalAllFunds).toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- MANAGE VIEW --- */}
        {currentView === 'manage' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            {successMsg && <div className="bg-green-50 text-green-700 p-4 rounded-xl flex items-center gap-3 border border-green-200 shadow-sm"><CheckCircle2 className="w-6 h-6" /><p className="font-medium">{successMsg}</p></div>}
            
            {adminNotifications.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 shadow-sm">
                <h3 className="text-yellow-800 font-bold text-lg flex items-center gap-2 mb-4"><Bell className="w-5 h-5" />การแจ้งเตือนขอแก้ไขข้อมูล ({adminNotifications.length} รายการ)</h3>
                <div className="space-y-3">
                  {adminNotifications.map(notif => (
                    <div key={notif.id} className="bg-white p-4 rounded-xl border border-yellow-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">รายการของ: <span className="text-indigo-600">{notif.studentName}</span> <span className="text-gray-500 text-xs ml-2">({formatDate(notif.timestamp)})</span></p>
                        <p className="text-sm text-gray-600 mt-1 flex items-start gap-1"><MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span><span className="font-semibold text-gray-700">เหตุผล:</span> {notif.reason}</span></p>
                        <p className="text-xs text-gray-500 mt-1">แจ้งโดย: {notif.notifiedBy} | ยอดเดิม: ฿{notif.originalAmount.toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => { const txToEdit = transactions.find(t => t.id === notif.txId); if (txToEdit) { setEditingTx(txToEdit); setEditAmount(txToEdit.amount); setEditModalOpen(true); } }} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition">แก้ไขรายการนี้</button>
                        <button onClick={() => markNotificationResolved(notif.id)} className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-sm font-medium transition flex items-center gap-1"><Check className="w-4 h-4" /> จัดการแล้ว</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex space-x-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
              <button onClick={() => setActiveTab('room')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${activeTab === 'room' ? themeRoom.bgActive : 'text-gray-500 ' + themeRoom.bgHover}`}><Users className="w-5 h-5" /> บัญชีเงินห้อง</button>
              <button onClick={() => setActiveTab('trip')} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${activeTab === 'trip' ? themeTrip.bgActive : 'text-gray-500 ' + themeTrip.bgHover}`}><Wallet className="w-5 h-5" /> บัญชีเงินฟิวทริป</button>
            </div>

            <div className={`rounded-2xl shadow-sm border p-6 flex items-center justify-between text-white ${currentTheme.gradient}`}>
              <div><p className="text-white/90 font-medium mb-1 flex items-center gap-2"><Calendar className="w-4 h-4" /> ยอดรวมประจำเทอมนี้</p><h2 className="text-4xl md:text-5xl font-bold mt-1">฿{totalActiveFund.toLocaleString()}</h2></div>
              <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm hidden sm:block">{activeTab === 'room' ? <Users className="w-10 h-10" /> : <Wallet className="w-10 h-10" />}</div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[700px] lg:col-span-7">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2"><Users className={`w-5 h-5 ${currentTheme.icon}`} /> รายชื่อสมาชิก</h3>
                  <div className="relative w-full">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="text" placeholder="ค้นหารหัสนศ. หรือ ชื่อ-สกุล..." value={studentSearchQuery} onChange={(e) => setStudentSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-white sticky top-0 shadow-sm z-10">
                      <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="px-4 py-3 font-medium text-center w-12">ที่</th><th className="px-4 py-3 font-medium w-24">รหัสนศ.</th><th className="px-4 py-3 font-medium">ชื่อ-สกุล</th><th className="px-4 py-3 font-medium text-right">ชำระแล้ว</th><th className="px-4 py-3 font-medium text-right">ค้างชำระ</th>{currentUser && <th className="px-4 py-3 font-medium text-center">จัดการ</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {studentsWithSummary.map((s, idx) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-4 text-center text-sm text-gray-400">{idx+1}</td><td className="px-4 py-4 text-sm text-gray-500 font-mono">{s.id}</td><td className="px-4 py-4 font-medium text-sm md:text-base">{s.name}</td>
                          <td className="px-4 py-4 text-right"><span className={`font-bold ${s.totalPaid>0?'text-green-600':'text-gray-300'}`}>฿{s.totalPaid.toLocaleString()}</span></td>
                          <td className="px-4 py-4 text-right">{s.remainingAmount>0?<span className="font-semibold text-red-500 text-sm">฿{s.remainingAmount.toLocaleString()}</span>:<span className="font-semibold text-emerald-500 text-sm inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> ครบ</span>}</td>
                          {currentUser && <td className="px-4 py-4 text-center"><button onClick={()=>openRecordModal(s)} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors bg-gray-100 hover:bg-gray-200 ${currentTheme.text} inline-flex items-center gap-1`}><PlusCircle className="w-3.5 h-3.5" /> จ่ายเงิน</button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[700px] lg:col-span-5">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2"><Clock className={`w-5 h-5 ${currentTheme.icon}`} /> ประวัติรายการ</h3>
                    {currentUser && currentUser.role === `admin_${activeTab}` && (
                      <button onClick={() => { setOtherType('income'); setOtherAmount(''); setOtherDescription(''); setOtherSlip(null); setOtherRecordModalOpen(true); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"><PlusCircle className="w-3.5 h-3.5" /> รับ/จ่ายอื่น</button>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" placeholder="ค้นหารายการ..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className={`w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500`} />
                    </div>
                    <div className="relative w-1/3 min-w-[110px]">
                      <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="date" value={searchDate} onChange={(e) => setSearchDate(e.target.value)} className={`w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 text-gray-600 focus:ring-indigo-500`} />
                    </div>
                  </div>
                </div>
                <div className="overflow-y-auto flex-1">
                  <table className="w-full text-left border-collapse">
                     <thead className="bg-white sticky top-0 shadow-sm z-10">
                      <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100">
                        <th className="px-4 py-3 font-medium">เวลา / ผู้บันทึก</th><th className="px-4 py-3 font-medium">รายการ</th><th className="px-4 py-3 font-medium text-right">ยอดเงิน</th>{currentUser && <th className="px-4 py-3 font-medium text-center">จัดการ</th>}
                      </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-50">
                        {filteredHistory.map(tx => {
                          const canEdit = currentUser?.role === `admin_${tx.fundType}`;
                          const txHistory = tx.history || [];
                          const editCount = txHistory.filter(h => h.action === 'edit').length;
                          const latestAction = txHistory.length > 0 ? txHistory[txHistory.length - 1] : { recordedBy: tx.recordedBy, timestamp: tx.timestamp };
                          return (
                           <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3">
                                <div className="text-[11px] text-gray-500">{formatDate(latestAction.timestamp)}</div>
                                <div className={`text-[10px] font-medium mt-0.5 flex items-center gap-1 ${editCount > 0 ? 'text-orange-600' : currentTheme.text}`}><span className={`w-1.5 h-1.5 rounded-full ${editCount > 0 ? 'bg-orange-400' : currentTheme.bgActive.split(' ')[0]}`}></span>{editCount > 0 ? `แก้ครั้งที่ ${editCount} โดย ${latestAction.recordedBy}` : `โดย ${latestAction.recordedBy}`}</div>
                                <button onClick={() => { setHistoryTx(tx); setHistoryModalOpen(true); }} className={`text-[10px] text-gray-400 hover:${currentTheme.text} flex items-center gap-1 mt-1.5 transition-colors bg-gray-100 px-2 py-0.5 rounded`}><History className="w-3 h-3" /> ประวัติ</button>
                              </td>
                              <td className="px-4 py-3">
                                {tx.type === 'student_payment' ? (
                                  <>
                                    <div className="font-medium text-gray-900 text-sm flex items-center gap-1.5 line-clamp-1">
                                      {tx.studentName}
                                      {tx.slipUrl ? (
                                        <button onClick={() => { setCurrentSlip(tx.slipUrl); setSlipModalOpen(true); }} className="text-blue-500 hover:text-blue-700 shrink-0" title="ดูหลักฐานสลิป"><ImageIcon className="w-4 h-4" /></button>
                                      ) : (
                                        <label className="text-gray-400 hover:text-indigo-600 cursor-pointer shrink-0" title="แนบสลิป"><Upload className="w-3.5 h-3.5" /><input type="file" accept="image/*" onChange={(e) => handleUploadSlip(e, tx.id)} className="hidden" /></label>
                                      )}
                                    </div>
                                    <div className="text-[10px] text-gray-500 font-mono mt-0.5">{tx.studentId}</div>
                                  </>
                                ) : (
                                  <>
                                    <div className="font-medium text-gray-900 text-sm flex items-center gap-1.5 line-clamp-1">
                                      {tx.description}
                                      {tx.slipUrl && <button onClick={() => { setCurrentSlip(tx.slipUrl); setSlipModalOpen(true); }} className="text-blue-500 hover:text-blue-700 shrink-0" title="ดูหลักฐานสลิป"><ImageIcon className="w-4 h-4" /></button>}
                                    </div>
                                    <div className={`text-[9px] inline-flex px-1.5 py-0.5 rounded font-medium mt-0.5 ${tx.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{tx.type === 'income' ? 'รับสมทบทุน' : 'จ่ายซื้อของ'}</div>
                                  </>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right"><span className={`font-bold text-sm ${tx.type === 'expense' ? 'text-red-600' : tx.type === 'income' ? 'text-emerald-600' : 'text-gray-900'}`}>{tx.type === 'expense' ? '-' : tx.type === 'income' ? '+' : ''}฿{tx.amount.toLocaleString()}</span></td>
                              {currentUser && (
                                <td className="px-4 py-3 text-center">
                                  {canEdit ? (
                                    <button onClick={() => { setEditingTx(tx); setEditAmount(tx.amount); if (tx.type !== 'student_payment') setEditDescription(tx.description); setEditModalOpen(true); }} className={`p-1.5 text-gray-400 hover:${currentTheme.text} hover:bg-gray-100 rounded-lg transition-colors`}><Edit className="w-4 h-4" /></button>
                                  ) : currentUser.role === 'student' && tx.type === 'student_payment' ? (
                                    <button onClick={() => { setNotifyTx(tx); setNotifyReason(''); setNotifyModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"><Bell className="w-4 h-4" /></button>
                                  ) : <span className="text-[10px] text-gray-300">-</span>}
                                </td>
                              )}
                           </tr>
                          );
                        })}
                     </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* LOGIN VIEW */}
        {currentView === 'login' && !currentUser && (
           <div className="max-w-md mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
               <div className="text-center mb-8">
                 <div className="mx-auto bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mb-4"><ShieldAlert className="w-8 h-8 text-indigo-600" /></div>
                 <h2 className="text-2xl font-bold text-gray-800">เข้าสู่ระบบ</h2>
                 <p className="text-gray-500 mt-2 text-sm">ล็อกอินเพื่อบันทึกข้อมูลและจัดการระบบ</p>
               </div>
               
               {loginError && <p className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 mb-6 font-medium">{loginError}</p>}
               
               <form onSubmit={handleLogin} className="space-y-5">
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อผู้ใช้งาน หรือ รหัสนักศึกษา</label>
                   <input type="text" value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="เช่น admin_room หรือ 65001" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition" required/>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน (Password)</label>
                   <input type="password" value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="••••••••" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition" required/>
                 </div>
                 <button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">เข้าสู่ระบบ</button>
               </form>

               {/* กล่องรหัสทดสอบ เพิ่มพื้นหลังให้เด่นขึ้น */}
               <div className="mt-8 pt-6 border-t border-gray-100">
                 <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100">
                   <p className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-1.5"><LogIn className="w-4 h-4"/> ข้อมูลบัญชีทดสอบ:</p>
                   <ul className="text-sm text-indigo-800 space-y-1.5 ml-1">
                     <li><span className="font-semibold w-24 inline-block">ผู้ดูแลเงินห้อง:</span> admin_room <span className="text-indigo-400 mx-1">/</span> password</li>
                     <li><span className="font-semibold w-24 inline-block">ผู้ดูแลฟิวทริป:</span> admin_trip <span className="text-indigo-400 mx-1">/</span> password</li>
                     <li><span className="font-semibold w-24 inline-block">นักศึกษา:</span> 65001 ถึง 65007 <span className="text-indigo-400 mx-1">/</span> password</li>
                   </ul>
                 </div>
               </div>

             </div>
           </div>
        )}

        {/* --- MODALS --- */}
        
        {/* Payment Modal (QR Code & Processing) */}
        {recordModalOpen && recordTarget && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-[340px] shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
              
              <button onClick={closeRecordModal} className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>

              <div className={`px-6 py-4 pt-5 flex justify-center items-center ${currentTheme.gradient} text-white shrink-0`}>
                <h3 className="text-lg font-bold">บันทึกชำระเงิน</h3>
              </div>
              
              <div className="p-5 overflow-y-auto">
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-4 flex items-center gap-3">
                  <div className={`p-2.5 rounded-full ${currentTheme.lightCard}`}><Users className={`w-5 h-5 ${currentTheme.icon}`} /></div>
                  <div>
                    <p className="font-bold text-gray-900 leading-tight">{recordTarget.name}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">รหัส: {recordTarget.id} | {formatTermName(selectedTerm)}</p>
                  </div>
                </div>

                {!rules.allowed ? (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center border border-red-100"><ShieldAlert className="w-8 h-8 mx-auto mb-2" /><p className="font-bold">{rules.message}</p></div>
                ) : (
                  <>
                    {paymentStep === 'input' && (
                      <form onSubmit={handleGenerateQR} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 text-center mb-2">จำนวนเงิน ({rules.rate}บ./{rules.unit})</label>
                          <input type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} className={`w-full border ${amount && !isAmountValid ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-indigo-500 bg-gray-50'} rounded-xl px-4 py-3 text-center text-3xl font-bold outline-none transition`} placeholder={`เช่น ${rules.rate}, ${rules.rate * 2}, ${rules.rate * 3}`} required/>
                          <div className="mt-2 text-center h-10 flex items-center justify-center">
                            {amount && !isAmountValid ? (
                              <p className="text-[11px] font-bold text-red-500 leading-tight">
                                กรอกตัวเลขให้ถูกต้อง (เพิ่มทีละ {rules.rate} เช่น {rules.rate}, {rules.rate * 2}... )<br/>
                                ช่วงที่อนุญาต: {rules.minAmount} - {rules.maxAmount} บาท
                              </p>
                            ) : amount && isAmountValid ? (
                              <p className={`text-sm font-bold ${currentTheme.text}`}>เทียบเท่ากับ: {calculatedUnits} {rules.unit}</p>
                            ) : null}
                          </div>
                        </div>
                        <button disabled={!amount || !isAmountValid} className={`w-full py-3.5 rounded-xl text-white font-bold flex justify-center items-center gap-2 transition-colors ${(!amount || !isAmountValid) ? 'bg-gray-300' : currentTheme.btnPrimary}`}><QrCode className="w-5 h-5" /> สร้าง QR Code</button>
                      </form>
                    )}

                    {paymentStep === 'qr' && (
                      <div className="text-center animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                        <p className="text-sm font-medium text-gray-500 mb-2">สแกนเพื่อชำระ {activeTab === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'}</p>
                        <div className="bg-white p-2 inline-block border-2 border-gray-100 rounded-2xl mb-2 relative">
                           <img src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=PROMPTPAY:0800000000:${parsedAmount}`} className={`w-32 h-32 transition-opacity ${qrTimeLeft === 0 ? 'opacity-20' : 'opacity-100'}`}/>
                           {qrTimeLeft === 0 && <div className="absolute inset-0 flex items-center justify-center"><span className="bg-red-100 text-red-600 px-3 py-1 rounded-full font-bold text-sm">หมดเวลา</span></div>}
                        </div>
                        <h3 className="text-2xl font-bold mb-2">฿{parsedAmount}</h3>
                        
                        {qrTimeLeft > 0 ? (
                          <div className="w-full space-y-2 mt-1">
                            <div className={`flex items-center justify-center gap-2 ${currentTheme.text} mb-2`}>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span className="font-bold text-sm animate-pulse">รอรับยอดโอน... ({Math.floor(qrTimeLeft / 60)}:{(qrTimeLeft % 60).toString().padStart(2, '0')})</span>
                            </div>
                            <button onClick={simulatePaymentReceived} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl border border-gray-200 text-sm transition-colors">(จำลอง API) ได้รับเงินแล้ว</button>
                          </div>
                        ) : (
                          <div className="w-full space-y-2 mt-2">
                            <button onClick={() => setPaymentStep('input')} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors">กรอกจำนวนเงินใหม่</button>
                          </div>
                        )}
                      </div>
                    )}

                    {paymentStep === 'success' && (
                      <div className="text-center py-8 animate-in zoom-in duration-300">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                          <Check className="w-8 h-8 text-green-500" />
                        </div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-1">ได้รับยอดโอนแล้ว!</h3>
                        <p className="text-xs text-gray-500 mb-4">หน้าต่างจะปิดลงอัตโนมัติ<br/>(แนบสลิปเพิ่มทีหลังได้ในตารางประวัติ)</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Other Modals (Edit, Notify, Slip, History, Other Record) */}
        {otherRecordModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 shadow-xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-start mb-5 shrink-0">
                <div><h3 className="text-xl font-bold">บันทึกรับ/จ่าย อื่นๆ</h3><p className="text-sm font-medium mt-1">ส่วน: <span className={currentTheme.text}>{activeTab === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'}</span></p></div>
                <button onClick={() => setOtherRecordModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleRecordOther} className="space-y-4 overflow-y-auto">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <button type="button" onClick={() => setOtherType('income')} className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors ${otherType === 'income' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}><ArrowUpCircle className="w-4 h-4" /> รับเข้า</button>
                  <button type="button" onClick={() => setOtherType('expense')} className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors ${otherType === 'expense' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}><ArrowDownCircle className="w-4 h-4" /> จ่ายออก</button>
                </div>
                <input type="text" value={otherDescription} onChange={(e) => setOtherDescription(e.target.value)} required placeholder="รายละเอียด" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
                <input type="number" value={otherAmount} onChange={(e) => setOtherAmount(e.target.value)} required placeholder="จำนวนเงิน" min="1" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
                <div>
                  <label className="flex items-center justify-center gap-2 w-full border-2 border-dashed border-gray-300 rounded-lg px-3 py-3 hover:bg-gray-50 cursor-pointer transition">
                    <FileText className="w-5 h-5 text-gray-400" />
                    <span className="text-sm text-gray-500 truncate">{otherSlip ? otherSlip.name : 'แนบสลิป/ใบเสร็จ (ถ้ามี)'}</span>
                    <input type="file" accept="image/*" onChange={(e) => setOtherSlip(e.target.files[0])} className="hidden" />
                  </label>
                </div>
                <button type="submit" className={`w-full text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 ${otherType === 'income' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}`}><CheckCircle2 className="w-5 h-5" /> บันทึกข้อมูล</button>
              </form>
            </div>
          </div>
        )}

        {/* Modal แก้ไขรายการ (สำหรับแอดมิน) */}
        {editModalOpen && editingTx && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 shadow-xl border-t-4 border-fuchsia-500 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-5 shrink-0">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Edit className={`w-5 h-5 ${currentTheme.icon}`} /> แก้ไขรายการ
                </h3>
                <button onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={submitEdit} className="space-y-4 overflow-y-auto">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                  <p className="text-gray-500 flex justify-between mb-1">
                    <span>{editingTx.type === 'student_payment' ? 'ผู้จ่าย:' : 'ประเภท:'}</span> 
                    <span className="font-medium text-gray-900">
                      {editingTx.type === 'student_payment' ? editingTx.studentName : (editingTx.type === 'income' ? 'รายรับสมทบทุน' : 'รายจ่ายซื้อของ')}
                    </span>
                  </p>
                  <p className="text-gray-500 flex justify-between mb-1">
                    <span>ส่วน:</span> <span className="font-medium text-gray-900">{editingTx.fundType === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'} (เทอม {editingTx.term})</span>
                  </p>
                  <p className="text-gray-500 flex justify-between"><span>เวลาเดิม:</span> <span className="text-xs">{formatDate(editingTx.timestamp)}</span></p>
                </div>

                {editingTx.type !== 'student_payment' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">แก้ไขรายละเอียด</label>
                    <input 
                      type="text" 
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      required
                      className={`w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 outline-none transition ${activeTab === 'room' ? 'focus:ring-purple-500' : 'focus:ring-pink-500'}`}
                    />
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">จำนวนเงินใหม่ (บาท)</label>
                  <input 
                    type="number" 
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    required
                    min="0"
                    className={`w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 text-lg outline-none transition ${activeTab === 'room' ? 'focus:ring-purple-500' : 'focus:ring-pink-500'}`}
                  />
                </div>
                <button 
                  type="submit"
                  className={`w-full text-white font-semibold py-3 rounded-lg transition-colors flex justify-center items-center gap-2 ${currentTheme.btnPrimary}`}
                >
                  <CheckCircle2 className="w-5 h-5" /> บันทึกการแก้ไข
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal แจ้งแอดมินแก้ไข (สำหรับนักศึกษา) */}
        {notifyModalOpen && notifyTx && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 shadow-xl border-t-4 border-yellow-400 flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-center mb-5 shrink-0">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Bell className="w-5 h-5 text-yellow-500" /> แจ้งแก้ไขข้อมูล
                </h3>
                <button onClick={() => setNotifyModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleNotifySubmit} className="space-y-4 overflow-y-auto">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                  <p className="text-gray-500 flex justify-between mb-1"><span>ผู้จ่าย:</span> <span className="font-medium text-gray-900">{notifyTx.studentName}</span></p>
                  <p className="text-gray-500 flex justify-between mb-1"><span>ยอดเงิน:</span> <span className="font-medium text-gray-900">฿{notifyTx.amount.toLocaleString()}</span></p>
                  <p className="text-gray-500 flex justify-between"><span>ส่วน:</span> <span className="font-medium text-gray-900">{notifyTx.fundType === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'} ({formatTermName(notifyTx.term)})</span></p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผลที่ขอแก้ไข (หมายเหตุ)</label>
                  <textarea 
                    value={notifyReason}
                    onChange={(e) => setNotifyReason(e.target.value)}
                    required
                    placeholder="เช่น พิมพ์ยอดเงินผิด จ่ายจริง 500 บาท"
                    rows="3"
                    className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-yellow-500 outline-none transition resize-none"
                  ></textarea>
                </div>
                <button 
                  type="submit"
                  className="w-full bg-yellow-500 hover:bg-yellow-600 text-white font-semibold py-3 rounded-lg transition-colors flex justify-center items-center gap-2 shadow-sm"
                >
                  <MessageSquare className="w-5 h-5" /> ส่งข้อความหาแอดมิน
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal ดูประวัติการแก้ไข */}
        {historyModalOpen && historyTx && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-md animate-in zoom-in-95 duration-200 shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <History className={`w-5 h-5 ${currentTheme.icon}`} /> ประวัติการดำเนินการ
                </h3>
                <button onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-6 pb-4 border-b border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">
                    {historyTx.type === 'student_payment' ? 'รายการของ:' : 'รายการ:'} <span className="font-semibold text-gray-900">{historyTx.type === 'student_payment' ? historyTx.studentName : historyTx.description}</span>
                  </p>
                  <p className="text-sm text-gray-500">ส่วน: <span className="font-semibold text-gray-900">{historyTx.fundType === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'} (เทอม {historyTx.term})</span></p>
                </div>
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                  {(historyTx.history || []).map((h, index) => (
                    <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white ${currentTheme.lightCard} ${currentTheme.text} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10`}>
                        {h.action === 'create' ? <PlusCircle className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${h.action === 'create' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {h.action === 'create' ? 'เพิ่มรายการ' : `แก้ไขครั้งที่ ${index}`}
                          </span>
                        </div>
                        {h.description && h.action === 'edit' && (
                          <p className="text-xs text-gray-500 mb-1 line-clamp-2">แก้รายละเอียด: {h.description}</p>
                        )}
                        <p className={`text-lg font-bold my-1 ${historyTx.type === 'expense' ? 'text-red-600' : 'text-gray-900'}`}>
                           {historyTx.type === 'expense' ? '-' : ''}฿{h.amount.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">โดย: <span className="font-medium text-gray-800">{h.recordedBy}</span></p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(h.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal ดูหลักฐานสลิป */}
        {slipModalOpen && currentSlip && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSlipModalOpen(false)}>
            <div className="relative max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setSlipModalOpen(false)} className="absolute -top-12 right-0 text-white hover:text-gray-300 transition flex items-center gap-1 font-bold"><X className="w-6 h-6" /> ปิด</button>
              <img src={currentSlip} alt="หลักฐาน" className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl bg-black/50" />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}