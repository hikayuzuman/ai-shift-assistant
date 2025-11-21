import React, { useState, useMemo, useEffect } from 'react';
import {
  Users, Calendar, Settings, Printer, Wand2, Clock, Edit3, Filter, Trash2, Plus, X,
  ClipboardList, Database, ChevronLeft, ChevronRight, Lock, RotateCcw, FileMinus,
  BarChart3, Loader2, FileText // ← ここ追加！
} from 'lucide-react';

// --- 型定義（変更なし）---
type JobTitle = '施設長' | '副施設長' | '看護師' | '介護リーダー' | '介護職員' | '機能訓練指導員' | 'パート';

type ShiftType = '休' | '有' | '夏' | '冬' | 'ani' | '付' | '◒' | '○' | '▽' | '◑' | '●' | '';

interface ShiftDefinition {
  symbol: ShiftType;
  label: string;
  colorClass: string;
  isWork: boolean;
  isNight?: boolean;
}

const SHIFT_DEFS: Record<string, ShiftDefinition> = {
  '': { symbol: '', label: '未定', colorClass: 'bg-white', isWork: false },
  '◒': { symbol: '◒', label: '早番', colorClass: 'bg-yellow-100 text-yellow-800', isWork: true },
  '○': { symbol: '○', label: '日勤1', colorClass: 'bg-blue-50 text-blue-800', isWork: true },
  '▽': { symbol: '▽', label: '日勤2', colorClass: 'bg-blue-100 text-blue-900', isWork: true },
  '◑': { symbol: '◑', label: '入り', colorClass: 'bg-purple-100 text-purple-800', isWork: true, isNight: true },
  '●': { symbol: '●', label: '明け', colorClass: 'bg-gray-700 text-white', isWork: true, isNight: true },
  '休': { symbol: '休', label: '公休', colorClass: 'bg-red-100 text-red-800', isWork: false },
  '付': { symbol: '付', label: '付加休', colorClass: 'bg-lime-100 text-lime-800', isWork: false },
  '有': { symbol: '有', label: '有給', colorClass: 'bg-orange-100 text-orange-800', isWork: false },
  '夏': { symbol: '夏', label: '夏季休', colorClass: 'bg-teal-100 text-teal-800', isWork: false },
  '冬': { symbol: '冬', label: '冬季休', colorClass: 'bg-cyan-100 text-cyan-800', isWork: false },
  'ani': { symbol: 'ani', label: 'アニバ', colorClass: 'bg-pink-100 text-pink-800', isWork: false },
};

interface Staff {
  id: string;
  code: string;
  name: string;
  title: JobTitle;
  allowedFloors: string[];
  possibleShifts: ShiftType[];
  paidLeaveRemaining: number;
  birthMonth: number;
}

interface ShiftCell {
  type: ShiftType;
  isFixed: boolean;
}

type MonthlyShiftData = Record<string, Record<string, Record<number, ShiftCell>>>;

interface RequiredStaffCount {
  floor: string;
  early: number;
  day: number;
  late: number;
  night: number;
}

interface GlobalSettings {
  holidaysStandard: number;
  holidaysFeb: number;
  maxConsecutiveWork: number;
}

// --- 初期データ（変更なし）---
const INITIAL_STAFF: Staff[] = [ /* 省略（そのまま） */ ];
const FLOORS = ['1F', '2F', '3F'];
const JOB_TITLES: JobTitle[] = ['施設長', '副施設長', '看護師', '介護リーダー', '介護職員', '機能訓練指導員', 'パート'];

const INITIAL_REQUIRED_COUNTS: Record<string, RequiredStaffCount> = { /* 省略 */ };
const INITIAL_GLOBAL_SETTINGS: GlobalSettings = { /* 省略 */ };

const STORAGE_KEYS = { /* 省略 */ };

