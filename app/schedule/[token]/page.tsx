'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import LanguageLanding from '@/components/form/LanguageLanding';
import { getSchedulingTranslations, mapPreferredLanguage, SchedulingLanguage } from '@/lib/scheduling/translations';
import Footer from '@/components/Footer';

interface Slot {
  staffId: string;
  staffName: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  dateKey: string;
  timeDisplay: string;
}

interface SlotData {
  application: {
    id: string;
    tenantName: string;
    preferredLanguage: string | null;
    buildingAddress: string;
    unitNumber: string;
  };
  slots: Record<string, Slot[]>;
  totalSlots: number;
}

export default function SchedulePage() {
  const params = useParams<{ token: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = params.token;
  const purpose = searchParams.get('purpose') || 'sign_documents';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [slotData, setSlotData] = useState<SlotData | null>(null);
  const [language, setLanguage] = useState<SchedulingLanguage | null>(null);
  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);
  const [appointmentId, setAppointmentId] = useState<string | null>(null);

  const t = language ? getSchedulingTranslations(language) : getSchedulingTranslations('en');

  // Calculate week dates
  const getWeekDates = useCallback(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Start from Monday of current week
    const dayOfWeek = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7) + (selectedWeekOffset * 7));
    
    const weekDates: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      weekDates.push(date);
    }
    return weekDates;
  }, [selectedWeekOffset]);

  const weekDates = getWeekDates();
  const weekStart = weekDates[0];
  const weekEnd = weekDates[6];

  // Fetch slots
  const fetchSlots = useCallback(async () => {
    setLoading(true);
    setError('');
    
    try {
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      
      const res = await fetch(`/api/scheduling/slots?token=${token}&start=${startStr}&end=${endStr}`);
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        throw new Error(data.message || t.errorLoadingSlots);
      }
      
      setSlotData(data.data);
      
      // Auto-detect language from application
      if (!language && data.data.application.preferredLanguage) {
        setLanguage(mapPreferredLanguage(data.data.application.preferredLanguage));
      }
    } catch (err: any) {
      setError(err.message || t.errorLoadingSlots);
    } finally {
      setLoading(false);
    }
  }, [token, weekStart, weekEnd, t.errorLoadingSlots, language]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const handleLanguageSelect = (lang: SchedulingLanguage) => {
    setLanguage(lang);
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : language === 'pt' ? 'pt-BR' : 'en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatFullDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString(language === 'es' ? 'es-ES' : language === 'pt' ? 'pt-BR' : 'en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  };

  const getPurposeLabel = (p: string) => {
    switch (p) {
      case 'sign_documents': return t.purposeSignDocuments;
      case 'inspection_required': return t.purposeInspection;
      case 'intake_help': return t.purposeIntake;
      case 'document_drop': return t.purposeDropoff;
      default: return t.purposeOther;
    }
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot) return;
    
    setConfirming(true);
    try {
      const res = await fetch('/api/scheduling/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          staffId: selectedSlot.staffId,
          startTime: selectedSlot.startTime,
          purpose,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        if (data.message?.includes('no longer available')) {
          setError(t.slotNoLongerAvailable);
          setSelectedSlot(null);
          fetchSlots();
        } else {
          throw new Error(data.message || t.errorBooking);
        }
        return;
      }
      
      setAppointmentId(data.data.appointment.id);
      setBookingSuccess(true);
    } catch (err: any) {
      setError(err.message || t.errorBooking);
    } finally {
      setConfirming(false);
    }
  };

  // Language selection screen
  if (!language) {
    return (
      <LanguageLanding
        title={t.scheduleYourVisit}
        subtitle="Stanton Management LLC"
        description=""
        onSelect={handleLanguageSelect}
      />
    );
  }

  // Booking success screen
  if (bookingSuccess && appointmentId) {
    return (
      <div className="min-h-screen bg-[var(--paper)]">
        <main className="max-w-xl mx-auto px-4 py-8 sm:py-12">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-6">
              <img
                src="/Stanton-logo.PNG"
                alt="Stanton Management"
                className="max-w-[280px] w-full h-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            </div>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="font-serif text-2xl sm:text-3xl text-[var(--primary)] mb-2">
              {t.appointmentConfirmed}
            </h1>
            <p className="text-[var(--muted)]">{t.confirmationDetails}</p>
          </div>

          <div className="bg-white shadow-sm border border-[var(--border)] p-6 mb-6">
            <h2 className="font-semibold text-[var(--primary)] mb-4">{t.appointmentDetails}</h2>
            {selectedSlot && (
              <div className="space-y-3 text-sm">
                <div className="flex justify-between py-2 border-b border-[var(--divider)]">
                  <span className="text-[var(--muted)]">{t.date}</span>
                  <span className="font-medium">{formatFullDate(selectedSlot.dateKey)}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[var(--divider)]">
                  <span className="text-[var(--muted)]">{t.time}</span>
                  <span className="font-medium">{selectedSlot.timeDisplay}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[var(--divider)]">
                  <span className="text-[var(--muted)]">{t.location}</span>
                  <span className="font-medium text-right">{t.stantonAddress}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-[var(--divider)]">
                  <span className="text-[var(--muted)]">{t.withStaff}</span>
                  <span className="font-medium">{selectedSlot.staffName}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-[var(--muted)]">{t.purpose}</span>
                  <span className="font-medium">{getPurposeLabel(purpose)}</span>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-3">
            <a
              href={`/api/scheduling/appointments/${appointmentId}/ics`}
              download
              className="block w-full bg-[var(--primary)] text-white py-3.5 px-6 text-center font-medium hover:bg-[var(--primary-light)] transition-colors"
            >
              {t.icsDownload}
            </a>
            <button
              onClick={() => window.close()}
              className="block w-full border border-[var(--border)] py-3.5 px-6 text-center hover:bg-[var(--bg-section)] transition-colors"
            >
              {t.closeWindow}
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Main scheduling interface
  return (
    <div className="min-h-screen bg-[var(--paper)]">
      <main className="max-w-3xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <img
              src="/Stanton-logo.PNG"
              alt="Stanton Management"
              className="max-w-[200px] w-full h-auto"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <h1 className="font-serif text-xl sm:text-2xl text-[var(--primary)] mb-1">
            {t.scheduleYourVisit}
          </h1>
          {slotData && (
            <p className="text-[var(--muted)] text-sm">
              Hi {slotData.application.tenantName}
            </p>
          )}
        </div>

        {/* Purpose context */}
        <div className="bg-blue-50 border border-blue-200 p-4 mb-6 text-sm">
          <p className="font-medium text-blue-900">
            {getPurposeLabel(purpose)}
          </p>
          {purpose === 'sign_documents' && (
            <p className="text-blue-700 mt-1">{t.documentsToSign}</p>
          )}
          {purpose === 'inspection_required' && (
            <p className="text-blue-700 mt-1">{t.unitInspectionInfo}</p>
          )}
        </div>

        {/* Error message */}
        {error && (
          <div className="bg-red-50 border border-red-200 p-4 mb-6 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Week navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setSelectedWeekOffset(prev => prev - 1)}
            disabled={selectedWeekOffset <= 0}
            className="text-sm text-[var(--primary)] hover:underline disabled:opacity-30 disabled:hover:no-underline"
          >
            {t.previousWeek}
          </button>
          <span className="text-sm font-medium text-[var(--ink)]">
            {formatDate(weekDates[0])} – {formatDate(weekDates[6])}
          </span>
          <button
            onClick={() => setSelectedWeekOffset(prev => prev + 1)}
            disabled={selectedWeekOffset >= 3} // Max 4 weeks out
            className="text-sm text-[var(--primary)] hover:underline disabled:opacity-30 disabled:hover:no-underline"
          >
            {t.nextWeek}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--muted)] mt-2">{t.selectDateTime}</p>
          </div>
        )}

        {/* Slot grid */}
        {!loading && slotData && (
          <div className="space-y-4">
            {weekDates.map(date => {
              const dateKey = date.toISOString().split('T')[0];
              const daySlots = slotData.slots[dateKey] || [];
              
              return (
                <div key={dateKey} className="bg-white border border-[var(--border)]">
                  <div className="px-4 py-2 bg-[var(--bg-section)] border-b border-[var(--divider)]">
                    <span className="text-sm font-medium text-[var(--ink)]">
                      {formatDate(date)}
                    </span>
                  </div>
                  
                  {daySlots.length === 0 ? (
                    <div className="px-4 py-6 text-center">
                      <p className="text-sm text-[var(--muted)]">{t.noSlotsAvailable}</p>
                    </div>
                  ) : (
                    <div className="p-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {daySlots.map((slot, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedSlot(slot)}
                          className={`py-2 px-3 text-sm font-medium transition-colors ${
                            selectedSlot?.startTime === slot.startTime
                              ? 'bg-[var(--primary)] text-white'
                              : 'bg-[var(--bg-section)] text-[var(--ink)] hover:bg-[var(--border)]'
                          }`}
                        >
                          {slot.timeDisplay}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* No slots this week */}
        {!loading && slotData && Object.keys(slotData.slots).length === 0 && selectedWeekOffset === 0 && (
          <div className="text-center py-8">
            <p className="text-[var(--muted)] mb-4">{t.noSlotsThisWeek}</p>
            <button
              onClick={() => setSelectedWeekOffset(1)}
              className="text-[var(--primary)] hover:underline"
            >
              {t.tryNextWeek} →
            </button>
          </div>
        )}

        {/* Confirmation section */}
        {selectedSlot && (
          <div className="mt-6 bg-white border border-[var(--border)] p-4">
            <h3 className="font-semibold text-[var(--primary)] mb-3">{t.confirmAppointment}</h3>
            <div className="text-sm space-y-2 mb-4">
              <p><span className="text-[var(--muted)]">{t.date}:</span> {formatFullDate(selectedSlot.dateKey)}</p>
              <p><span className="text-[var(--muted)]">{t.time}:</span> {selectedSlot.timeDisplay}</p>
              <p><span className="text-[var(--muted)]">{t.withStaff}:</span> {selectedSlot.staffName}</p>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleConfirmBooking}
                disabled={confirming}
                className="flex-1 py-3 bg-[var(--primary)] text-white font-medium hover:opacity-90 disabled:opacity-50"
              >
                {confirming ? '...' : t.confirmButton}
              </button>
              <button
                onClick={() => setSelectedSlot(null)}
                className="px-4 py-3 border border-[var(--border)] hover:bg-[var(--bg-section)]"
              >
                {t.cancelButton}
              </button>
            </div>
          </div>
        )}

        {/* Change language */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setLanguage(null)}
            className="text-xs text-[var(--muted)] hover:text-[var(--primary)] underline"
          >
            Change language / Cambiar idioma / Mudar idioma
          </button>
        </div>
      </main>
      <Footer />
    </div>
  );
}
