
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Layout } from './components/Layout';
import { AppState, UserProfile, Loan, Transaction } from './types';
import { getFinancialAdvice } from './services/geminiService';

const INTEREST_RATE = 0.3; // 30% as requested
const LOAN_DURATION_HOURS = 48; // 2 days as requested

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [user, setUser] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('microloan_pro_user');
    return saved ? JSON.parse(saved) : {
      phoneNumber: '',
      isLoggedIn: false,
      isKycCompleted: false,
      cibilScore: 720,
      balance: 0,
      loans: [],
      transactions: [],
    };
  });

  // UI & Form States
  const [phoneInput, setPhoneInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [fullName, setFullName] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [loanAmount, setLoanAmount] = useState(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'active' | 'paid' | 'overdue'>('all');

  // Face Detection State
  const videoRef = useRef<HTMLVideoElement>(null);
  const [faceProgress, setFaceProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);

  // AI Chat State
  const [chatInput, setChatInput] = useState('');
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'bot', text: string}[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Persistence
  useEffect(() => {
    localStorage.setItem('microloan_pro_user', JSON.stringify(user));
  }, [user]);

  // CIBIL Monitoring (Simulation)
  useEffect(() => {
    if (!user.isLoggedIn || !user.isKycCompleted) return;
    const monitor = setInterval(() => {
      const now = new Date();
      let penalized = false;
      const updatedLoans = user.loans.map(loan => {
        if (loan.status === 'active' && new Date(loan.dueDate) < now) {
          penalized = true;
          return { ...loan, status: 'overdue' as const };
        }
        return loan;
      });

      if (penalized) {
        setUser(prev => ({
          ...prev,
          loans: updatedLoans,
          cibilScore: Math.max(300, prev.cibilScore - 50)
        }));
      }
    }, 30000); // Check every 30 seconds
    return () => clearInterval(monitor);
  }, [user.isLoggedIn, user.loans]);

  const activeLoan = useMemo(() => user.loans.find(l => l.status === 'active' || l.status === 'overdue'), [user.loans]);

  // --- Handlers ---

  const sendOTP = async () => {
    if (phoneInput.length !== 10) return alert("Enter 10-digit number");
    setIsVerifying(true);
    await new Promise(r => setTimeout(r, 1000));
    setOtpSent(true);
    setIsVerifying(false);
  };

  const verifyOTP = async () => {
    setIsVerifying(true);
    await new Promise(r => setTimeout(r, 800));
    if (otpInput === '1234') {
      setUser(prev => ({ ...prev, phoneNumber: phoneInput, isLoggedIn: true }));
      setView(user.isKycCompleted ? AppState.DASHBOARD : AppState.KYC_FORM);
    } else {
      alert("Invalid OTP. Try 1234");
    }
    setIsVerifying(false);
  };

  const submitKycForm = () => {
    if (fullName.length < 3 || !/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.toUpperCase())) {
      return alert("Enter valid Full Name and PAN (ABCDE1234F)");
    }
    setUser(prev => ({ ...prev, fullName, panNumber: panNumber.toUpperCase() }));
    setView(AppState.BANK_DETAILS);
  };

  const submitBankDetails = () => {
    if (accountNumber.length < 10 || ifscCode.length !== 11) {
      return alert("Invalid Bank Details");
    }
    setUser(prev => ({ ...prev, accountNumber, ifscCode: ifscCode.toUpperCase() }));
    setView(AppState.KYC_FACE);
  };

  const startFaceScan = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      let p = 0;
      const interval = setInterval(() => {
        p += 5;
        setFaceProgress(p);
        if (p >= 40) setFaceDetected(true);
        if (p >= 100) {
          clearInterval(interval);
          completeKyc(stream);
        }
      }, 150);
    } catch (err) {
      alert("Camera access denied. Camera is required for identity check.");
      setView(AppState.BANK_DETAILS);
    }
  };

  const completeKyc = (stream: MediaStream) => {
    stream.getTracks().forEach(t => t.stop());
    setUser(prev => ({ ...prev, isKycCompleted: true }));
    setView(AppState.DASHBOARD);
  };

  const applyForLoan = async () => {
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 2000));
    const now = new Date();
    const due = new Date(now.getTime() + (LOAN_DURATION_HOURS * 60 * 60 * 1000));
    const newLoan: Loan = {
      id: `LN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
      amount: loanAmount,
      repaymentAmount: Math.floor(loanAmount * (1 + INTEREST_RATE)),
      status: 'active',
      appliedDate: now.toISOString(),
      dueDate: due.toISOString(),
    };
    const tx: Transaction = {
      id: `TX-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      type: 'disbursement',
      amount: loanAmount,
      date: now.toISOString(),
      status: 'success'
    };
    setUser(prev => ({
      ...prev,
      balance: prev.balance + loanAmount,
      loans: [newLoan, ...prev.loans],
      transactions: [tx, ...prev.transactions]
    }));
    setIsProcessing(false);
    setView(AppState.DASHBOARD);
  };

  const repayLoan = async () => {
    if (!activeLoan) return;
    setIsProcessing(true);
    await new Promise(r => setTimeout(r, 3000));
    const tx: Transaction = {
      id: `PAY-${Math.random().toString(36).substr(2, 8).toUpperCase()}`,
      type: 'repayment',
      amount: activeLoan.repaymentAmount,
      date: new Date().toISOString(),
      status: 'success'
    };
    setUser(prev => ({
      ...prev,
      balance: Math.max(0, prev.balance - activeLoan.repaymentAmount),
      loans: prev.loans.map(l => l.id === activeLoan.id ? { ...l, status: 'paid', paidDate: tx.date } : l),
      transactions: [tx, ...prev.transactions],
      cibilScore: Math.min(900, prev.cibilScore + 15)
    }));
    setIsProcessing(false);
    setView(AppState.DASHBOARD);
  };

  const askAi = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput;
    setChatInput('');
    setChatHistory(prev => [...prev, { role: 'user', text: msg }]);
    setIsAiLoading(true);
    const res = await getFinancialAdvice(msg, { cibil: user.cibilScore, activeLoan });
    setChatHistory(prev => [...prev, { role: 'bot', text: res }]);
    setIsAiLoading(false);
  };

  // --- Render Views ---

  const renderLogin = () => (
    <div className="flex flex-col h-full justify-center px-4">
      <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-8 shadow-xl">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2" />
        </svg>
      </div>
      <h1 className="text-3xl font-black text-slate-900 leading-tight">Welcome to <br/><span className="text-blue-600">MicroLoan Pro</span></h1>
      <p className="text-slate-500 mt-2 mb-10">Instant credit from ₹100. Pay in 48 hours.</p>
      {!otpSent ? (
        <div className="space-y-4">
          <input type="tel" className="w-full bg-slate-100 p-5 rounded-2xl outline-none font-bold" placeholder="Mobile Number" value={phoneInput} onChange={e => setPhoneInput(e.target.value.replace(/\D/g, '').slice(0, 10))} />
          <button onClick={sendOTP} disabled={isVerifying} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-lg active:scale-95 transition-all">Get Secure OTP</button>
        </div>
      ) : (
        <div className="space-y-4 animate-in slide-in-from-right-8">
          <input type="text" className="w-full bg-slate-100 p-5 rounded-2xl outline-none text-center text-3xl font-black tracking-widest" placeholder="1234" value={otpInput} onChange={e => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          <button onClick={verifyOTP} disabled={isVerifying} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-lg active:scale-95 transition-all">Verify Identity</button>
        </div>
      )}
    </div>
  );

  const renderKycForm = () => (
    <div className="space-y-8 animate-in fade-in">
      <h2 className="text-2xl font-black text-slate-900">KYC Verification</h2>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Full Name (As on PAN)</label>
          <input className="w-full bg-slate-100 p-5 rounded-2xl outline-none font-bold uppercase" placeholder="JOHN DOE" value={fullName} onChange={e => setFullName(e.target.value)} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">PAN Card Number</label>
          <input className="w-full bg-slate-100 p-5 rounded-2xl outline-none font-mono uppercase font-bold" placeholder="ABCDE1234F" value={panNumber} onChange={e => setPanNumber(e.target.value)} />
        </div>
        <button onClick={submitKycForm} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl mt-4">Next: Bank Account</button>
      </div>
    </div>
  );

  const renderBankDetails = () => (
    <div className="space-y-8 animate-in slide-in-from-right-8">
      <h2 className="text-2xl font-black text-slate-900">Bank Details</h2>
      <div className="space-y-4">
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">Account Number</label>
          <input className="w-full bg-slate-100 p-5 rounded-2xl outline-none font-bold" placeholder="0000 0000 0000" value={accountNumber} onChange={e => setAccountNumber(e.target.value.replace(/\D/g, ''))} />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-400 uppercase tracking-widest block mb-2">IFSC Code</label>
          <input className="w-full bg-slate-100 p-5 rounded-2xl outline-none font-mono uppercase font-bold" placeholder="SBIN0001234" value={ifscCode} onChange={e => setIfscCode(e.target.value.slice(0, 11))} />
        </div>
        <button onClick={submitBankDetails} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl mt-4">Next: Biometric Check</button>
      </div>
    </div>
  );

  const renderKycFace = () => {
    useEffect(() => { startFaceScan(); }, []);
    return (
      <div className="flex flex-col h-full space-y-10 animate-in zoom-in-95">
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-900">Liveness Detection</h2>
          <p className="text-slate-500 text-sm">Position your face within the frame.</p>
        </div>
        <div className="relative flex items-center justify-center">
          <div className="w-72 h-72 rounded-full overflow-hidden border-4 border-blue-600 bg-slate-900 shadow-2xl">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover grayscale opacity-80" />
            {faceDetected && <div className="absolute inset-0 border-8 border-emerald-400/50 rounded-full animate-pulse"></div>}
          </div>
          <svg className="absolute w-[300px] h-[300px] -rotate-90">
            <circle cx="150" cy="150" r="145" fill="none" stroke="#E2E8F0" strokeWidth="10" />
            <circle cx="150" cy="150" r="145" fill="none" stroke="#2563EB" strokeWidth="10" strokeDasharray={2 * Math.PI * 145} strokeDashoffset={2 * Math.PI * 145 * (1 - faceProgress / 100)} />
          </svg>
        </div>
        <p className="text-center font-black text-blue-600 uppercase tracking-widest animate-pulse">
          {faceProgress < 40 ? 'Scanning...' : faceProgress < 90 ? 'Analyzing...' : 'Identity Verified'}
        </p>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="flex justify-between items-end">
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">Current Balance</p>
          <h2 className="text-4xl font-black text-slate-900">₹{user.balance.toLocaleString()}</h2>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-1">CIBIL Health</p>
          <div className={`text-2xl font-black ${user.cibilScore > 700 ? 'text-emerald-500' : 'text-rose-500'}`}>{user.cibilScore}</div>
        </div>
      </div>

      {activeLoan ? (
        <div className={`rounded-3xl p-6 shadow-2xl relative overflow-hidden text-white transition-all duration-500 ${activeLoan.status === 'overdue' ? 'bg-rose-600' : 'bg-slate-900'}`}>
          <div className="relative z-10 flex flex-col justify-between h-full space-y-6">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-[10px] font-bold opacity-60 uppercase tracking-widest">Ongoing Loan</span>
                <h4 className="text-2xl font-black mt-1">₹{activeLoan.repaymentAmount}</h4>
              </div>
              <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase ${activeLoan.status === 'overdue' ? 'bg-white text-rose-600' : 'bg-blue-600'}`}>
                {activeLoan.status === 'overdue' ? 'OVERDUE' : 'DUE SOON'}
              </div>
            </div>
            <p className="text-[10px] opacity-70">Due Date: {new Date(activeLoan.dueDate).toLocaleString()}</p>
            <button onClick={() => setView(AppState.PAYMENT_GATEWAY)} className={`w-full py-4 rounded-xl font-black transition-all active:scale-95 ${activeLoan.status === 'overdue' ? 'bg-white text-rose-600' : 'bg-blue-600'}`}>
              Repay Now
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-[2rem] p-10 text-center flex flex-col items-center">
          <h4 className="font-bold text-slate-800">Funds Needed?</h4>
          <p className="text-slate-500 text-xs mb-6 mt-1">Instant disbursement up to ₹5,000</p>
          <button onClick={() => setView(AppState.APPLY)} className="px-10 bg-blue-600 text-white font-black py-4 rounded-full shadow-lg active:scale-95 transition-all">Get Cash Now</button>
        </div>
      )}

      <div>
        <div className="flex justify-between items-center mb-4 px-1">
          <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight">Recent Activity</h5>
          <button onClick={() => setView(AppState.HISTORY)} className="text-xs font-bold text-blue-600">All History &rarr;</button>
        </div>
        <div className="space-y-3">
          {user.transactions.slice(0, 3).map(tx => (
            <div key={tx.id} className="bg-white p-4 rounded-2xl border border-slate-50 flex items-center justify-between shadow-sm">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${tx.type === 'disbursement' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                   {tx.type === 'disbursement' ? '↓' : '↑'}
                </div>
                <p className="text-[10px] font-black text-slate-800 uppercase">{tx.type}</p>
              </div>
              <p className={`font-black ${tx.type === 'disbursement' ? 'text-emerald-500' : 'text-slate-900'}`}>₹{tx.amount}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderApply = () => (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 pb-20">
      <div className="flex items-center space-x-2">
         <button onClick={() => setView(AppState.DASHBOARD)} className="p-2 bg-slate-100 rounded-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
               <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" />
            </svg>
         </button>
         <h2 className="text-xl font-black">Apply for Cash</h2>
      </div>
      <div className="bg-slate-900 p-8 rounded-[2.5rem] text-center text-white relative overflow-hidden shadow-2xl">
         <p className="text-white/40 font-bold mb-2 uppercase text-[10px] tracking-widest">Select Amount</p>
         <h2 className="text-6xl font-black mb-10">₹{loanAmount}</h2>
         <input type="range" min="100" max="5000" step="100" value={loanAmount} onChange={e => setLoanAmount(parseInt(e.target.value))} className="w-full h-2 bg-white/10 rounded-full appearance-none accent-blue-500 cursor-pointer" />
         <div className="flex justify-between mt-4 text-[10px] font-bold text-white/30 uppercase">
            <span>₹100</span>
            <span>₹5,000</span>
         </div>
      </div>
      <div className="bg-white border border-slate-100 rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex justify-between py-3 border-b border-slate-50">
           <span className="text-slate-500 font-medium">Interest (30%)</span>
           <span className="text-rose-500 font-black">+₹{Math.floor(loanAmount * INTEREST_RATE)}</span>
        </div>
        <div className="flex justify-between py-5 bg-blue-50 -mx-6 px-6">
           <span className="text-blue-900 font-black uppercase text-[10px] tracking-widest">Total Repayable</span>
           <span className="text-blue-900 font-black text-2xl">₹{Math.floor(loanAmount * (1 + INTEREST_RATE))}</span>
        </div>
      </div>
      <button onClick={applyForLoan} disabled={isProcessing} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl hover:shadow-2xl transition-all">
         {isProcessing ? 'Verifying Risk...' : 'Get Instant Cash'}
      </button>
    </div>
  );

  const renderHistory = () => (
    <div className="space-y-6 animate-in slide-in-from-right-10 duration-500 pb-20">
      <div className="flex items-center space-x-2">
         <button onClick={() => setView(AppState.DASHBOARD)} className="p-2 bg-slate-100 rounded-full">
           <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" />
           </svg>
         </button>
         <h2 className="text-xl font-black">History</h2>
      </div>
      <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
         {['all', 'active', 'paid', 'overdue'].map(f => (
           <button key={f} onClick={() => setHistoryFilter(f as any)} className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap border-2 transition-all ${historyFilter === f ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white border-slate-100 text-slate-400'}`}>
             {f}
           </button>
         ))}
      </div>
      <div className="space-y-4">
        {user.loans.filter(l => historyFilter === 'all' || l.status === historyFilter).map(l => (
          <div key={l.id} className="bg-white border border-slate-100 p-5 rounded-3xl shadow-sm space-y-4">
             <div className="flex justify-between items-start">
               <div>
                 <p className="text-[10px] text-slate-400 font-bold uppercase">{l.id}</p>
                 <h4 className="font-black text-slate-900 text-lg">₹{l.amount}</h4>
               </div>
               <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase ${
                 l.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 
                 l.status === 'overdue' ? 'bg-rose-100 text-rose-600' : 'bg-blue-100 text-blue-600'
               }`}>
                 {l.status}
               </span>
             </div>
             <div className="flex justify-between text-[10px] font-bold text-slate-500">
                <span>REPAYMENT: ₹{l.repaymentAmount}</span>
                <span>{new Date(l.appliedDate).toLocaleDateString()}</span>
             </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <Layout title={view === AppState.LOGIN ? undefined : "MicroLoan Pro"}>
      {view === AppState.LOGIN && renderLogin()}
      {view === AppState.KYC_FORM && renderKycForm()}
      {view === AppState.BANK_DETAILS && renderBankDetails()}
      {view === AppState.KYC_FACE && renderKycFace()}
      {view === AppState.DASHBOARD && renderDashboard()}
      {view === AppState.APPLY && renderApply()}
      {view === AppState.HISTORY && renderHistory()}

      {view === AppState.PAYMENT_GATEWAY && (
        <div className="fixed inset-0 z-[100] bg-slate-900/90 backdrop-blur-md flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 text-center">
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest">Bill Repayment</p>
              <h3 className="text-5xl font-black text-slate-900 mt-2 mb-10">₹{activeLoan?.repaymentAmount}</h3>
              <div className="space-y-4">
                <button onClick={repayLoan} disabled={isProcessing} className="w-full bg-blue-600 text-white font-black py-5 rounded-2xl shadow-xl">
                   {isProcessing ? 'Connecting UPI...' : 'Pay via UPI'}
                </button>
                <button onClick={() => setView(AppState.DASHBOARD)} className="text-slate-400 font-bold">Cancel</button>
              </div>
           </div>
        </div>
      )}

      {view === AppState.CHAT && (
        <div className="flex flex-col h-[75vh]">
          <div className="flex items-center space-x-2 mb-6">
             <button onClick={() => setView(AppState.DASHBOARD)} className="p-2 bg-slate-100 rounded-full">
               <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" />
               </svg>
             </button>
             <h3 className="text-xl font-black">Finly Advisor</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-hide">
             {chatHistory.map((m, i) => (
               <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] px-5 py-4 rounded-3xl text-sm ${m.role === 'user' ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border border-slate-100 text-slate-800 rounded-bl-none'}`}>
                     {m.text}
                  </div>
               </div>
             ))}
             {isAiLoading && <div className="text-[10px] text-slate-400 animate-pulse font-bold ml-2">Thinking...</div>}
          </div>
          <div className="relative">
            <input className="w-full px-6 py-5 bg-slate-100 rounded-[1.5rem] outline-none pr-16 focus:ring-2 focus:ring-blue-600" value={chatInput} onChange={e => setChatInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && askAi()} placeholder="Ask me anything..." />
            <button onClick={askAi} className="absolute right-3 top-3 bottom-3 bg-blue-600 text-white px-4 rounded-xl font-black active:scale-90 transition-all">Send</button>
          </div>
        </div>
      )}

      {/* Main Nav */}
      {![AppState.LOGIN, AppState.KYC_FORM, AppState.BANK_DETAILS, AppState.KYC_FACE, AppState.PAYMENT_GATEWAY].includes(view) && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-slate-100 h-20 flex justify-around items-center px-4 z-50">
          <button onClick={() => setView(AppState.DASHBOARD)} className={`p-3 rounded-2xl ${view === AppState.DASHBOARD ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" /></svg>
          </button>
          <button onClick={() => setView(AppState.APPLY)} className="w-14 h-14 bg-blue-600 rounded-full -mt-12 shadow-xl flex items-center justify-center text-white border-[6px] border-white active:scale-90 transition-all">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" /></svg>
          </button>
          <button onClick={() => setView(AppState.CHAT)} className={`p-3 rounded-2xl ${view === AppState.CHAT ? 'bg-blue-50 text-blue-600' : 'text-slate-400'}`}>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
          </button>
        </nav>
      )}
    </Layout>
  );
};

export default App;
