import { useState, useEffect, useCallback } from 'react';
import { 
  Users, 
  CheckCircle, 
  Calendar, 
  AlertTriangle, 
  XCircle,
  TrendingUp,
  PieChart,
  Stethoscope,
  Clock
} from 'lucide-react';
import { collection, query, getDocs, where, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  type PieLabelRenderProps
} from 'recharts';

interface Appointment {
  id: string;
  fullName: string;
  age: string;
  doctor: string;
  appointmentDate: string;
  medicalCondition: string;
  priorityLevel: string;
  status: string;
  createdAt: string;
}

interface Doctor {
  id: string;
  name: string;
  specialty: string;
  isActive: boolean;
}

interface Stats {
  totalPatients: number;
  appointmentsCompleted: number;
  finishedThisMonth: number;
  finishedLastMonth: number;
  cancelledAppointments: number;
  emergencyCases: number;
  urgentCases: number;
  normalCases: number;
}

interface DoctorPerformance {
  name: string;
  completed: number;
  confirmed: number;
  pending: number;
  total: number;
  completionRate: number;
}

// Recharts compatible data interfaces
interface BarChartData {
  name: string;
  Appointments: number;
}

interface LineChartData {
  name: string;
  Appointments: number;
}

interface PieChartData {
  name: string;
  value: number;
  [key: string]: string | number; // Add index signature to fix TypeScript error
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

const Reports = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [stats, setStats] = useState<Stats>({
    totalPatients: 0,
    appointmentsCompleted: 0,
    finishedThisMonth: 0,
    finishedLastMonth: 0,
    cancelledAppointments: 0,
    emergencyCases: 0,
    urgentCases: 0,
    normalCases: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load appointments
      const appointmentsRef = collection(db, 'appointments');
      const appointmentsQuery = query(appointmentsRef, orderBy('createdAt', 'desc'));
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const appointmentsData = appointmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Appointment[];
      setAppointments(appointmentsData);

      // Load doctors
      const doctorsRef = collection(db, 'doctors');
      const doctorsQuery = query(doctorsRef, where('isActive', '==', true));
      const doctorsSnapshot = await getDocs(doctorsQuery);
      const doctorsData = doctorsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Doctor[];
      setDoctors(doctorsData);

      // Calculate stats
      calculateStats(appointmentsData);
    } catch (error) {
      console.error('Error loading reports data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const calculateStats = (appointmentsData: Appointment[]) => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const statsData: Stats = {
      totalPatients: appointmentsData.length,
      appointmentsCompleted: appointmentsData.filter(apt => apt.status === 'completed').length,
      finishedThisMonth: appointmentsData.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return apt.status === 'completed' && 
               aptDate.getMonth() === currentMonth && 
               aptDate.getFullYear() === currentYear;
      }).length,
      finishedLastMonth: appointmentsData.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return apt.status === 'completed' && 
               aptDate.getMonth() === lastMonth && 
               aptDate.getFullYear() === lastMonthYear;
      }).length,
      cancelledAppointments: appointmentsData.filter(apt => apt.status === 'cancelled').length,
      emergencyCases: appointmentsData.filter(apt => apt.priorityLevel === 'emergency').length,
      urgentCases: appointmentsData.filter(apt => apt.priorityLevel === 'urgent').length,
      normalCases: appointmentsData.filter(apt => apt.priorityLevel === 'normal').length
    };

    setStats(statsData);
  };

  // Convert to Philippine Time (UTC+8)
  const toPHTime = (date: Date): Date => {
    return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  };

  // Weekly Patient Volume Data - Current Month Calendar Weeks (Weeks 1-4 only)
  const getWeeklyVolumeData = (): BarChartData[] => {
    const weeks: BarChartData[] = [];
    
    // Get current date in Philippine Time
    const nowPH = toPHTime(new Date());
    const currentYear = nowPH.getFullYear();
    const currentMonth = nowPH.getMonth();
    
    // Get first day of the month in PH time
    const firstDayOfMonth = toPHTime(new Date(currentYear, currentMonth, 1));
    
    // Calculate weeks 1-4 based on standardized 7-day blocks starting Monday
    for (let weekNumber = 1; weekNumber <= 4; weekNumber++) {
      // Week 1: Days 1-7, Week 2: Days 8-14, Week 3: Days 15-21, Week 4: Days 22-28
      const weekStartDay = (weekNumber - 1) * 7 + 1;
      const weekEndDay = weekNumber * 7;
      
      // Calculate week start date (day 1, 8, 15, or 22)
      const weekStart = new Date(firstDayOfMonth);
      weekStart.setDate(weekStartDay);
      
      // Calculate week end date (day 7, 14, 21, or 28)
      const weekEnd = new Date(firstDayOfMonth);
      weekEnd.setDate(weekEndDay);
      
      // Count appointments for this week
      const weekAppointments = appointments.filter(apt => {
        const aptDate = toPHTime(new Date(apt.appointmentDate));
        const aptDay = aptDate.getDate();
        
        // Only include appointments from days 1-28 (ignore days 29-31)
        return aptDay >= weekStartDay && 
               aptDay <= weekEndDay &&
               aptDate.getMonth() === currentMonth &&
               aptDate.getFullYear() === currentYear;
      }).length;

      weeks.push({
        name: `Week ${weekNumber}`,
        Appointments: weekAppointments
      });
    }
    
    return weeks;
  };

  // 6-Month Patient Trend Data - Line Chart compatible
  const getSixMonthTrendData = (): LineChartData[] => {
    const months: LineChartData[] = [];
    const now = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthName = month.toLocaleDateString('en-US', { month: 'short' });
      
      const monthAppointments = appointments.filter(apt => {
        const aptDate = new Date(apt.appointmentDate);
        return aptDate.getMonth() === month.getMonth() && 
               aptDate.getFullYear() === month.getFullYear();
      }).length;

      months.push({
        name: monthName,
        Appointments: monthAppointments
      });
    }
    
    return months;
  };

  // Common Medical Conditions Data - Pie Chart compatible
  const getMedicalConditionsData = (): PieChartData[] => {
    const conditions: { [key: string]: number } = {};
    
    appointments.forEach(apt => {
      conditions[apt.medicalCondition] = (conditions[apt.medicalCondition] || 0) + 1;
    });
    
    return Object.entries(conditions)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([name, value]) => ({ name, value }));
  };

  // Priority Level Analysis Data - Pie Chart compatible
  const getPriorityAnalysisData = (): PieChartData[] => [
    { name: 'Emergency', value: stats.emergencyCases },
    { name: 'Urgent', value: stats.urgentCases },
    { name: 'Normal', value: stats.normalCases }
  ];

  // Doctor Performance Data
  const getDoctorPerformanceData = (): DoctorPerformance[] => {
    return doctors.map(doctor => {
      const doctorAppointments = appointments.filter(apt => apt.doctor === doctor.name);
      const completed = doctorAppointments.filter(apt => apt.status === 'completed').length;
      const confirmed = doctorAppointments.filter(apt => apt.status === 'confirmed').length;
      const pending = doctorAppointments.filter(apt => apt.status === 'pending').length;
      const total = doctorAppointments.length;
      
      return {
        name: `Dr. ${doctor.name}`,
        completed,
        confirmed,
        pending,
        total,
        completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
      };
    });
  };

  const getMonthChange = (): number => {
    if (stats.finishedLastMonth === 0) return 100;
    return Math.round(((stats.finishedThisMonth - stats.finishedLastMonth) / stats.finishedLastMonth) * 100);
  };

  // Pie chart label renderer with proper Recharts typing - improved to prevent overlap
  const renderPieLabel = (props: PieLabelRenderProps): string | null => {
    const { name, percent } = props;
    const displayName = name || 'Unknown';
    const displayPercent = percent || 0;
    
    // Only show label if percentage is significant enough to avoid clutter
    if (displayPercent < 0.05) return null;
    
    return `${displayName} (${(displayPercent * 100).toFixed(0)}%)`;
  };

  // Calculate percentage for each status
  const calculateStatusPercentage = (doctor: DoctorPerformance, status: 'completed' | 'confirmed' | 'pending'): number => {
    return doctor.total > 0 ? Math.round((doctor[status] / doctor.total) * 100) : 0;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
          <p className="text-gray-600 mt-2">Comprehensive overview of clinic performance and patient statistics</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Patients */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Patients</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalPatients}</p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </div>

          {/* Appointments Completed */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-gray-900">{stats.appointmentsCompleted}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </div>

          {/* Finished This Month */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">This Month</p>
                <p className="text-2xl font-bold text-gray-900">{stats.finishedThisMonth}</p>
                <p className={`text-xs ${getMonthChange() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {getMonthChange() >= 0 ? '↑' : '↓'} {Math.abs(getMonthChange())}% from last month
                </p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </div>

          {/* Cancelled Appointments */}
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Cancelled</p>
                <p className="text-2xl font-bold text-gray-900">{stats.cancelledAppointments}</p>
              </div>
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Priority Level Analysis Cards with Title */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Priority Level Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Emergency Cases */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-red-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Emergency</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.emergencyCases}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </div>

            {/* Urgent Cases */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-orange-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Urgent</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.urgentCases}</p>
                </div>
                <Clock className="w-8 h-8 text-orange-500" />
              </div>
            </div>

            {/* Normal Cases */}
            <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-green-500">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Normal</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.normalCases}</p>
                </div>
                <Users className="w-8 h-8 text-green-500" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="space-y-8">
          {/* Weekly Patient Volume */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Weekly Patient Volume (Current Month)
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getWeeklyVolumeData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Appointments" fill="#3B82F6" name="Appointments" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6-Month Patient Trend */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              6-Month Patient Trend
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getSixMonthTrendData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="Appointments" 
                    stroke="#8B5CF6" 
                    strokeWidth={2}
                    name="Appointments"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Medical Conditions & Priority Analysis */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Common Medical Conditions */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <PieChart className="w-5 h-5" />
                Common Medical Conditions
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={getMedicalConditionsData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderPieLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getMedicalConditionsData().map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Priority Level Analysis Chart */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                Priority Distribution
              </h3>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={getPriorityAnalysisData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderPieLabel}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#EF4444" /> {/* Emergency - Red */}
                      <Cell fill="#F59E0B" /> {/* Urgent - Orange */}
                      <Cell fill="#10B981" /> {/* Normal - Green */}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Doctor Performance */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Stethoscope className="w-5 h-5" />
              Doctor Performance
            </h3>
            <div className="space-y-4">
              {getDoctorPerformanceData().map((doctor) => (
                <div key={doctor.name} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-900">{doctor.name}</span>
                    <span className="text-sm text-gray-600">
                      Completion Rate: {doctor.completionRate}%
                    </span>
                  </div>
                  
                  {/* Status Counts with Colored Text */}
                  <div className="flex justify-between text-sm mb-3">
                    <span className="text-green-600 font-medium">Completed: {doctor.completed}</span>
                    <span className="text-green-500 font-medium">Confirmed: {doctor.confirmed}</span>
                    <span className="text-yellow-600 font-medium">Pending: {doctor.pending}</span>
                    <span className="text-gray-600 font-medium">Total: {doctor.total}</span>
                  </div>

                  {/* Separate Progress Bars for Each Status */}
                  <div className="space-y-2">
                    {/* Completed Progress Bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-medium w-20">Completed</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-400 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${calculateStatusPercentage(doctor, 'completed')}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">
                        {calculateStatusPercentage(doctor, 'completed')}%
                      </span>
                    </div>

                    {/* Confirmed Progress Bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-500 font-medium w-20">Confirmed</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${calculateStatusPercentage(doctor, 'confirmed')}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">
                        {calculateStatusPercentage(doctor, 'confirmed')}%
                      </span>
                    </div>

                    {/* Pending Progress Bar */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-yellow-600 font-medium w-20">Pending</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-yellow-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${calculateStatusPercentage(doctor, 'pending')}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-8 text-right">
                        {calculateStatusPercentage(doctor, 'pending')}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Reports;