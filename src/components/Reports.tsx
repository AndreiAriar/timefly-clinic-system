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

  // Convert to Philippine Time (UTC+8) - MUST BE DEFINED BEFORE calculateStats
  const toPHTime = (date: Date): Date => {
    return new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  };

  const calculateStats = useCallback((appointmentsData: Appointment[]) => {
    // Use Philippine Time for current date
    const nowPH = toPHTime(new Date());
    const currentMonth = nowPH.getMonth();
    const currentYear = nowPH.getFullYear();
    const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

    const statsData: Stats = {
      totalPatients: appointmentsData.length,
      appointmentsCompleted: appointmentsData.filter(apt => apt.status === 'completed').length,
      finishedThisMonth: appointmentsData.filter(apt => {
        // Convert appointment date to Philippine Time
        const aptDate = toPHTime(new Date(apt.appointmentDate));
        // Count ALL appointments this month (not just completed)
        return aptDate.getMonth() === currentMonth && 
               aptDate.getFullYear() === currentYear;
      }).length,
      finishedLastMonth: appointmentsData.filter(apt => {
        // Convert appointment date to Philippine Time
        const aptDate = toPHTime(new Date(apt.appointmentDate));
        // Count ALL appointments last month (not just completed)
        return aptDate.getMonth() === lastMonth && 
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
    console.log('🔥 Setting up real-time listeners for reports...');
    
    // ✅ FIXED: Listen to BOTH staff_appointments and patient_appointments collections
    const staffAppointmentsRef = collection(db, 'staff_appointments');
    const patientAppointmentsRef = collection(db, 'patient_appointments');
    
    const staffQuery = query(staffAppointmentsRef, orderBy('createdAt', 'desc'));
    const patientQuery = query(patientAppointmentsRef, orderBy('createdAt', 'desc'));
    
    let unsubscribing = false;
    
    const unsubscribeStaff = onSnapshot(
      staffQuery,
      (staffSnapshot) => {
        if (unsubscribing) return;
        
        const unsubscribePatient = onSnapshot(
          patientQuery,
          (patientSnapshot) => {
            if (unsubscribing) return;
            
            // Combine appointments from both collections
            const staffAppointments = staffSnapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Appointment[];
            
            const patientAppointments = patientSnapshot.docs
              .map(doc => ({
                id: doc.id,
                ...doc.data()
              })) as Appointment[];
            
            // Merge and deduplicate appointments (same ID in both collections)
            const allAppointmentsMap = new Map();
            
            [...staffAppointments, ...patientAppointments].forEach(apt => {
              if (!allAppointmentsMap.has(apt.id)) {
                allAppointmentsMap.set(apt.id, apt);
              }
            });
            
            const allAppointments = Array.from(allAppointmentsMap.values());
            
            // Filter out deleted appointments
            const activeAppointments = allAppointments.filter(
              apt => !apt.deletedByStaff && !apt.deletedByPatient
            );
            
            console.log('📊 Real-time update - Combined Appointments:', {
              staff: staffAppointments.length,
              patient: patientAppointments.length,
              combined: allAppointments.length,
              active: activeAppointments.length
            });
            
            setAppointments(activeAppointments);
            calculateStats(activeAppointments);
            setLastUpdated(new Date());
            setIsLoading(false);
          },
          (error) => {
            console.error('❌ Error in patient appointments listener:', error);
            setIsLoading(false);
          }
        );
        
        // Store unsubscribe function for patient listener
        return () => {
          if (!unsubscribing) {
            unsubscribePatient();
          }
        };
      },
      (error) => {
        console.error('❌ Error in staff appointments listener:', error);
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

    // Cleanup function to unsubscribe from all listeners
    return () => {
      console.log('🔌 Cleaning up real-time listeners');
      unsubscribing = true;
      unsubscribeStaff();
      unsubscribeDoctors();
    };
  }, [calculateStats]);
// Weekly Patient Volume Data - Current Month Calendar Weeks (Includes all days 1-31)
const getWeeklyVolumeData = (): BarChartData[] => {
  const weeks: BarChartData[] = [];
  
  // Get current date in Philippine Time
  const nowPH = toPHTime(new Date());
  const currentYear = nowPH.getFullYear();
  const currentMonth = nowPH.getMonth();
  

  // Get last day of the month
  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  
  // Determine number of weeks needed (4 or 5)
  const numberOfWeeks = lastDayOfMonth > 28 ? 5 : 4;
  
  // Calculate weeks based on standardized 7-day blocks
  for (let weekNumber = 1; weekNumber <= numberOfWeeks; weekNumber++) {
    // Week 1: Days 1-7, Week 2: Days 8-14, Week 3: Days 15-21, Week 4: Days 22-28, Week 5: Days 29-31
    const weekStartDay = (weekNumber - 1) * 7 + 1;
    const weekEndDay = Math.min(weekNumber * 7, lastDayOfMonth); // Don't exceed last day of month
    
    // Count appointments for this week
    const weekAppointments = appointments.filter(apt => {
      const aptDate = toPHTime(new Date(apt.appointmentDate));
      const aptDay = aptDate.getDate();
      
      // Include all appointments within the week range
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
    const nowPH = toPHTime(new Date());
    
    for (let i = 5; i >= 0; i--) {
      const month = new Date(nowPH.getFullYear(), nowPH.getMonth() - i, 1);
      const monthName = month.toLocaleDateString('en-US', { month: 'short' });
      
      const monthAppointments = appointments.filter(apt => {
        const aptDate = toPHTime(new Date(apt.appointmentDate));
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
      <div className="flex flex-wrap justify-center gap-2 mt-4 px-2">
        {medicalConditionsData.slice(0, 5).map((entry, index) => (
          <div key={`legend-${entry.name}`} className="flex items-center gap-1">
            <div 
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: RAINBOW_COLORS[index % RAINBOW_COLORS.length] }}
            />
            <span className="text-xs text-gray-700 truncate max-w-[80px]">{entry.name}</span>
          </div>
        ))}
        {medicalConditionsData.length > 5 && (
          <div className="text-xs text-gray-500">
            +{medicalConditionsData.length - 5} more
          </div>
        )}
      </div>
    );
  };

  // Custom legend renderer for priority distribution with percentages
  const renderPriorityLegend = () => {
    const priorityData = getPriorityAnalysisData();
    const total = priorityData.reduce((sum, item) => sum + item.value, 0);
    
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-4 px-2">
        {priorityData.map((entry, index) => {
          const percentage = total > 0 ? Math.round((entry.value / total) * 100) : 0;
          const colors = ['#EF4444', '#F59E0B', '#10B981']; // Red, Orange, Green
          
          return (
            <div key={`priority-legend-${entry.name}`} className="flex items-center gap-1">
              <div 
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: colors[index] }}
              />
              <span className="text-xs font-medium text-gray-700">
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
    <div className="min-h-screen bg-gray-50 py-4 sm:py-8">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header with Export Button Only */}
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex-1">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports & Analytics</h1>
              <p className="text-gray-600 mt-1 sm:mt-2 text-sm sm:text-base">
                Comprehensive overview of clinic performance and patient statistics
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
            
            {/* Export CSV Button Only */}
            <div className="flex gap-2 sm:gap-3">
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 shadow-sm w-full sm:w-auto justify-center text-sm sm:text-base"
                disabled={appointments.length === 0}
              >
                <Download className="w-3 h-3 sm:w-4 sm:h-4" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards - Mobile Responsive */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 mb-6 sm:mb-8">
          {/* Total Patients */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm sm:shadow-md p-3 sm:p-4 lg:p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Total Patients</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.totalPatients}</p>
              </div>
              <Users className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-blue-500" />
            </div>
          </div>

          {/* Appointments Completed */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm sm:shadow-md p-3 sm:p-4 lg:p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Completed</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.appointmentsCompleted}</p>
              </div>
              <CheckCircle className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-green-500" />
            </div>
          </div>

          {/* Finished This Month */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm sm:shadow-md p-3 sm:p-4 lg:p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">This Month</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.finishedThisMonth}</p>
                <p className={`text-xs ${getMonthChange() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                </p>
              </div>
              <Calendar className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-purple-500" />
            </div>
          </div>

          {/* Cancelled Appointments */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm sm:shadow-md p-3 sm:p-4 lg:p-6 border-l-4 border-red-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-600">Cancelled</p>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900">{stats.cancelledAppointments}</p>
              </div>
              <XCircle className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 text-red-500" />
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="space-y-4 sm:space-y-6 lg:space-y-8">
          {/* Weekly Patient Volume */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm sm:shadow-md p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              Weekly Patient Volume (Current Month)
            </h3>
            <div className="h-60 sm:h-64 lg:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getWeeklyVolumeData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Appointments" fill="#3B82F6" name="Appointments" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* 6-Month Patient Trend */}
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm sm:shadow-md p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              6-Month Patient Trend
            </h3>
            <div className="h-60 sm:h-64 lg:h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getSixMonthTrendData()}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Common Medical Conditions */}
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm sm:shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <PieChart className="w-4 h-4 sm:w-5 sm:h-5" />
                Common Medical Conditions
              </h3>
              <div className="h-60 sm:h-64 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={getMedicalConditionsData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={60}
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
            <div className="bg-white rounded-lg sm:rounded-xl shadow-sm sm:shadow-md p-4 sm:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                Priority Distribution
              </h3>
              <div className="h-60 sm:h-64 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={getPriorityAnalysisData()}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={false}
                      outerRadius={60}
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
          <div className="bg-white rounded-lg sm:rounded-xl shadow-sm sm:shadow-md p-4 sm:p-6">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4 flex items-center gap-2">
              <Stethoscope className="w-4 h-4 sm:w-5 sm:h-5" />
              Doctor Performance
            </h3>
            <div className="space-y-3 sm:space-y-4">
              {getDoctorPerformanceData().map((doctor) => (
                <div key={doctor.name} className="border rounded-lg p-3 sm:p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 mb-2">
                    <span className="font-semibold text-gray-900 text-sm sm:text-base">{doctor.name}</span>
                    <span className="text-xs sm:text-sm text-gray-600">
                      Completion Rate: {doctor.completionRate}%
                    </span>
                  </div>

                  {/* Status Counts with Colored Text - Mobile Responsive */}
                  <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-between text-xs sm:text-sm mb-3">
                    <span className="text-green-600 font-medium">Completed: {doctor.completed}</span>
                    <span className="text-green-800 font-medium">Confirmed: {doctor.confirmed}</span>
                    <span className="text-yellow-600 font-medium">Pending: {doctor.pending}</span>
                    <span className="text-gray-600 font-medium">Total: {doctor.total}</span>
                  </div>

                  {/* Separate Progress Bars for Each Status */}
                  <div className="space-y-1.5 sm:space-y-2">
                    {/* Completed Progress Bar - GREEN */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-600 font-medium w-16 sm:w-20">Completed</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 sm:h-2">
                        <div 
                          className="bg-green-500 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                          style={{ width: `${calculateStatusPercentage(doctor, 'completed')}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-6 sm:w-8 text-right">
                        {calculateStatusPercentage(doctor, 'completed')}%
                      </span>
                    </div>

                    {/* Confirmed Progress Bar - DARK GREEN */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-green-800 font-medium w-16 sm:w-20">Confirmed</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 sm:h-2">
                        <div 
                          className="bg-green-700 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                          style={{ width: `${calculateStatusPercentage(doctor, 'confirmed')}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-6 sm:w-8 text-right">
                        {calculateStatusPercentage(doctor, 'confirmed')}%
                      </span>
                    </div>

                    {/* Pending Progress Bar - YELLOW */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-yellow-600 font-medium w-16 sm:w-20">Pending</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5 sm:h-2">
                        <div 
                          className="bg-yellow-500 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                          style={{ width: `${calculateStatusPercentage(doctor, 'pending')}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-600 w-6 sm:w-8 text-right">
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