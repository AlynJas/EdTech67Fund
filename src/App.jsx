import React, { useState, useEffect, useRef } from 'react';
import { 
  Wallet, Users, LayoutDashboard, LogOut, LogIn, PlusCircle, 
  CheckCircle2, Clock, ShieldAlert, Edit, Search, Calendar, 
  X, Bell, MessageSquare, Check, History, Target, PieChart, 
  ArrowUpCircle, ArrowDownCircle, FileText, Image as ImageIcon, 
  BookOpen, QrCode, Loader2, Upload, AlertCircle, KeyRound, Table, LayoutList,
  Eye, EyeOff
} from 'lucide-react';

import { supabase } from './supabaseClient';


const STUDENT_ADMINS = {
  '6720117265': 'admin_room', // แอดมินเงินห้อง
  '6720117261': 'admin_trip'  // แอดมินฟิวทริป
};


const PROMPTPAY_ROOM = "1959300030540";
const PROMPTPAY_TRIP = "004999215415711";

const LEFT_STUDENTS = [
  '6720117049'
];

const TERMS = ['1/1', '1/2', '2/1', '2/2', '2/b2', '3/1', '3/b1', '3/2', '3/b2', '4/1', '4/b1', '4/2', '4/b2'];

const formatTermName = (termValue) => {
  if (!termValue || typeof termValue !== 'string' || !termValue.includes('/')) return '';
  const [year, term] = termValue.split('/');
  if (term === 'b1') return `ปี ${year} ปิดเทอม 1`;
  if (term === 'b2') return `ปี ${year} ปิดเทอม 2`;
  return `ปี ${year} เทอม ${term}`;
};

// --- ✅ ปรับ Config กฎการเก็บเงินตามเงื่อนไขใหม่ ---
const getTermConfig = (termStr, fundType, studentYear) => {
  if (!termStr || typeof termStr !== 'string' || !termStr.includes('/')) {
     return { allowed: false, message: 'ข้อมูลเทอมไม่ถูกต้อง', target: 0, rate: 0, weeks: 0, unit: 'สัปดาห์', minAmount: 0, maxAmount: 0 };
  }
  const [termYearStr, term] = termStr.split('/');
  const isBreak = term ? term.startsWith('b') : false;
  const year = studentYear || parseInt(termYearStr) || 1; 

  if (fundType === 'room') {
    if (isBreak) return { allowed: false, message: 'ไม่มีการเก็บเงินห้องในช่วงปิดเทอม', target: 0, rate: 0, weeks: 0, unit: 'สัปดาห์', minAmount: 10, maxAmount: 0 };
    // ปี 1
    if (year === 1 && term === '1') return { allowed: true, target: 220, rate: 10, weeks: 22, unit: 'สัปดาห์', minAmount: 10, maxAmount: 220 };
    if (year === 1 && term === '2') return { allowed: true, target: 170, rate: 10, weeks: 17, unit: 'สัปดาห์', minAmount: 10, maxAmount: 170 };
    // ปี 2 ขึ้นไป
    return { allowed: true, target: 180, rate: 10, weeks: 18, unit: 'สัปดาห์', minAmount: 10, maxAmount: 180 };
  }

  if (fundType === 'trip') {
    // ปี 1
    if (year === 1 && term === '1') return { allowed: false, message: 'ไม่มีการเก็บเงินฟิวทริปในปี 1 เทอม 1', target: 0, rate: 0, weeks: 0, unit: 'สัปดาห์', minAmount: 40, maxAmount: 0 };
    if (year === 1 && term === '2') return { allowed: true, target: 680, rate: 40, weeks: 17, unit: 'สัปดาห์', minAmount: 40, maxAmount: 680 };
    
    if (isBreak) {
      // ตั้งแต่ปี 2 ปิดเทอม 2 เป็นต้นไป
      if (year > 2 || (year === 2 && term === 'b2')) return { allowed: true, target: 300, rate: 10, weeks: 30, unit: 'วัน', minAmount: 10, maxAmount: 300 };
      return { allowed: false, message: 'ยังไม่มีการเก็บเงินพิเศษช่วงปิดเทอมนี้', target: 0, rate: 0, weeks: 0, unit: 'วัน', minAmount: 10, maxAmount: 0 };
    }
    // ปี 2
    if (year === 2) return { allowed: true, target: 720, rate: 40, weeks: 18, unit: 'สัปดาห์', minAmount: 40, maxAmount: 720 };
    // ปี 3 ขึ้นไป
    if (year >= 3) return { allowed: true, target: 1620, rate: 90, weeks: 18, unit: 'สัปดาห์', minAmount: 90, maxAmount: 1620 };
  }
  return { allowed: false, message: 'ไม่อนุญาต', target: 0, rate: 0, weeks: 0, unit: 'สัปดาห์', minAmount: 0, maxAmount: 0 };
};

const SESSION_KEY = 'cs2_fund_session';
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

// ✅ ฟังก์ชันช่วยดึงค่าจาก LocalStorage อย่างปลอดภัย
const getSafeStorage = (key, defaultVal) => {
  try {
    const val = localStorage.getItem(key);
    if (val === null || val === 'undefined' || val === 'null' || val === '') return defaultVal;
    return val;
  } catch (e) {
    return defaultVal;
  }
};

const generatePromptPayPayload = (id, amount) => {
  const target = String(id).replace(/[^0-9]/g, '');
  let merchantInfo = "";
  
  if (target.length >= 15) {
    merchantInfo = "0016A0000006770101120315" + target.substring(0, 15);
  } else if (target.length >= 13) {
    merchantInfo = "0016A0000006770101110213" + target.substring(0, 13);
  } else if (target.length >= 10) {
    merchantInfo = "0016A00000067701011101130066" + target.substring(1, 10);
  } else {
    merchantInfo = "0016A00000067701011101130066" + target.padStart(9, '0');
  }
  
  let payload = "00020101021229" + merchantInfo.length.toString().padStart(2, '0') + merchantInfo + "5802TH5303764";
  
  if (amount > 0) {
    const amtStr = parseFloat(amount).toFixed(2);
    payload += "54" + amtStr.length.toString().padStart(2, '0') + amtStr;
  }
  
  payload += "6304";
  
  let crc = 0xFFFF;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) crc = (crc << 1) ^ 0x1021;
      else crc = crc << 1;
    }
  }
  return payload + (crc & 0xFFFF).toString(16).toUpperCase().padStart(4, '0');
};