export default function AI_Shift_Assistant() {
  const [isMounted, setIsMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'shift' | 'staff' | 'rules' | 'config' | 'stats'>('shift');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [staffList, setStaffList] = useState<Staff[]>(INITIAL_STAFF);
  const [requiredCounts, setRequiredCounts] = useState<Record<string, RequiredStaffCount>>(INITIAL_REQUIRED_COUNTS);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>(INITIAL_GLOBAL_SETTINGS);
  const [allShifts, setAllShifts] = useState<MonthlyShiftData>({});
  const [viewMode, setViewMode] = useState<'edit' | 'print'>('edit');
  const [selectedFloor, setSelectedFloor] = useState<string>('All');
  const [isGenerating, setIsGenerating] = useState(false); // ← 追加

  // Modal State（変更なし）
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffForm, setStaffForm] = useState<Partial<Staff>>({});

  // --- データロード＆保存（変更なし）---
  useEffect(() => { /* 省略 */ }, []);
  useEffect(() => { /* 省略 */ }, [staffList, requiredCounts, globalSettings, allShifts, currentDate, isMounted]);

  // --- 派生データ ---
  const targetYear = currentDate.getFullYear();
  const targetMonth = currentDate.getMonth() + 1;
  const daysInMonth = new Date(targetYear, targetMonth, 0).getDate();
  const monthKey = `${targetYear}-${String(targetMonth).padStart(2, '0')}`;
  const today = new Date();

  const currentShiftMap = useMemo(() => allShifts?.[monthKey] || {}, [allShifts, monthKey]);

  // --- シフト更新関数（変更なし）---
  const updateShift = (staffId: string, date: number, newType: ShiftType) => { /* 省略 */ };
  const unlockShift = (staffId: string, date: number) => { /* 省略 */ };

  // === AIシフト生成（夜勤人数をフロア設定から取得するように修正！）===
  const generateShift = async () => {
    if (isGenerating) return;
    setIsGenerating(true);

    const newMonthData: Record<string, Record<number, ShiftCell>> = JSON.parse(JSON.stringify(currentShiftMap));
    const targetStaff = selectedFloor === 'All'
      ? staffList
      : staffList.filter(s => s.allowedFloors.includes(selectedFloor) || s.allowedFloors.includes('All'));

    // （前月引き継ぎなどの初期化処理は省略・そのまま）

    // 夜勤配置（ここが最大の修正点！）
    for (let d = 1; d < daysInMonth; d++) {
      let neededNight = 0;
      if (selectedFloor === 'All') {
        FLOORS.forEach(f => neededNight += requiredCounts[f]?.night || 0);
      } else {
        neededNight = requiredCounts[selectedFloor]?.night || 0;
      }

      const shuffled = [...targetStaff].sort(() => Math.random() - 0.5);
      let placed = 0;
      for (const staff of shuffled) {
        if (placed >= neededNight) break;
        if (newMonthData[staff.id][d]?.type || newMonthData[staff.id][d + 1]?.type) continue;
        if (!staff.possibleShifts.includes('◑') || !staff.possibleShifts.includes('●')) continue;
        if (d > 1 && newMonthData[staff.id][d - 1].type === '◑') continue;

        newMonthData[staff.id][d] = { type: '◑', isFixed: false };
        newMonthData[staff.id][d + 1] = { type: '●', isFixed: false };
        placed++;
      }
    }

    // 以降の処理（休日配置・日勤埋め）はそのまま
    // ...（省略）

    setAllShifts(prev => ({ ...prev, [monthKey]: newMonthData }));
    setIsGenerating(false);
  };

  // その他の関数（clearAutoGenerated, deleteCurrentMonthDataなど）はそのまま

  // --- 描画ヘルパー ---
  const filteredStaffList = useMemo(() => { /* 省略 */ }, [staffList, selectedFloor]);

  const dailyCounts = useMemo(() => { /* 省略 */ }, [currentShiftMap, filteredStaffList, daysInMonth]);

  // 今日かどうか判定
  const isToday = (d: number) => {
    return today.getFullYear() === targetYear &&
           today.getMonth() + 1 === targetMonth &&
           today.getDate() === d;
  };

  // --- コンポーネント ---
  const TabButton = ({ id, label, icon: Icon }: any) => ( /* 省略 */ );

  const EditableCell = ({ staffId, date, cell }: { staffId: string, date: number, cell: ShiftCell | undefined }) => { /* 省略 */ };

  const CountDisplay = ({ label, current, target, color }: { label: string, current: number, target: number, color: string }) => ( /* 省略 */ );

  if (!isMounted) { /* ローディング画面 */ }

  return (
    <>
      {/* 印刷用CSS */}
      <style jsx global>{`
        @media print {
          header, .print\\:hidden { display: none !important; }
          body { background: white; }
          .shadow-lg, .rounded-lg { box-shadow: none !important; border-radius: 0 !important; }
          table { font-size: 10pt; }
          th, td { border: 1px solid #000 !important; padding: 4px !important; }
          .bg-yellow-300 { background-color: #fef9c3 !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
        {/* ヘッダー・タブなど（変更なし） */}

        {/* AI作成ボタン部分（ローディング追加） */}
        <button
          onClick={generateShift}
          disabled={isGenerating}
          className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2.5 rounded font-bold shadow flex items-center gap-2 transition"
        >
          {isGenerating ? (
            <>生成中<Loader2 className="w-5 h-5 animate-spin" /></>
          ) : (
            <>AI作成</>
          )}
        </button>

        {/* シフト表の日付ヘッダー（今日ハイライト追加） */}
        <th
          key={d}
          className={`border border-gray-400 p-1 w-8 
            ${[0,6].includes(new Date(targetYear, targetMonth-1, d).getDay()) ? 'text-red-600 bg-red-50' : ''}
            ${isToday(d) ? 'bg-yellow-300 font-bold' : ''}
          `}
        >
          {d}
        </th>

        {/* 以下、残りのJSXは元のコードと完全に同じでOKです */}
        {/* （省略） */}
      </div>
    </>
  );
}
