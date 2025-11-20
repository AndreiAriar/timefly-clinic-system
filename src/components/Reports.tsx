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
  Download
} from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
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
  ResponsiveContainer
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
  deletedByStaff?: boolean;
  deletedByPatient?: boolean;
  email: string;
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
  [key: string]: string | number;
}

// Rainbow colors for medical conditions
const RAINBOW_COLORS = [
  '#FF0000', // Red
  '#FF7F00', // Orange
  '#FFFF00', // Yellow
  '#00FF00', // Green
  '#0000FF', // Blue
  '#4B0082', // Indigo
  '#8B00FF', // Violet
  '#FF1493', // Deep Pink
  '#00CED1', // Dark Turquoise
  '#FFD700'  // Gold
];

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
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const calculateStats = useCallback((appointmentsData: Appointment[]) => {
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
    console.log('📈 Stats calculated:', statsData);
  }, []);

  useEffect(() => {
    console.log('🔥 Setting up real-time listeners...');
    
    // Real-time listener for appointments
    const appointmentsRef = collection(db, 'appointments');
    const appointmentsQuery = query(appointmentsRef, orderBy('createdAt', 'desc'));
    
    const unsubscribeAppointments = onSnapshot(
      appointmentsQuery,
      (snapshot) => {
        // Filter out deleted appointments
        const appointmentsData = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Appointment[];
        
        // Remove appointments deleted by staff or patient
        const activeAppointments = appointmentsData.filter(
          apt => !apt.deletedByStaff && !apt.deletedByPatient
        );
        
        console.log('📊 Real-time update - Active Appointments:', activeAppointments.length);
        setAppointments(activeAppointments);
        calculateStats(activeAppointments);
        setLastUpdated(new Date());
        setIsLoading(false);
      },
      (error) => {
        console.error('❌ Error in appointments listener:', error);
        setIsLoading(false);
      }
    );

    // Real-time listener for doctors
    const doctorsRef = collection(db, 'doctors');
    const doctorsQuery = query(doctorsRef, where('isActive', '==', true));
    
    const unsubscribeDoctors = onSnapshot(
      doctorsQuery,
      (snapshot) => {
        const doctorsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Doctor[];
        
        console.log('👨‍⚕️ Real-time update - Doctors:', doctorsData.length);
        setDoctors(doctorsData);
      },
      (error) => {
        console.error('❌ Error in doctors listener:', error);
      }
    );

    // Cleanup function to unsubscribe from listeners
    return () => {
      console.log('🔌 Cleaning up real-time listeners');
      unsubscribeAppointments();
      unsubscribeDoctors();
    };
  }, [calculateStats]);

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

  // Custom legend renderer for medical conditions with rainbow colors
  const renderMedicalConditionsLegend = () => {
    const medicalConditionsData = getMedicalConditionsData();
    
    return (
      <div className="flex flex-wrap justify-center gap-4 mt-4">
        {medicalConditionsData.map((entry, index) => (
          <div key={`legend-${entry.name}`} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: RAINBOW_COLORS[index % RAINBOW_COLORS.length] }}
            />
            <span className="text-sm text-gray-700">{entry.name}</span>
          </div>
        ))}
      </div>
    );
  };

  // Custom legend renderer for priority distribution with percentages
  const renderPriorityLegend = () => {
    const priorityData = getPriorityAnalysisData();
    const total = priorityData.reduce((sum, item) => sum + item.value, 0);
    
    return (
      <div className="flex flex-wrap justify-center gap-6 mt-4">
        {priorityData.map((entry, index) => {
          const percentage = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          const colors = ['#EF4444', '#F59E0B', '#10B981']; // Red, Orange, Green
          
          return (
            <div key={`priority-legend-${entry.name}`} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: colors[index] }}
              />
              <span className="text-sm font-medium text-gray-700">
                {entry.name} ({percentage}%)
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  // Calculate percentage for each status
  const calculateStatusPercentage = (doctor: DoctorPerformance, status: 'completed' | 'confirmed' | 'pending'): number => {
    return doctor.total > 0 ? Math.round((doctor[status] / doctor.total) * 100) : 0;
  };

  // Export CSV functionality - exports all displayed data
  const exportToCSV = () => {
    try {
      // Define CSV headers
      const headers = [
        'ID',
        'Full Name',
        'Age',
        'Email',
        'Doctor',
        'Appointment Date',
        'Medical Condition',
        'Priority Level',
        'Status',
        'Created At'
      ];

      // Convert appointments to CSV rows
      const csvRows = appointments.map(apt => [
        apt.id,
        `"${apt.fullName.replace(/"/g, '""')}"`, // Escape quotes in names
        apt.age,
        `"${apt.email}"`,
        `"${apt.doctor}"`,
        apt.appointmentDate,
        `"${apt.medicalCondition.replace(/"/g, '""')}"`,
        apt.priorityLevel,
        apt.status,
        apt.createdAt
      ]);

      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...csvRows.map(row => row.join(','))
      ].join('\n');

      // Create and download the file
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      
      link.setAttribute('href', url);
      link.setAttribute('download', `appointments_export_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      console.log('✅ CSV export completed successfully');
    } catch (error) {
      console.error('❌ Error exporting CSV:', error);
      alert('Error exporting data. Please try again.');
    }
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
        {/* Header with Export Button Only */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-gray-600 mt-2">Comprehensive overview of clinic performance and patient statistics</p>
              <p className="text-xs text-gray-500 mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
            
            {/* Export CSV Button Only */}
            <div className="flex gap-3">
              <button
                onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm w-full sm:w-auto justify-center"
                disabled={appointments.length === 0}
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
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
                      label={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {getMedicalConditionsData().map((_, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={RAINBOW_COLORS[index % RAINBOW_COLORS.length]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend content={renderMedicalConditionsLegend} />
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
                      label={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      <Cell fill="#EF4444" />
                      <Cell fill="#F59E0B" />
                      <Cell fill="#10B981" />
                    </Pie>
                    <Tooltip />
                    <Legend content={renderPriorityLegend} />
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
                          className="bg-green-400 h-2 rounded-full"
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
                          className="bg-green-600 h-2 rounded-full"
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
                          className="bg-green-600 h-2 rounded-full"
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