// ✅ ฟังก์ชันแปลงไฟล์รูปภาพเป็น Base64 (สำหรับการเก็บรูปในฐานข้อมูลโดยตรง)
const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);

  
  const [currentView, setCurrentView] = useState(() => getSafeStorage('cs2_currentView', 'overview')); 
  const [activeTab, setActiveTab] = useState(() => getSafeStorage('cs2_activeTab', 'room')); 
  const [selectedTerm, setSelectedTerm] = useState(() => {
    const term = getSafeStorage('cs2_selectedTerm', '2/1');
    return term.includes('/') ? term : '2/1';
  }); 
  const [showTableView, setShowTableView] = useState(() => getSafeStorage('cs2_showTableView', 'true') === 'true');

  const [transactions, setTransactions] = useState([]); 
  const [students, setStudents] = useState([]);
  const [targetCounts, setTargetCounts] = useState({ year1: 24, year2: 23 });

  // Modal & Search States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [recordModalOpen, setRecordModalOpen] = useState(false);
  const [recordTarget, setRecordTarget] = useState(null);
  const [amount, setAmount] = useState('');
  const [paymentStep, setPaymentStep] = useState('input');
  const [qrTimeLeft, setQrTimeLeft] = useState(660);
  const [pendingTxId, setPendingTxId] = useState(null);
  const [studentSearchQuery, setStudentSearchQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [slipModalOpen, setSlipModalOpen] = useState(false);
  const [currentSlip, setCurrentSlip] = useState(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Change Password State
  const [cpModalOpen, setCpModalOpen] = useState(false);
  const [cpUsername, setCpUsername] = useState('');
  const [cpOldPassword, setCpOldPassword] = useState('');
  const [cpNewPassword, setCpNewPassword] = useState('');
  const [cpConfirmPassword, setCpConfirmPassword] = useState('');
  const [cpError, setCpError] = useState('');
  const [cpSuccess, setCpSuccess] = useState('');

  // Password Visibility States
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showCpOldPassword, setShowCpOldPassword] = useState(false);
  const [showCpNewPassword, setShowCpNewPassword] = useState(false);
  const [showCpConfirmPassword, setShowCpConfirmPassword] = useState(false);

  // Other Modals
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingTx, setEditingTx] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [otherRecordModalOpen, setOtherRecordModalOpen] = useState(false);
  const [otherType, setOtherType] = useState('income');
  const [otherAmount, setOtherAmount] = useState('');
  const [otherDescription, setOtherDescription] = useState('');
  const [otherPerson, setOtherPerson] = useState(''); 
  const [otherDate, setOtherDate] = useState('');
  const [otherSlip, setOtherSlip] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyTx, setNotifyTx] = useState(null);
  const [notifyReason, setNotifyReason] = useState('');
  const [verifyingHistoryId, setVerifyingHistoryId] = useState(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyTx, setHistoryTx] = useState(null);

  const qrTimerRef = useRef(null);
  const paymentTimeoutRef = useRef(null);

  const isAnyModalOpen = recordModalOpen || editModalOpen || otherRecordModalOpen || slipModalOpen || notifyModalOpen || historyModalOpen || cpModalOpen;

  useEffect(() => {
    localStorage.setItem('cs2_currentView', currentView);
    localStorage.setItem('cs2_activeTab', activeTab);
    localStorage.setItem('cs2_selectedTerm', selectedTerm);
    localStorage.setItem('cs2_showTableView', showTableView);
  }, [currentView, activeTab, selectedTerm, showTableView]);

  useEffect(() => {
    fetchTransactions();
    fetchStudents();
    fetchSettings();
    
    const savedSessionStr = localStorage.getItem(SESSION_KEY);
    if (savedSessionStr) {
      try {
        const session = JSON.parse(savedSessionStr);
        if (Date.now() - session.lastActive < TEN_DAYS_MS) {
          setCurrentUser(session.user);
          session.lastActive = Date.now();
          localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        } else {
          localStorage.removeItem(SESSION_KEY);
        }
      } catch (e) {
        console.error("Error parsing session", e);
      }
    }
  }, []);

  useEffect(() => {
    const handleActivity = () => {
      if (currentUser) {
        const sessionStr = localStorage.getItem(SESSION_KEY);
        if (sessionStr) {
          const session = JSON.parse(sessionStr);
          if (Date.now() - session.lastActive > 60000) {
            session.lastActive = Date.now();
            localStorage.setItem(SESSION_KEY, JSON.stringify(session));
          }
        }
      }
    };
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
    };
  }, [currentUser]);

  const fetchTransactions = async () => {
    const { data } = await supabase.from('transactions').select('*').order('timestamp', { ascending: false });
    if (data) setTransactions(data.map(tx => ({ ...tx, studentId: tx.student_id, studentName: tx.student_name, fundType: tx.fund_type, recordedBy: tx.recorded_by, slipUrl: tx.slip_url })));
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from('students').select('*').order('id', { ascending: true });
    if (data) setStudents(data);
  };

  const fetchSettings = async () => {
    const { data } = await supabase.from('system_settings').select('*').eq('id', 1).single();
    if (data) setTargetCounts({ year1: data.year1_count || 24, year2: data.year2_up_count || 23 });
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
    try {
      const trimmedUsername = String(username).trim();
      const safeStudents = Array.isArray(students) ? students : [];
      const student = safeStudents.find(s => String(s?.id || '').trim() === trimmedUsername);
      
      let user = null;
      if (student) {
        const safeAdmins = typeof STUDENT_ADMINS !== 'undefined' ? STUDENT_ADMINS : {};
        const assignedRole = student?.role || safeAdmins[String(student?.id || '').trim()] || 'student';
        user = { password: student?.password || 'password', role: assignedRole, name: student?.name };
      }
      
      if (user && user.password === password) {
        const sessionUser = { username: trimmedUsername, ...user };
        setCurrentUser(sessionUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user: sessionUser, lastActive: Date.now() }));
        setCurrentView('overview');
        setLoginError('');
        setUsername(''); setPassword('');
      } else {
        setLoginError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }
    } catch (err) {
      console.error("Login Error: ", err);
      setLoginError('เกิดข้อผิดพลาดในระบบ: ' + err.message);
    }
  };

  const handleLogout = () => { 
    setCurrentUser(null); 
    localStorage.removeItem(SESSION_KEY); 
    setCurrentView('overview'); 
  };

  const submitChangePassword = async (e) => {
    e.preventDefault();
    setCpError('');
    setCpSuccess('');

    const student = students.find(s => String(s?.id || '').trim() === String(cpUsername).trim());

    if (!student) {
      setCpError('ไม่พบชื่อผู้ใช้งาน หรือรหัสนักศึกษานี้ในระบบ');
      return;
    }

    const currentPassword = student?.password || 'password';
    if (currentPassword !== cpOldPassword) {
      setCpError('รหัสผ่านเดิมไม่ถูกต้อง');
      return;
    }

    if (cpNewPassword !== cpConfirmPassword) {
      setCpError('รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน');
      return;
    }

    if (cpNewPassword.length < 8) {
      setCpError('รหัสผ่านใหม่ต้องมีความยาวอย่างน้อย 8 ตัวอักษร');
      return;
    }

    const { error } = await supabase
      .from('students')
      .update({ password: cpNewPassword })
      .eq('id', student.id);

    if (error) {
      setCpError('เกิดข้อผิดพลาดในการบันทึกข้อมูล กรุณาลองใหม่');
    } else {
      setCpSuccess('เปลี่ยนรหัสผ่านสำเร็จ! ท่านสามารถใช้รหัสผ่านใหม่ในการเข้าสู่ระบบครั้งต่อไป');
      setStudents(students.map(s => String(s?.id).trim() === String(student.id).trim() ? { ...s, password: cpNewPassword } : s));
      setTimeout(() => {
        setCpModalOpen(false);
        setCpUsername(''); setCpOldPassword(''); setCpNewPassword(''); setCpConfirmPassword('');
        setShowCpOldPassword(false); setShowCpNewPassword(false); setShowCpConfirmPassword(false);
        setCpSuccess('');
      }, 3000);
    }
  };


  const openRecordModal = (student) => {
    try {
      if (!student) return;
      setRecordTarget(student);
      setAmount('');
      setPaymentStep('input');
      setPendingTxId(null);
      setRecordModalOpen(true);
    } catch (e) {
      console.error("Error opening payment modal:", e);
    }
  };

  const closeRecordModal = () => {
    if (paymentTimeoutRef.current) clearTimeout(paymentTimeoutRef.current);
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);
    setRecordModalOpen(false);
    setTimeout(() => {
      setPaymentStep('input');
      setPendingTxId(null);
    }, 300);
  };


  const formatDate = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' });
  };
  
  const formatJustDate = (isoString) => {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString('th-TH', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const handleGenerateQR = async (e) => {
    e.preventDefault();
    if (!currentUser || !recordTarget) return; 


    const targetStudentYear = recordTarget?.year || parseInt(String(selectedTerm).split('/')[0]) || 1;
    const recordRules = getTermConfig(selectedTerm, activeTab, targetStudentYear);
    
    const parsedAmount = parseFloat(amount) || 0;
    const isAmountValid = recordRules.allowed && parsedAmount >= recordRules.minAmount && parsedAmount <= recordRules.maxAmount && (parsedAmount % recordRules.rate === 0);

    if (!isAmountValid) {
      alert("ยอดเงินไม่ถูกต้องตามเงื่อนไข");
      return;
    }

    setPaymentStep('qr');
    setQrTimeLeft(660); 

    try {
      const newTimestamp = new Date().toISOString();
      const newDbTx = {
        type: 'student_payment', 
        student_id: recordTarget.id, 
        student_name: recordTarget.name,
        fund_type: activeTab, 
        term: selectedTerm, 
        amount: parsedAmount, 
        recorded_by: currentUser.name,
        timestamp: newTimestamp, 
        history: [{ action: 'create', amount: parsedAmount, recordedBy: currentUser.name, timestamp: newTimestamp }],
        status: 'pending' 
      };

      const { data, error } = await supabase.from('transactions').insert([newDbTx]).select();
      
      if (error) throw error;
      
      if (data && data.length > 0) {
        const formattedTx = {
          ...data[0], studentId: data[0].student_id, studentName: data[0].student_name, fundType: data[0].fund_type, recordedBy: data[0].recorded_by, slipUrl: data[0].slip_url, status: 'pending'
        };
        setTransactions(prev => [formattedTx, ...prev]);
        setPendingTxId(formattedTx.id); 
      }

      qrTimerRef.current = setInterval(() => {
        setQrTimeLeft((prev) => {
          if (prev <= 1) { clearInterval(qrTimerRef.current); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error("Error creating record:", err);
      alert("เกิดข้อผิดพลาดในการสร้างรายการ กรุณาลองใหม่อีกครั้ง");
      setPaymentStep('input');
    }
  };

      const isRoom = activeTab === 'room';
      const branchId = isRoom 
        ? (import.meta.env.VITE_SLIPOK_BRANCH_ID_ROOM || import.meta.env.VITE_SLIPOK_BRANCH_ID) 
        : (import.meta.env.VITE_SLIPOK_BRANCH_ID_TRIP || import.meta.env.VITE_SLIPOK_BRANCH_ID);
      const apiKey = isRoom 
        ? (import.meta.env.VITE_SLIPOK_API_KEY_ROOM || import.meta.env.VITE_SLIPOK_API_KEY) 
        : (import.meta.env.VITE_SLIPOK_API_KEY_TRIP || import.meta.env.VITE_SLIPOK_API_KEY);

  const handleVerifySlip = async (e) => {
    const file = e.target.files[0]; 
    if (!file) return;

    setIsVerifying(true); 
    if (qrTimerRef.current) clearInterval(qrTimerRef.current);

    try {
      const base64Slip = await fileToBase64(file);

      const formData = new FormData();
      formData.append('files', file);

      const branchId = import.meta.env.VITE_SLIPOK_BRANCH_ID;
      const apiKey = import.meta.env.VITE_SLIPOK_API_KEY;

      const response = await fetch(`/slipok-api/${branchId}`, {
        method: 'POST',
        headers: { 'x-authorization': apiKey },
        body: formData
      });
      const result = await response.json();


      const currentParsedAmount = parseFloat(amount) || 0;

      if (result.success === true && result.data.amount === currentParsedAmount) {
        setPaymentStep('success'); 
        
        const slipUrl = result.data ? result.data.url : null;
        await supabase.from('transactions').update({ status: 'completed', slip_url: base64Slip }).eq('id', pendingTxId);

        setTransactions(prev => prev.map(t => t.id === pendingTxId ? { ...t, status: 'completed', slipUrl: slipUrl } : t));

        setSuccessMsg(`โอนเงินสำเร็จ! บันทึกยอด ฿${currentParsedAmount} ให้ ${recordTarget?.name || ''} แล้ว`);

        paymentTimeoutRef.current = setTimeout(() => {
          closeRecordModal();
          setTimeout(() => setSuccessMsg(''), 4000);
        }, 2000); 

      } else {
        alert(`สลิปไม่ถูกต้อง หรือ ยอดเงินไม่ตรง!\nกรุณาตรวจสอบสลิปอีกครั้ง (ต้องการยอด ฿${currentParsedAmount})`);
        setPaymentStep('qr');
      }
    } catch (error) {
      console.error("Error verifying slip:", error);
      alert('เกิดข้อผิดพลาดในการเชื่อมต่อกับระบบตรวจสลิป กรุณาลองใหม่');
      setPaymentStep('qr');
    } finally {
      setIsVerifying(false);
    }
  };

  // ✅ เพิ่มฟังก์ชันนี้เข้ามาใหม่
  const openOtherRecordModal = () => {
    const today = new Date();
    // แปลงเวลาให้เป็นโซนเวลาปัจจุบัน (Local) ป้องกันวันที่คลาดเคลื่อน
    const localDate = new Date(today.getTime() - (today.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
    
    setOtherType('income');
    setOtherAmount('');
    setOtherDescription('');
    setOtherPerson('');
    setOtherDate(localDate); // ✅ เซ็ตค่าเริ่มต้นเป็นวันที่ปัจจุบัน
    setOtherSlip(null);
    setOtherRecordModalOpen(true);
  };

  const handleVerifySlipFromHistory = async (e, tx) => {
    const file = e.target.files[0]; 
    if (!file) return;

    setVerifyingHistoryId(tx.id);

    try {

      const fallbackSlipUrl = await fileToBase64(file);

      await supabase.from('transactions').update({ status: 'completed', slip_url: fallbackSlipUrl }).eq('id', tx.id);
      
      setTransactions(prev => prev.map(t => t.id === tx.id ? { ...t, status: 'completed', slipUrl: fallbackSlipUrl } : t));
      setSuccessMsg(`อัปเดตสลิปย้อนหลังสำเร็จ!`);
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (error) {
      console.error("Error:", error);
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
    } finally {
      setVerifyingHistoryId(null);
    }
  };


  const handleRecordOther = async (e) => {
    e.preventDefault();
    if (!currentUser || !otherAmount || !otherDescription || !otherDate) return;
 
    let newTimestamp = new Date().toISOString();
    if (otherDate) {
      const selectedD = new Date(otherDate);
      const now = new Date();
      selectedD.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
      newTimestamp = selectedD.toISOString();
    }
    let slipUrl = null;
    if (otherSlip) {
      slipUrl = await compressImage(otherSlip);
    }
    
    const historyData = [{ action: 'create', amount: parseFloat(otherAmount), description: otherDescription, recordedBy: currentUser.name, timestamp: newTimestamp }];
    
    const newDbTx = {
      type: otherType, 
      description: otherDescription, 
      student_name: otherPerson, 
      slip_url: slipUrl, 
      fund_type: activeTab,
      term: selectedTerm, 
      amount: parseFloat(otherAmount), 
      recorded_by: currentUser.name, 
      timestamp: newTimestamp,
      history: historyData,
      status: 'completed'
    };

    const { data } = await supabase.from('transactions').insert([newDbTx]).select();

    if (data && data.length > 0) {
      const formattedTx = { ...data[0], studentName: data[0].student_name, fundType: data[0].fund_type, recordedBy: data[0].recorded_by, slipUrl: data[0].slip_url, status: 'completed' };
      setTransactions([formattedTx, ...transactions]);
    }

    setSuccessMsg(`บันทึก${otherType === 'income' ? 'รายรับ' : 'รายจ่าย'} สำเร็จ!`);
    setOtherRecordModalOpen(false); setOtherAmount(''); setOtherDescription(''); setOtherPerson(''); setOtherSlip(null);
    setTimeout(() => setSuccessMsg(''), 3000);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editingTx || !editAmount) return;
    const newTimestamp = new Date().toISOString();
    const newAmount = parseFloat(editAmount);
    
    const currentHistory = editingTx.history || [];
    const historyEntry = { action: 'edit', amount: newAmount, description: editingTx?.type !== 'student_payment' ? editDescription : undefined, recordedBy: currentUser.name, timestamp: newTimestamp };
    const updatedHistory = [...currentHistory, historyEntry];

    const updateData = {
      amount: newAmount,
      description: editingTx?.type !== 'student_payment' ? editDescription : editingTx?.description,
      history: updatedHistory
    };

    const { error } = await supabase.from('transactions').update(updateData).eq('id', editingTx.id);

    if (!error) {
      const updatedTx = transactions.map(t => {
        if (t.id === editingTx.id) return { ...t, ...updateData };
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

  const markNotificationResolved = (id) => setNotifications((notifications || []).map(n => n?.id === id ? { ...n, status: 'resolved' } : n));

  // --- ลอจิกกรองข้อมูล ---
  const currentYearInt = parseInt(String(selectedTerm).split('/')[0]) || 1;
  
  let activeStudents = [...students];
  if (currentYearInt >= 2) {
    activeStudents = students.filter(s => 
      s?.status !== 'inactive' && 
      s?.is_active !== false &&
      !LEFT_STUDENTS.includes(String(s?.id || '').trim())
    );
  }

  const filteredStudents = activeStudents.filter(s => (s?.name || '').includes(studentSearchQuery) || String(s?.id || '').includes(studentSearchQuery));

  // ✅ การคำนวณยอดเงินสะสม (Grand Total)
  const calculateGrandTotal = (txs, fundType) => {
    return (txs || [])
      .filter(tx => (tx?.status === 'completed' || tx?.status === 'success') && (!fundType || tx?.fundType === fundType))
      .reduce((sum, tx) => tx?.type === 'expense' ? sum - (Number(tx?.amount) || 0) : sum + (Number(tx?.amount) || 0), 0);
  };

  const grandTotalRoom = calculateGrandTotal(transactions, 'room');
  const grandTotalTrip = calculateGrandTotal(transactions, 'trip');
  const grandTotalAll = grandTotalRoom + grandTotalTrip;


  const termTransactions = (transactions || []).filter(t => t?.term === selectedTerm);
  const currentFundTransactions = termTransactions.filter(t => t?.fundType === activeTab);


  const calculateNetTotal = (txs) => (txs || [])
    .filter(tx => tx?.status === 'completed' || tx?.status === 'success')
    .reduce((sum, tx) => tx?.type === 'expense' ? sum - (Number(tx?.amount) || 0) : sum + (Number(tx?.amount) || 0), 0);
  
  const totalActiveFund = calculateNetTotal(currentFundTransactions);

  const studentsWithSummary = filteredStudents.map(student => {
    const sYear = student?.year || currentYearInt || 1; 
    const sRules = getTermConfig(selectedTerm, activeTab, sYear); 

    let totalPaid = 0;
    
    currentFundTransactions.forEach(tx => {
      if (tx?.type === 'student_payment' && (tx?.status === 'completed' || tx?.status === 'success') && String(tx?.studentId) === String(student?.id)) {
        totalPaid += Number(tx?.amount) || 0;
      }
    });
      
    const targetAmount = sRules.target || 0;
    const remainingAmount = Math.max(0, targetAmount - totalPaid);

    const weeks = [];
    const ratePerWeek = Number(sRules.rate) || 10;
    let remaining = totalPaid; 
    
    const totalWeeks = sRules.weeks || 0;
    for (let i = 1; i <= totalWeeks; i++) {
      if (remaining >= ratePerWeek) {
        weeks.push(ratePerWeek);
        remaining -= ratePerWeek;
      } else if (remaining > 0) {
        weeks.push(remaining);
        remaining = 0;
      } else {
        weeks.push(0); 
      }
    }

    return { ...student, totalPaid, targetAmount, remainingAmount, weeks, allowed: sRules.allowed, message: sRules.message };
  });


  const filteredHistory = currentFundTransactions.filter(tx => {
    const targetName = tx?.type === 'student_payment' ? tx?.studentName : (tx?.description || '');
    const targetId = String(tx?.studentId || '');
    const matchName = (targetName || '').toLowerCase().includes(searchQuery.toLowerCase()) || targetId.includes(searchQuery);
    const matchDate = searchDate ? (tx?.timestamp || '').startsWith(searchDate) : true;
    return matchName && matchDate;
  });

  const otherTransactionsList = currentFundTransactions.filter(tx => tx?.type !== 'student_payment' && tx?.status !== 'pending');
  const filteredOtherTransactions = otherTransactionsList.filter(tx => {
    const matchName = (tx?.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchDate = searchDate ? (tx?.timestamp || '').startsWith(searchDate) : true;
    return matchName && matchDate;
  });

  const adminNotifications = (notifications || []).filter(n => n?.status === 'pending' && n?.term === selectedTerm && currentUser && ((currentUser?.role === 'admin_room' && n?.fundType === 'room') || (currentUser?.role === 'admin_trip' && n?.fundType === 'trip')));


  const expectedStudentCount = currentYearInt === 1 ? targetCounts.year1 : targetCounts.year2;

  const configRoom = getTermConfig(selectedTerm, 'room', currentYearInt);
  const configTrip = getTermConfig(selectedTerm, 'trip', currentYearInt);

  const termTargetRoom = (configRoom.target || 0) * expectedStudentCount;
  const termTargetTrip = (configTrip.target || 0) * expectedStudentCount;
  const termTotalTarget = termTargetRoom + termTargetTrip;


  const roomTransactions = termTransactions.filter(t => t?.fundType === 'room');
  const tripTransactions = termTransactions.filter(t => t?.fundType === 'trip');
  const totalRoomFundOverview = calculateNetTotal(roomTransactions);
  const totalTripFundOverview = calculateNetTotal(tripTransactions);
  const totalAllFunds = totalRoomFundOverview + totalTripFundOverview;
  
  const roomPercent = termTargetRoom > 0 ? Math.min((totalRoomFundOverview / termTargetRoom) * 100, 100) : 0;
  const tripPercent = termTargetTrip > 0 ? Math.min((totalTripFundOverview / termTargetTrip) * 100, 100) : 0;
  const totalPercent = termTotalTarget > 0 ? Math.min((totalAllFunds / termTotalTarget) * 100, 100) : 0;
  
  const pRoom = termTotalTarget > 0 ? (totalRoomFundOverview / termTotalTarget) * 100 : 0;
  const pTrip = termTotalTarget > 0 ? (totalTripFundOverview / termTotalTarget) * 100 : 0;

  let visualPRoom = (pRoom > 0 && pRoom < 2) ? 2 : pRoom;
  let visualPTrip = (pTrip > 0 && pTrip < 2) ? 2 : pTrip;
  if (visualPRoom + visualPTrip > 100) {
    visualPRoom = pRoom;
    visualPTrip = pTrip;
  }


  const currentRules = getTermConfig(selectedTerm, activeTab, currentYearInt);
  const maxWeeksInTable = currentRules.weeks || 0;
  const isDayUnit = currentRules.unit === 'วัน';


  const targetStudentYear = recordTarget?.year || currentYearInt || 1;
  const recordRules = getTermConfig(selectedTerm, activeTab, targetStudentYear);
  const parsedAmount = parseFloat(amount) || 0;
  const isAmountValid = recordRules.allowed && parsedAmount >= recordRules.minAmount && parsedAmount <= recordRules.maxAmount && (parsedAmount % recordRules.rate === 0);
  const calculatedUnits = recordRules.allowed && isAmountValid ? Number((parsedAmount / recordRules.rate).toFixed(2)) : 0;

  const themeRoom = { text: 'text-purple-600', bgActive: 'bg-purple-600 text-white shadow-md', bgHover: 'hover:bg-purple-50', icon: 'text-purple-500', badge: 'bg-purple-100 text-purple-800', gradient: 'bg-gradient-to-r from-purple-500 to-fuchsia-500', btnPrimary: 'bg-purple-600 hover:bg-purple-700', lightCard: 'bg-purple-50/50 border-purple-50', donutSlice: '#a855f7' };
  const themeTrip = { text: 'text-pink-600', bgActive: 'bg-pink-600 text-white shadow-md', bgHover: 'hover:bg-pink-50', icon: 'text-pink-500', badge: 'bg-pink-100 text-pink-800', gradient: 'bg-gradient-to-r from-pink-500 to-rose-400', btnPrimary: 'bg-pink-600 hover:bg-pink-700', lightCard: 'bg-pink-50/50 border-pink-50', donutSlice: '#ec4899' };
  const currentTheme = activeTab === 'room' ? themeRoom : themeTrip;

  const targetTotalStudentPayment = (currentRules?.target || 0) * (studentsWithSummary.length || 0);
  const collectedStudentPayment = studentsWithSummary.reduce((sum, s) => sum + (s.totalPaid || 0), 0);
  const totalOtherIncome = otherTransactionsList.filter(t => t?.type === 'income').reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);
  const totalOtherExpense = otherTransactionsList.filter(t => t?.type === 'expense').reduce((sum, t) => sum + (Number(t?.amount) || 0), 0);

  const targetPromptPayNumber = activeTab === 'room' ? PROMPTPAY_ROOM : PROMPTPAY_TRIP;
  const qrPayloadStr = generatePromptPayPayload(targetPromptPayNumber, amount);
  const finalQrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(qrPayloadStr)}`;

  return (

    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans pb-12">
      <style>{`
        input[type="password"]::-ms-reveal,
        input[type="password"]::-ms-clear { display: none; }
      `}</style>
      
      <nav className="bg-gradient-to-r from-indigo-800 via-indigo-600 to-violet-600 text-white shadow-lg sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <img src="/Logo.png" style={{width: '15%'}} alt="Logo" />
              <span className="text-xl font-bold tracking-wide">EdTech<span className="text-indigo-200">Fund67</span></span>
            </div>
            <div className="flex items-center space-x-3 md:space-x-4">
              <button type="button" onClick={() => setCurrentView('overview')} className={`px-3 md:px-4 py-2 rounded-xl transition-all font-medium text-sm md:text-base ${currentView === 'overview' ? 'bg-white/20 shadow-inner text-white' : 'hover:bg-white/10 text-indigo-100'}`}>แดชบอร์ด</button>
              <button type="button" onClick={() => {
                setCurrentView('manage');
                setActiveTab('room');
                setShowTableView(false);
              }} className={`px-3 md:px-4 py-2 rounded-xl transition-all font-medium text-sm md:text-base ${currentView === 'manage' ? 'bg-white/20 shadow-inner text-white' : 'hover:bg-white/10 text-indigo-100'}`}>จัดการเงิน</button>
              
              {currentUser ? (
                <div className="flex items-center space-x-3 ml-2 md:ml-4 border-l border-white/20 pl-3 md:pl-4">
                  <div className="text-sm text-indigo-50 flex flex-col items-end">
                    <span className="font-semibold tracking-wide">{currentUser.name}</span>
                    <span className="text-[10px] bg-white/20 px-2.5 py-0.5 rounded-full mt-0.5 shadow-sm backdrop-blur-sm">{currentUser.role === 'admin_room' ? 'ผู้ดูแลห้อง' : currentUser.role === 'admin_trip' ? 'ผู้ดูแลฟิวทริป' : 'นักศึกษา'}</span>
                  </div>
                  <button type="button" onClick={handleLogout} className="p-2 hover:bg-white/20 rounded-full transition-all" title="ออกจากระบบ">
                    <LogOut className="w-5 h-5 text-indigo-100 hover:text-white" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setCurrentView('login')} className="flex items-center space-x-1 bg-white/95 text-indigo-700 px-4 py-2 rounded-full font-bold hover:bg-white hover:scale-105 transition-all shadow-md ml-2 md:ml-4">
                  <LogIn className="w-4 h-4" /><span className="hidden md:inline">เข้าสู่ระบบ</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {currentView !== 'login' && (
        <div className="bg-white border-b border-gray-200 shadow-sm sticky top-[72px] z-20">
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
          <div className="space-y-8 animate-in fade-in duration-500">
            
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Wallet className="text-indigo-600 w-6 h-6" /> ยอดเงินสะสมสุทธิ (ทุกปีการศึกษา)
                </h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-2xl shadow-md p-6 text-white relative overflow-hidden">
                   <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full z-0"></div>
                   <p className="text-indigo-100 font-medium mb-1 relative z-10 flex items-center gap-2"><LayoutDashboard className="w-4 h-4"/> ยอดรวมทั้งสิ้น</p>
                   <h3 className="text-4xl font-bold relative z-10">฿{grandTotalAll.toLocaleString()}</h3>
                </div>
                <div className="bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl shadow-md p-6 text-white relative overflow-hidden">
                   <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full z-0"></div>
                   <p className="text-purple-100 font-medium mb-1 relative z-10 flex items-center gap-2"><Users className="w-4 h-4"/> เงินห้องสะสม</p>
                   <h3 className="text-4xl font-bold relative z-10">฿{grandTotalRoom.toLocaleString()}</h3>
                </div>
                <div className="bg-gradient-to-br from-pink-500 to-pink-700 rounded-2xl shadow-md p-6 text-white relative overflow-hidden">
                   <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/10 rounded-full z-0"></div>
                   <p className="text-pink-100 font-medium mb-1 relative z-10 flex items-center gap-2"><Wallet className="w-4 h-4"/> เงินฟิวทริปสะสม</p>
                   <h3 className="text-4xl font-bold relative z-10">฿{grandTotalTrip.toLocaleString()}</h3>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                  <Target className="text-indigo-600 w-6 h-6" /> เป้าหมายประจำเทอม ({formatTermName(selectedTerm)})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-50 rounded-full z-0 opacity-50"></div>
                  <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2 relative z-10"><Wallet className="w-4 h-4 text-indigo-500"/> เก็บได้เทอมนี้ (รวม)</p>
                  <h3 className="text-3xl font-bold text-gray-900 relative z-10">฿{totalAllFunds.toLocaleString()}</h3>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-50 rounded-full z-0 opacity-50"></div>
                  <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2 relative z-10"><Users className="w-4 h-4 text-purple-500"/> เงินห้องเทอมนี้</p>
                  <h3 className="text-3xl font-bold text-gray-900 relative z-10">฿{totalRoomFundOverview.toLocaleString()}</h3>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-pink-50 rounded-full z-0 opacity-50"></div>
                  <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2 relative z-10"><Wallet className="w-4 h-4 text-pink-500"/> ฟิวทริปเทอมนี้</p>
                  <h3 className="text-3xl font-bold text-gray-900 relative z-10">฿{totalTripFundOverview.toLocaleString()}</h3>
                </div>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col justify-center relative overflow-hidden">
                  <div className="absolute -right-4 -top-4 w-24 h-24 bg-gray-50 rounded-full z-0 opacity-50"></div>
                  <p className="text-sm font-medium text-gray-500 mb-1 flex items-center gap-2 relative z-10"><Users className="w-4 h-4 text-gray-500"/> จำนวนสมาชิกเป้าหมาย</p>
                  <h3 className="text-3xl font-bold text-gray-900 relative z-10">{expectedStudentCount} <span className="text-base font-normal text-gray-500">คน</span></h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2"><Target className="w-5 h-5 text-indigo-500" />ความคืบหน้า (เทอมนี้)</h3>
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
                    <div className="flex justify-between text-xs font-medium"><span className="text-indigo-600">เก็บแล้ว: ฿{totalAllFunds.toLocaleString()}</span><span className="text-gray-500">เป้าหมาย: ฿{termTotalTarget.toLocaleString()}</span></div>
                  </div>
                  <div className={`${themeRoom.lightCard} rounded-xl p-4 border hover:shadow-sm transition-shadow`}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3"><div className={`p-2 bg-white rounded-lg shadow-sm ${themeRoom.text}`}><Users className="w-4 h-4" /></div><span className="font-bold text-gray-800">เงินห้อง</span></div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm ${themeRoom.badge}`}>{roomPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200/80 rounded-full h-3 mb-2 shadow-inner overflow-hidden">
                      <div className={`bg-gradient-to-r from-purple-400 to-fuchsia-500 h-3 rounded-full transition-all duration-1000`} style={{ width: `${roomPercent}%`, minWidth: roomPercent > 0 ? '12px' : '0' }}></div>
                    </div>
                    <div className="flex justify-between text-xs font-medium"><span className={themeRoom.text}>เก็บแล้ว: ฿{totalRoomFundOverview.toLocaleString()}</span><span className="text-gray-500">เป้าหมาย: ฿{termTargetRoom.toLocaleString()}</span></div>
                  </div>
                  <div className={`${themeTrip.lightCard} rounded-xl p-4 border hover:shadow-sm transition-shadow`}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center gap-3"><div className={`p-2 bg-white rounded-lg shadow-sm text-pink-600`}><Wallet className="w-4 h-4" /></div><span className="font-bold text-gray-800">เงินฟิวทริป</span></div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold shadow-sm bg-pink-100 text-pink-800`}>{tripPercent.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-gray-200/80 rounded-full h-3 mb-2 shadow-inner overflow-hidden">
                      <div className={`bg-gradient-to-r from-pink-400 to-rose-500 h-3 rounded-full transition-all duration-1000`} style={{ width: `${tripPercent}%`, minWidth: tripPercent > 0 ? '12px' : '0' }}></div>
                    </div>
                    <div className="flex justify-between text-xs font-medium"><span className="text-pink-600">เก็บแล้ว: ฿{totalTripFundOverview.toLocaleString()}</span><span className="text-gray-500">เป้าหมาย: ฿{termTargetTrip.toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2 mb-6"><PieChart className="w-5 h-5 text-indigo-500" />สัดส่วนความสำเร็จ</h3>
                <div className="flex items-center justify-center gap-8 h-48">
                  <div className="relative w-32 h-32 rounded-full flex items-center justify-center shadow-inner" style={{ background: `conic-gradient(#a855f7 0% ${visualPRoom}%, #ec4899 ${visualPRoom}% ${visualPRoom + visualPTrip}%, #f3f4f6 ${visualPRoom + visualPTrip}% 100%)` }}>
                    <div className="w-24 h-24 bg-white rounded-full flex flex-col items-center justify-center shadow-sm">
                      <span className="text-xs text-gray-500">เก็บได้แล้ว</span><span className="font-bold text-gray-800 text-lg">{totalPercent.toFixed(1)}%</span>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full bg-purple-500`}></div><span className="text-sm text-gray-600">เงินห้อง ({pRoom.toFixed(1)}%)</span></div>
                    <div className="flex items-center gap-2"><div className={`w-3 h-3 rounded-full bg-pink-500`}></div><span className="text-sm text-gray-600">เงินฟิวทริป ({pTrip.toFixed(1)}%)</span></div>
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100"><div className="w-3 h-3 rounded-full bg-gray-200"></div><span className="text-sm text-gray-400">ยังขาดอีก ฿{Math.max(0, termTotalTarget - totalAllFunds).toLocaleString()}</span></div>
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
                    <div key={notif?.id} className="bg-white p-4 rounded-xl border border-yellow-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">รายการของ: <span className="text-indigo-600">{notif?.studentName}</span> <span className="text-gray-500 text-xs ml-2">({formatDate(notif?.timestamp)})</span></p>
                        <p className="text-sm text-gray-600 mt-1 flex items-start gap-1"><MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" /><span><span className="font-semibold text-gray-700">เหตุผล:</span> {notif?.reason}</span></p>
                        <p className="text-xs text-gray-500 mt-1">แจ้งโดย: {notif?.notifiedBy} | ยอดเดิม: ฿{(notif?.originalAmount || 0).toLocaleString()}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button type="button" onClick={() => { const txToEdit = transactions.find(t => t?.id === notif?.txId); if (txToEdit) { setEditingTx(txToEdit); setEditAmount(txToEdit?.amount); setEditModalOpen(true); } }} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-lg text-sm font-medium transition">แก้ไขรายการนี้</button>
                        <button type="button" onClick={() => markNotificationResolved(notif?.id)} className="px-3 py-1.5 bg-green-50 text-green-600 hover:bg-green-100 rounded-lg text-sm font-medium transition flex items-center gap-1"><Check className="w-4 h-4" /> จัดการแล้ว</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex space-x-2 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
              <button type="button" onClick={() => { setActiveTab('room'); setShowTableView(false); }} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${activeTab === 'room' ? themeRoom.bgActive : 'text-gray-500 hover:bg-purple-50'}`}><Users className="w-5 h-5" /> บัญชีเงินห้อง</button>
              <button type="button" onClick={() => { setActiveTab('trip'); setShowTableView(false); }} className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold transition-all ${activeTab === 'trip' ? themeTrip.bgActive : 'text-gray-500 hover:bg-pink-50'}`}><Wallet className="w-5 h-5" /> บัญชีเงินฟิวทริป</button>
            </div>

            <div className={`rounded-2xl shadow-sm border p-6 flex items-center justify-between text-white ${currentTheme.gradient}`}>
              <div><p className="text-white/90 font-medium mb-1 flex items-center gap-2"><Calendar className="w-4 h-4" /> ยอดรวมประจำเทอมนี้</p><h2 className="text-4xl md:text-5xl font-bold mt-1">฿{totalActiveFund.toLocaleString()}</h2></div>
              <div className="p-4 bg-white/20 rounded-full backdrop-blur-sm hidden sm:block">{activeTab === 'room' ? <Users className="w-10 h-10" /> : <Wallet className="w-10 h-10" />}</div>
            </div>

            {/* --- ปุ่มสลับมุมมองตาราง --- */}
            <div className="flex justify-end">
              <button 
                type="button"
                onClick={() => setShowTableView(!showTableView)} 
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-sm transition-all shadow-sm border ${showTableView ? currentTheme.bgActive : 'bg-white text-gray-600 hover:bg-gray-50 border-gray-200'}`}
              >
                {showTableView ? <><LayoutList className="w-4 h-4"/> กลับไปมุมมองปกติ</> : <><Table className="w-4 h-4"/> ดูข้อมูลแบบตาราง (Excel)</>}
              </button>
            </div>

            {/* --- แสดงมุมมองตาราง (TABLE VIEW) --- */}
            {showTableView ? (
              <div className="space-y-8 animate-in fade-in duration-300">
                {/* 1. ตารางเงินเก็บรายสัปดาห์ (แต่งให้เหมือน Excel) */}
                <div className="bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-4 flex justify-between items-center bg-white border-b border-gray-300">
                    <h3 className={`font-bold text-lg flex items-center gap-2 ${currentTheme.text}`}>
                      <Table className="w-5 h-5" /> 
                      เงินเก็บรับน้อง {activeTab === 'room' ? 'ED-TECH' : 'ฟิวทริป'} เทอม {formatTermName(selectedTerm).replace('ปี ', '').replace(' เทอม ', ' / ')}
                    </h3>
                    <div className="relative w-64">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" placeholder="ค้นหารหัสนศ. หรือ ชื่อ..." value={studentSearchQuery} onChange={(e) => setStudentSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
                    </div>
                  </div>
                  
                  {!currentRules.allowed ? (
                    <div className="p-8 text-center text-gray-500 font-medium bg-gray-50">{currentRules.message}</div>
                  ) : (
                    <div className="overflow-x-auto pb-4">
                      <table className="w-full text-sm text-left border-collapse border border-gray-300 whitespace-nowrap">
                        <thead className="bg-blue-50 text-blue-900">
                          <tr>
                            <th className="px-4 py-3 font-bold border border-gray-300 text-center w-16">ลำดับ</th>
                            <th className="px-4 py-3 font-bold border border-gray-300 text-center w-28">รหัสนักศึกษา</th>
                            <th className="px-4 py-3 font-bold border border-gray-300 text-center w-48">ชื่อ - นามสกุล</th>
                            <th className="px-4 py-3 font-bold border border-gray-300 text-center bg-orange-50 text-orange-800">ชั้นปี</th>
                            <th className="px-4 py-3 font-bold border border-gray-300 text-right">ยอดรวม</th>
                            
                            {/* หัวตารางวาดตามจำนวนสัปดาห์/วัน ที่ตั้งค่าไว้ */}
                            {Array.from({ length: maxWeeksInTable }).map((_, i) => (
                              <th key={i} className="px-2 py-3 font-bold border border-gray-300 text-center w-16 bg-purple-50 text-purple-900">
                                {isDayUnit ? 'D' : 'W'}{i+1}
                              </th>
                            ))}
                            {/* ✅ เพิ่มคอลัมน์ จัดการ ให้สามารถกดได้ในมุมมองตารางด้วย */}
                            {currentUser && <th className="px-4 py-3 font-bold border border-gray-300 text-center w-24">จัดการ</th>}
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {studentsWithSummary?.map((s, idx) => (
                            <tr key={s?.id || idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-3 text-center border border-gray-300 text-gray-800">{idx + 1}</td>
                              <td className="px-4 py-3 font-mono text-center border border-gray-300 text-gray-800">{s?.id}</td>
                              <td className="px-4 py-3 font-medium border border-gray-300 text-gray-800">{s?.name}</td>
                              <td className="px-4 py-3 text-center border border-gray-300 font-bold text-indigo-600 bg-indigo-50/30">ปี {s?.year || currentYearInt || 1}</td>
                              <td className="px-4 py-3 text-right border border-gray-300 font-bold text-emerald-600">฿{(s?.totalPaid || 0).toLocaleString()}</td>
                              
                              {/* วาดช่องตารางตามจำนวนสัปดาห์ */}
                              {Array.from({ length: maxWeeksInTable }).map((_, i) => {
                                const val = s?.weeks?.[i]; 
                                return (
                                  <td key={`week-${s?.id || idx}-${i}`} className="px-2 py-3 text-center border border-gray-300 bg-white">
                                    {val > 0 ? (
                                      <span className="font-bold text-emerald-600">{val}</span>
                                    ) : (i < (s?.weeks?.length || 0) ? (
                                      <span className="text-gray-300 font-medium">-</span>
                                    ) : null)}
                                  </td>
                                );
                              })}
                              
                              {/* ✅ ปุ่มจ่ายเงิน ในมุมมองตาราง */}
                              {currentUser && (
                                <td className="px-4 py-3 border text-center bg-white sticky right-0 shadow-sm">
                                  {s?.allowed ? (
                                    <button type="button" onClick={(e) => { e.preventDefault(); openRecordModal(s); }} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors bg-gray-100 hover:bg-gray-200 ${currentTheme.text} inline-flex items-center gap-1`}>
                                      <PlusCircle className="w-3.5 h-3.5" /> จ่ายเงิน
                                    </button>
                                  ) : <span className="text-gray-300 text-xs">-</span>}
                                </td>
                              )}
                            </tr>
                          ))}
                          {/* ✅ 2. ชุดโค้ดสรุปท้ายตารางใหม่ (4 บรรทัด) */}
                          <tr className="bg-blue-50/50">
                            <td colSpan="4" className="px-4 py-2.5 text-right font-bold border border-gray-300 text-blue-900">
                              เป้าหมายเงินเก็บสมาชิก ({studentsWithSummary.length} คน × ฿{currentRules?.target || 0})
                            </td>
                            <td className="px-4 py-2.5 text-right font-bold border border-gray-300 text-blue-700">
                              ฿{targetTotalStudentPayment.toLocaleString()}
                            </td>
                            <td colSpan={currentUser ? maxWeeksInTable + 1 : maxWeeksInTable} className="px-4 py-2.5 border border-gray-300 bg-gray-50 text-gray-600 font-medium">
                              <span className="text-emerald-600">เก็บได้จริง: ฿{collectedStudentPayment.toLocaleString()}</span> 
                              <span className="mx-3 text-gray-300">|</span> 
                              <span className="text-red-500">ค้างชำระ: ฿{Math.max(0, targetTotalStudentPayment - collectedStudentPayment).toLocaleString()}</span>
                            </td>
                          </tr>
                          <tr className="bg-emerald-50">
                            <td colSpan="4" className="px-4 py-2 text-right font-bold border border-gray-300 text-emerald-900">รวมรายรับอื่นๆ (เทอมนี้)</td>
                            <td className="px-4 py-2 text-right font-bold border border-gray-300 text-emerald-600">+ ฿{totalOtherIncome.toLocaleString()}</td>
                            <td colSpan={currentUser ? maxWeeksInTable + 1 : maxWeeksInTable} className="border border-gray-300 bg-gray-50"></td>
                          </tr>
                          <tr className="bg-rose-50">
                            <td colSpan="4" className="px-4 py-2 text-right font-bold border border-gray-300 text-rose-900">รวมรายจ่ายอื่นๆ (เทอมนี้)</td>
                            <td className="px-4 py-2 text-right font-bold border border-gray-300 text-rose-600">- ฿{totalOtherExpense.toLocaleString()}</td>
                            <td colSpan={currentUser ? maxWeeksInTable + 1 : maxWeeksInTable} className="border border-gray-300 bg-gray-50"></td>
                          </tr>
                          <tr className="bg-indigo-100">
                            <td colSpan="4" className="px-4 py-3 text-right font-black border border-gray-300 text-indigo-900 text-base">ยอดเงินสุทธิ (เทอมนี้)</td>
                            <td className="px-4 py-3 text-right font-black border border-gray-300 text-indigo-700 text-base">฿{totalActiveFund.toLocaleString()}</td>
                            <td colSpan={currentUser ? maxWeeksInTable + 1 : maxWeeksInTable} className="border border-gray-300 bg-gray-50"></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 2. ตารางรายรับ-รายจ่ายอื่นๆ */}
                <div className="bg-white shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-300 bg-white flex justify-between items-center">
                    <h3 className="font-bold text-lg text-emerald-700 flex items-center gap-2">
                      <FileText className="w-5 h-5" /> รายรับ - รายจ่ายอื่น ๆ
                    </h3>
                    <div className="flex gap-2">
                      <div className="relative w-48">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input type="text" placeholder="ค้นหารายการ..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white" />
                      </div>
                      {currentUser && currentUser.role === `admin_${activeTab}` && (
                        <button type="button" onClick={openOtherRecordModal} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"><PlusCircle className="w-3.5 h-3.5" /> เพิ่มรายการ</button>
                      )}
                    </div>
                  </div>
                  
                  <div className="overflow-x-auto pb-4">
                    <table className="w-full text-sm text-left border-collapse border border-gray-300 whitespace-nowrap">
                      <thead className="bg-purple-100 text-purple-900">
                        <tr>
                          <th className="px-4 py-2 font-bold border border-gray-300 w-32 text-center">วัน/เดือน/ปี</th>
                          <th className="px-4 py-2 font-bold border border-gray-300 text-center">รายการ</th>
                          <th className="px-4 py-2 font-bold border border-gray-300 text-center w-32">จำนวน (บาท)</th>
                          <th className="px-4 py-2 font-bold border border-gray-300 w-48 text-center">หมายเหตุ</th>
                          <th className="px-4 py-2 font-bold border border-gray-300 text-center w-32">หลักฐานการโอน</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {filteredOtherTransactions?.length > 0 ? filteredOtherTransactions?.map((tx, idx) => (
                          <tr key={tx?.id || `other-${idx}`} className="hover:bg-gray-50 transition-colors">
                            <td className="px-4 py-2 text-center text-gray-800 border border-gray-300">
                              {formatJustDate(tx?.timestamp)}
                            </td>
                            <td className="px-4 py-2 font-medium text-gray-800 border border-gray-300">
                              {tx?.description}
                              {/* ✅ แสดงชื่อผู้รับ/ผู้จ่าย ที่บันทึกไว้ใน studentName */}
                              {tx?.studentName && <div className="text-xs text-gray-500 mt-0.5">รับ/จ่ายกับ: {tx.studentName}</div>}
                            </td>
                            <td className="px-4 py-2 text-center border border-gray-300">
                              <span className={`block font-medium ${tx?.type === 'income' ? 'text-gray-800' : 'text-gray-800'}`}>
                                {tx?.type === 'expense' ? '-' : ''}{tx?.amount}
                              </span>
                            </td>
                            <td className="px-4 py-2 text-gray-600 border border-gray-300 text-xs text-center">{tx?.recordedBy}</td>
                            <td className="px-4 py-2 text-center border border-gray-300">
                              {tx?.slipUrl ? (
                                <button type="button" onClick={() => { setCurrentSlip(tx.slipUrl); setSlipModalOpen(true); }} className="text-blue-500 hover:text-blue-700 mx-auto block" title="ดูหลักฐาน"><ImageIcon className="w-5 h-5" /></button>
                              ) : (
                                <span className="text-gray-300">-</span>
                              )}
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan="5" className="px-4 py-8 text-center text-gray-400 border border-gray-300">ไม่พบรายการรายรับ-รายจ่ายอื่นๆ</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              /* --- แสดงมุมมองกริด (GRID VIEW แบบเดิม) --- */
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[700px] lg:col-span-7">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <h3 className="font-semibold text-lg text-gray-800 mb-3 flex items-center gap-2"><Users className={`w-5 h-5 ${currentTheme.icon}`} /> รายชื่อสมาชิก ({studentsWithSummary.length} คน)</h3>
                    <div className="relative w-full">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input type="text" placeholder="ค้นหารหัสนศ. หรือ ชื่อ-สกุล..." value={studentSearchQuery} onChange={(e) => setStudentSearchQuery(e.target.value)} className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                  </div>

                  <div className="overflow-y-auto flex-1">
                    {!currentRules.allowed ? (
                       <div className="p-8 text-center text-gray-500 font-medium">{currentRules.message}</div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead className="bg-white sticky top-0 shadow-sm z-10">
                          <tr className="text-gray-400 text-xs uppercase tracking-wider border-b border-gray-100">
                            <th className="px-4 py-3 font-medium text-center w-12">ที่</th><th className="px-4 py-3 font-medium w-24">รหัสนศ.</th><th className="px-4 py-3 font-medium">ชื่อ-สกุล</th><th className="px-4 py-3 font-medium text-center">ชั้นปี</th><th className="px-4 py-3 font-medium text-right">ชำระแล้ว</th><th className="px-4 py-3 font-medium text-right">ค้างชำระ</th>{currentUser && <th className="px-4 py-3 font-medium text-center">จัดการ</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {studentsWithSummary?.map((s, idx) => (
                            <tr key={s?.id || idx} className="hover:bg-gray-50 transition-colors">
                              <td className="px-4 py-4 text-center text-sm text-gray-400">{idx+1}</td><td className="px-4 py-4 text-sm text-gray-500 font-mono">{s?.id}</td><td className="px-4 py-4 font-medium text-sm md:text-base">{s?.name}</td>
                              <td className="px-4 py-4 text-center font-bold text-indigo-600">ปี {s?.year || currentYearInt || 1}</td>
                              <td className="px-4 py-4 text-right"><span className={`font-bold ${(s?.totalPaid || 0)>0?'text-green-600':'text-gray-300'}`}>฿{(s?.totalPaid || 0).toLocaleString()}</span></td>
                              <td className="px-4 py-4 text-right">{(s?.remainingAmount || 0)>0 && s?.allowed?<span className="font-semibold text-red-500 text-sm">฿{(s?.remainingAmount || 0).toLocaleString()}</span>:(s?.allowed?<span className="font-semibold text-emerald-500 text-sm inline-flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> ครบ</span>:<span className="text-sm text-gray-400">-</span>)}</td>
                              {/* ✅ ปุ่มจ่ายเงิน ในมุมมองกริด */}
                              {currentUser && <td className="px-4 py-4 text-center">{s?.allowed ? <button type="button" onClick={(e) => { e.preventDefault(); openRecordModal(s); }} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors bg-gray-100 hover:bg-gray-200 ${currentTheme.text} inline-flex items-center gap-1`}><PlusCircle className="w-3.5 h-3.5" /> จ่ายเงิน</button> : <span className="text-gray-300 text-xs">-</span>}</td>}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[700px] lg:col-span-5">
                  <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2"><Clock className={`w-5 h-5 ${currentTheme.icon}`} /> ประวัติรายการ</h3>
                      {currentUser && currentUser?.role === `admin_${activeTab}` && (
                        <button type="button" onClick={openOtherRecordModal} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-800 hover:bg-gray-900 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"><PlusCircle className="w-3.5 h-3.5" /> รับ/จ่ายอื่น</button>
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
                          <th className="px-4 py-3 font-medium">เวลา / ผู้บันทึก</th>
                          <th className="px-4 py-3 font-medium">รายการ</th>
                          <th className="px-4 py-3 font-medium text-right">ยอดเงิน</th>
                          {/* ✅ เพิ่มคอลัมน์ หลักฐาน */}
                          <th className="px-4 py-3 font-medium text-center">หลักฐาน</th>
                          {currentUser && <th className="px-4 py-3 font-medium text-center">จัดการ</th>}
                        </tr>
                       </thead>
                       <tbody className="divide-y divide-gray-50">
                          {filteredHistory?.map(tx => {
                            const canEdit = currentUser?.role === `admin_${tx?.fundType}`;
                            const txHistory = tx?.history || [];
                            const editCount = txHistory.filter(h => h?.action === 'edit').length;
                            const latestAction = txHistory.length > 0 ? txHistory[txHistory.length - 1] : { recordedBy: tx?.recordedBy, timestamp: tx?.timestamp };
                            
                            const isPaid = tx?.status === 'completed' || tx?.status === 'success';

                            return (
                             <tr key={tx?.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="text-[11px] text-gray-500">{formatDate(latestAction?.timestamp)}</div>
                                  <div className={`text-[10px] font-medium mt-0.5 flex items-center gap-1 ${editCount > 0 ? 'text-orange-600' : currentTheme.text}`}><span className={`w-1.5 h-1.5 rounded-full ${editCount > 0 ? 'bg-orange-400' : currentTheme.bgActive.split(' ')[0]}`}></span>{editCount > 0 ? `แก้ครั้งที่ ${editCount} โดย ${latestAction?.recordedBy || '-'}` : `โดย ${latestAction?.recordedBy || '-'}`}</div>
                                  {/* ✅ กู้คืนปุ่มดูประวัติ */}
                                  <button type="button" onClick={() => { setHistoryTx(tx); setHistoryModalOpen(true); }} className={`text-[10px] text-gray-400 hover:${currentTheme.text} flex items-center gap-1 mt-1.5 transition-colors bg-gray-100 px-2 py-0.5 rounded`}><History className="w-3 h-3" /> ประวัติ</button>
                                </td>
                                <td className="px-4 py-3">
                                  {tx?.type === 'student_payment' ? (
                                    <>

                                      <div className="font-medium text-gray-900 text-sm flex items-center flex-wrap gap-1.5">
                                        {tx?.studentName}
                                        {!isPaid && (
                                          <span className="text-[9px] bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-bold whitespace-nowrap flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3"/> รอหลักฐาน
                                          </span>
                                        )}

                                      </div>
                                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">{tx?.studentId}</div>
                                    </>
                                  ) : (
                                    <>
                                      <div className="font-medium text-gray-900 text-sm flex items-center flex-wrap gap-1.5">
                                        {tx?.description}
                                      </div>
                                      {tx?.studentName && <div className="text-[10px] text-gray-500 mt-0.5 truncate">รับ/จ่ายกับ: {tx.studentName}</div>}
                                      <div className={`text-[9px] inline-flex px-1.5 py-0.5 rounded font-medium mt-0.5 ${tx?.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{tx?.type === 'income' ? 'รับสมทบทุน' : 'จ่ายซื้อของ'}</div>
                                    </>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`font-bold text-sm ${tx?.type === 'expense' ? 'text-red-600' : tx?.type === 'income' ? 'text-emerald-600' : !isPaid ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                                    {tx?.type === 'expense' ? '-' : tx?.type === 'income' ? '+' : ''}฿{(tx?.amount || 0).toLocaleString()}
                                  </span>
                                </td>
                                
                                {/* ✅ คอลัมน์ หลักฐาน สำหรับเปิดดูรูป (ดึงออกมาแยกให้ชัดเจน) */}
                                <td className="px-4 py-3 text-center">
                                  {tx?.slipUrl ? (
                                    <button type="button" onClick={() => { setCurrentSlip(tx.slipUrl); setSlipModalOpen(true); }} className="inline-flex items-center justify-center p-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors" title="ดูหลักฐานสลิป">
                                      <ImageIcon className="w-4 h-4" />
                                    </button>
                                  ) : (
                                    <span className="text-gray-300 font-bold">-</span>
                                  )}
                                </td>
                                
                                {/* ✅ คอลัมน์ จัดการ ที่เรียบร้อยขึ้น */}
                                {currentUser && (
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">

                                      {/* 1. ปุ่มแนบสลิป/อัปเดตสลิป (แสดงตลอดเพื่อให้เพิ่มรูปทีหลังได้) */}
                                      {(!isPaid || !tx?.slipUrl) ? (
                                         verifyingHistoryId === tx?.id ? (
                                           <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                                         ) : (
                                           <label className="cursor-pointer p-1.5 text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title={tx?.slipUrl ? "อัปเดตรูปสลิปใหม่" : "แนบรูปสลิป"}>
                                             <Upload className="w-4 h-4" />
                                             <input type="file" accept="image/*" className="hidden" onChange={(e) => handleVerifySlipFromHistory(e, tx)} />
                                           </label>
                                         )
                                      ) : null}

                                      {/* 2. ปุ่มแก้ไข (สำหรับแอดมิน) */}
                                      {canEdit && (
                                        <button type="button" onClick={() => { setEditingTx(tx); setEditAmount(tx?.amount); if (tx?.type !== 'student_payment') setEditDescription(tx?.description); setEditModalOpen(true); }} className={`p-1.5 text-gray-400 hover:${currentTheme.text} hover:bg-gray-100 rounded-lg transition-colors`} title="แก้ไขรายการ"><Edit className="w-4 h-4" /></button>
                                      )}
                                      
                                      {/* 3. ปุ่มแจ้งปัญหา (สำหรับนักศึกษา) */}
                                      {currentUser?.role === 'student' && tx?.type === 'student_payment' && (
                                        <button type="button" onClick={() => { setNotifyTx(tx); setNotifyReason(''); setNotifyModalOpen(true); }} className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" title="แจ้งปัญหา"><Bell className="w-4 h-4" /></button>
                                      )}
                                    </div>
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
            )}
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
                   <label className="block text-sm font-medium text-gray-700 mb-1">รหัสนักศึกษา</label>
                   <input type="text" value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="6720117***" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition" required/>
                 </div>
                 <div>
                   <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่าน (Password)</label>
                   <div className="relative">
                     <input type={showLoginPassword ? "text" : "password"} value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="8 ตัวขึ้นไป" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 focus:ring-2 focus:ring-indigo-500 outline-none transition" required/>
                     <button type="button" onClick={() => setShowLoginPassword(!showLoginPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors">
                       {showLoginPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                     </button>
                   </div>
                 </div>
                 
                 <div className="flex justify-end items-center mt-2">
                   <button type="button" onClick={() => setCpModalOpen(true)} className="text-sm text-indigo-600 hover:text-indigo-800 font-bold transition-colors">
                     เปลี่ยนรหัสผ่าน?
                   </button>
                 </div>


                 <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-sm">เข้าสู่ระบบ</button>
               </form>

               {/* กล่องรหัสทดสอบ เพิ่มพื้นหลังให้เด่นขึ้น */}
               <div className="mt-8 pt-6 border-t border-gray-100">
                 <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-100">
                   <p className="text-sm font-bold text-indigo-900 mb-2 flex items-center gap-1.5"><LogIn className="w-4 h-4"/> ข้อมูลบัญชีแอดมิน:</p>
                   <ul className="text-sm text-indigo-800 space-y-1.5 ml-1">
                     <li>รหัสนักศึกษา <span className="text-indigo-400 mx-1">/</span> 'password'</li>
                     <li><span className="text-indigo-400 mx-1">*กรุณาเปลี่ยนรหัสผ่านเพื่อความปลอดภัย และสิทธิ์ของตนเอง</span></li>
                   </ul>
                 </div>
               </div>

             </div>
           </div>
        )}

        {/* --- MODALS --- */}
        
        {/* Modal เปลี่ยนรหัสผ่าน */}
        {cpModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 shadow-xl flex flex-col">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-indigo-600" />
                  <h3 className="text-lg font-bold text-gray-900">เปลี่ยนรหัสผ่าน</h3>
                </div>
                <button type="button" onClick={() => setCpModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition"><X className="w-5 h-5" /></button>
              </div>
              
              {cpError && <p className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-100 mb-4 font-medium">{cpError}</p>}
              {cpSuccess && <p className="bg-green-50 text-green-600 p-3 rounded-lg text-sm text-center border border-green-100 mb-4 font-medium flex items-center gap-2 justify-center"><CheckCircle2 className="w-4 h-4"/> {cpSuccess}</p>}

              <form onSubmit={submitChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสนักศึกษา (Username)</label>
                  <input type="text" value={cpUsername} onChange={(e) => setCpUsername(e.target.value)} required placeholder="เช่น 65001" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านเดิม</label>
                  <div className="relative">
                    <input type={showCpOldPassword ? "text" : "password"} value={cpOldPassword} onChange={(e) => setCpOldPassword(e.target.value)} required placeholder="รหัสผ่านปัจจุบัน" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                    <button type="button" onClick={() => setShowCpOldPassword(!showCpOldPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCpOldPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">รหัสผ่านใหม่ (8 ตัวอักษรขึ้นไป)</label>
                  <div className="relative">
                    <input type={showCpNewPassword ? "text" : "password"} value={cpNewPassword} onChange={(e) => setCpNewPassword(e.target.value)} required placeholder="รหัสผ่านใหม่" minLength="8" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                    <button type="button" onClick={() => setShowCpNewPassword(!showCpNewPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCpNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">ยืนยันรหัสผ่านใหม่</label>
                  <div className="relative">
                    <input type={showCpConfirmPassword ? "text" : "password"} value={cpConfirmPassword} onChange={(e) => setCpConfirmPassword(e.target.value)} required placeholder="ยืนยันรหัสผ่านใหม่อีกครั้ง" minLength="8" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-12 focus:ring-2 focus:ring-indigo-500 outline-none transition" />
                    <button type="button" onClick={() => setShowCpConfirmPassword(!showCpConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                      {showCpConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={!!cpSuccess} className={`w-full text-white font-bold py-3 rounded-xl flex justify-center items-center gap-2 shadow-sm transition-colors ${cpSuccess ? 'bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'}`}>
                  ยืนยันการเปลี่ยนรหัสผ่าน
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Payment Modal (QR Code & Processing) */}
        {recordModalOpen && recordTarget && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-[340px] shadow-2xl overflow-hidden relative flex flex-col max-h-[90vh]">
              
              <button type="button" onClick={closeRecordModal} className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center bg-black/20 hover:bg-black/40 text-white rounded-full transition-colors">
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

                {!recordRules.allowed ? (
                  <div className="bg-red-50 text-red-600 p-4 rounded-xl text-center border border-red-100"><ShieldAlert className="w-8 h-8 mx-auto mb-2" /><p className="font-bold">{recordRules.message}</p></div>
                ) : (
                  <>
                    {paymentStep === 'input' && (
                      <form onSubmit={handleGenerateQR} className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 text-center mb-2">จำนวนเงิน ({recordRules.rate}บ./{recordRules.unit})</label>
                          <input type="number" value={amount} onChange={(e)=>setAmount(e.target.value)} className={`w-full border ${amount && !isAmountValid ? 'border-red-300 focus:ring-red-500 bg-red-50' : 'border-gray-300 focus:ring-indigo-500 bg-gray-50'} rounded-xl px-4 py-3 text-center text-3xl font-bold outline-none transition`} placeholder={`เช่น ${recordRules.rate}, ${recordRules.rate * 2}, ${recordRules.rate * 3}`} required/>
                          <div className="mt-2 text-center h-10 flex items-center justify-center">
                            {amount && !isAmountValid ? (
                              <p className="text-[11px] font-bold text-red-500 leading-tight">
                                กรอกตัวเลขให้ถูกต้อง (เพิ่มทีละ {recordRules.rate} เช่น {recordRules.rate}, {recordRules.rate * 2}... )<br/>
                                ช่วงที่อนุญาต: {recordRules.minAmount} - {recordRules.maxAmount} บาท
                              </p>
                            ) : amount && isAmountValid ? (
                              <p className={`text-sm font-bold ${currentTheme.text}`}>เทียบเท่ากับ: {calculatedUnits} {recordRules.unit}</p>
                            ) : null}
                          </div>
                        </div>
                        {/* ✅ อธิบายให้ผู้ใช้เข้าใจว่าปุ่มจะกดได้ก็ต่อเมื่อยอดเงินถูกต้องเท่านั้น */}
                        <button type="submit" disabled={!amount || !isAmountValid} className={`w-full py-3.5 rounded-xl text-white font-bold flex justify-center items-center gap-2 transition-colors ${(!amount || !isAmountValid) ? 'bg-gray-300 cursor-not-allowed' : currentTheme.btnPrimary}`}>
                          <QrCode className="w-5 h-5" /> ดำเนินการชำระเงิน
                        </button>
                      </form>
                    )}

                    {paymentStep === 'qr' && (
                      <div className="text-center animate-in fade-in zoom-in duration-300 flex flex-col items-center">
                        <p className="text-sm font-medium text-gray-500 mb-2">สแกนเพื่อชำระ {activeTab === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'}</p>
                        <div className="bg-white p-2 inline-block border-2 border-gray-100 rounded-2xl mb-2 relative">
                           <img 
                            src={finalQrImageUrl} 
                            alt="PromptPay QR"
                            className={`w-40 h-40 transition-opacity ${qrTimeLeft === 0 ? 'opacity-20' : 'opacity-100'}`}
                            />
                           {qrTimeLeft === 0 && <div className="absolute inset-0 flex items-center justify-center"><span className="bg-red-100 text-red-600 px-3 py-1 rounded-full font-bold text-sm">หมดเวลา</span></div>}
                        </div>
                        <h3 className="text-2xl font-bold mb-2">฿{parsedAmount}</h3>
                        
                        {qrTimeLeft > 0 ? (
                          <div className="w-full space-y-2 mt-1">
                            {isVerifying ? (
                              <div className="flex flex-col items-center justify-center py-4 bg-gray-50 rounded-xl border border-gray-100">
                                <Loader2 className={`w-8 h-8 animate-spin ${currentTheme.text} mb-2`} />
                                <span className="font-bold text-sm text-gray-600">กำลังตรวจสอบสลิป...</span>
                              </div>
                            ) : (
                              <>
                                <div className={`flex items-center justify-center gap-2 ${currentTheme.text} mb-2`}>
                                  <Clock className="w-4 h-4" />
                                  <span className="font-bold text-sm">เมื่อโอนแล้ว กรุณาแนบสลิป ({Math.floor(qrTimeLeft / 60)}:{(qrTimeLeft % 60).toString().padStart(2, '0')})</span>
                                </div>
                                <label className={`w-full py-2.5 text-white font-bold rounded-xl text-sm transition-colors cursor-pointer flex justify-center items-center gap-2 shadow-sm ${currentTheme.btnPrimary}`}>
                                  <Upload className="w-4 h-4" />
                                  <span>อัปโหลดสลิปเพื่อยืนยัน</span>
                                  <input type="file" accept="image/*" onChange={handleVerifySlip} className="hidden" />
                                </label>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="w-full space-y-2 mt-2">
                            <p className="text-xs text-orange-500 mb-2">รายการถูกบันทึกไว้ในประวัติ สามารถอัปสลิปย้อนหลังได้</p>
                            <button type="button" onClick={() => setPaymentStep('input')} className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl text-sm transition-colors">กรอกจำนวนเงินใหม่</button>
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

        {/* Modal บันทึกรับจ่ายอื่นๆ */}
        {otherRecordModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm animate-in zoom-in-95 duration-200 shadow-xl flex flex-col max-h-[90vh]">
              <div className="flex justify-between items-start mb-5 shrink-0">
                <div><h3 className="text-xl font-bold">บันทึกรับ/จ่าย อื่นๆ</h3><p className="text-sm font-medium mt-1">ส่วน: <span className={currentTheme.text}>{activeTab === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'}</span></p></div>
                <button type="button" onClick={() => setOtherRecordModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1"><X className="w-5 h-5" /></button>
              </div>
              <form onSubmit={handleRecordOther} className="space-y-4 overflow-y-auto">
                <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
                  <button type="button" onClick={() => setOtherType('income')} className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors ${otherType === 'income' ? 'bg-white shadow text-emerald-600' : 'text-gray-500'}`}><ArrowUpCircle className="w-4 h-4" /> รับเข้า</button>
                  <button type="button" onClick={() => setOtherType('expense')} className={`flex-1 py-2 text-sm font-bold rounded-md flex items-center justify-center gap-1.5 transition-colors ${otherType === 'expense' ? 'bg-white shadow text-red-600' : 'text-gray-500'}`}><ArrowDownCircle className="w-4 h-4" /> จ่ายออก</button>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ทำรายการ</label>
                  <input 
                    type="date" 
                    value={otherDate} 
                    onChange={(e) => setOtherDate(e.target.value)} 
                    required 
                    className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none text-gray-700" 
                  />
                </div>
                <input type="text" value={otherDescription} onChange={(e) => setOtherDescription(e.target.value)} required placeholder="รายละเอียดรายการ" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
                <input type="text" value={otherPerson} onChange={(e) => setOtherPerson(e.target.value)} required placeholder="รับ/จ่าย กับใคร (ระบุชื่อคน หรือชื่อร้านค้า)" className="w-full border border-gray-300 rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 outline-none" />
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
                <button type="button" onClick={() => setEditModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={submitEdit} className="space-y-4 overflow-y-auto">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                  <p className="text-gray-500 flex justify-between mb-1">
                    <span>{editingTx?.type === 'student_payment' ? 'ผู้จ่าย:' : 'ประเภท:'}</span> 
                    <span className="font-medium text-gray-900">
                      {editingTx?.type === 'student_payment' ? editingTx?.studentName : (editingTx?.type === 'income' ? 'รายรับสมทบทุน' : 'รายจ่ายซื้อของ')}
                    </span>
                  </p>
                  <p className="text-gray-500 flex justify-between mb-1">
                    <span>ส่วน:</span> <span className="font-medium text-gray-900">{editingTx?.fundType === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'} (เทอม {editingTx?.term})</span>
                  </p>
                  <p className="text-gray-500 flex justify-between"><span>เวลาเดิม:</span> <span className="text-xs">{formatDate(editingTx?.timestamp)}</span></p>
                </div>

                {editingTx?.type !== 'student_payment' && (
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
                <button type="button" onClick={() => setNotifyModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <form onSubmit={handleNotifySubmit} className="space-y-4 overflow-y-auto">
                <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 text-sm">
                  <p className="text-gray-500 flex justify-between mb-1"><span>ผู้จ่าย:</span> <span className="font-medium text-gray-900">{notifyTx?.studentName}</span></p>
                  <p className="text-gray-500 flex justify-between mb-1"><span>ยอดเงิน:</span> <span className="font-medium text-gray-900">฿{(notifyTx?.amount || 0).toLocaleString()}</span></p>
                  <p className="text-gray-500 flex justify-between"><span>ส่วน:</span> <span className="font-medium text-gray-900">{notifyTx?.fundType === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'} ({formatTermName(notifyTx?.term)})</span></p>
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

        {/* Modal ดูประวัติการแก้ไขของรายการเดียว */}
        {historyModalOpen && historyTx && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl w-full max-w-md animate-in zoom-in-95 duration-200 shadow-xl overflow-hidden flex flex-col max-h-[80vh]">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 shrink-0">
                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <History className={`w-5 h-5 ${currentTheme.icon}`} /> ประวัติการดำเนินการ
                </h3>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => setHistoryModalOpen(false)} className="text-gray-400 hover:text-gray-600 bg-gray-200 hover:bg-gray-300 rounded-full p-1.5 transition">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto flex-1">
                <div className="mb-6 pb-6 border-b border-gray-100">
                  <p className="text-sm text-gray-500 mb-1">
                    {historyTx?.type === 'student_payment' ? 'รายการของ:' : 'รายการ:'} <span className="font-semibold text-gray-900">{historyTx?.type === 'student_payment' ? historyTx?.studentName : historyTx?.description}</span>
                  </p>
                  <p className="text-sm text-gray-500">ส่วน: <span className="font-semibold text-gray-900">{historyTx?.fundType === 'room' ? 'เงินห้อง' : 'เงินฟิวทริป'} (เทอม {historyTx?.term})</span></p>
                  
                  {/* ✅ ปุ่มดูสลิปแบบชัดๆ ในหน้าประวัติ */}
                  {historyTx?.slipUrl && (
                    <div className="mt-4">
                      <button type="button" onClick={() => { setCurrentSlip(historyTx.slipUrl); setSlipModalOpen(true); }} className="w-full py-2.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-colors shadow-sm">
                        <ImageIcon className="w-5 h-5" /> เปิดดูรูปภาพหลักฐานสลิปการโอนเงิน
                      </button>
                    </div>
                  )}
                </div>
                
                <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent">
                  {(historyTx?.history || []).map((h, index) => (
                    <div key={index} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white ${currentTheme.lightCard} ${currentTheme.text} shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 relative z-10`}>
                        {h?.action === 'create' ? <PlusCircle className="w-4 h-4" /> : <Edit className="w-4 h-4" />}
                      </div>
                      <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${h?.action === 'create' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {h?.action === 'create' ? 'เพิ่มรายการ' : `แก้ไขครั้งที่ ${index}`}
                          </span>
                        </div>
                        {h?.description && h?.action === 'edit' && (
                          <p className="text-xs text-gray-500 mb-1 line-clamp-2">แก้รายละเอียด: {h?.description}</p>
                        )}
                        <p className={`text-lg font-bold my-1 ${historyTx?.type === 'expense' ? 'text-red-600' : 'text-gray-900'}`}>
                           {historyTx?.type === 'expense' ? '-' : ''}฿{(h?.amount || 0).toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-600">โดย: <span className="font-medium text-gray-800">{h?.recordedBy}</span></p>
                        <p className="text-xs text-gray-400 mt-1">{formatDate(h?.timestamp)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal ดูหลักฐานสลิปแบบเต็ม */}
        {slipModalOpen && currentSlip && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50" onClick={() => setSlipModalOpen(false)}>
            <div className="relative max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
              <button type="button" onClick={() => setSlipModalOpen(false)} className="absolute -top-12 right-0 text-white hover:text-gray-300 transition flex items-center gap-1 font-bold"><X className="w-6 h-6" /> ปิด</button>
              <img src={currentSlip} alt="หลักฐาน" className="w-full h-auto max-h-[80vh] object-contain rounded-xl shadow-2xl bg-black/50" />
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
