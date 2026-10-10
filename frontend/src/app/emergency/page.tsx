'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { EmergencyMap } from '@/components/maps/EmergencyMap';
import { IncidentCard } from '@/components/emergency/IncidentCard';
import { IncidentDetail } from '@/components/emergency/IncidentDetail';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Search, Filter, RefreshCw, Wifi, WifiOff, MapPin, AlertTriangle, Clock, TrendingUp, ChevronLeft, ChevronRight, FlaskConical, ScanLine } from 'lucide-react';
import { useIncidentStore, useLocationStore, useUIStore } from '@/store';
import { api } from '@/lib/api';
import type { Incident, IncidentObservation, IncidentSummaryResponse } from '@/types';

const INCIDENT_TYPE_FILTERS = ['ALL', 'HEAT', 'FLOOD', 'HEAVY_RAIN', 'WATER_STRESS', 'DROUGHT'] as const;
const SEVERITY_FILTERS = ['ALL', 'EXTREME', 'CRITICAL', 'WARNING'] as const;
const EMPTY_INCIDENT_TIMELINE: IncidentObservation[] = [];

export default function EmergencyPage() {
  const {
    activeIncidents,
    selectedIncident,
    summary,
    isConnected,
    setIncidents,
    addIncident,
    updateIncident,
    removeIncident,
    setSelectedIncident,
    setSummary,
    setConnected,
  } = useIncidentStore();

  const { monitoredLocations, setMonitoredLocations } = useLocationStore();
  const { setIncidentDetailOpen } = useUIStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<string | null>(null);
  const [demoIncidents, setDemoIncidents] = useState<Incident[]>([]);
  const [showDemoPreview, setShowDemoPreview] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);
  const [locationFilter, setLocationFilter] = useState('');
  const [monitoringActive, setMonitoringActive] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'ALL' | Incident['type']>('ALL');
  const [severityFilter, setSeverityFilter] = useState<'ALL' | Incident['severity']>('ALL');
  const [showMap, setShowMap] = useState(true);
  const hasScannedOnEntry = useRef(false);

  // WebSocket connection
  useEffect(() => {
    const wsBase = new URL(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000');
    wsBase.protocol = wsBase.protocol === 'https:' || wsBase.protocol === 'wss:' ? 'wss:' : 'ws:';
    wsBase.pathname = `${wsBase.pathname
      .replace(/\/+$/, '')
      .replace(/\/api(?:\/monitoring)?$/, '')}/api/monitoring/ws/incidents`;
    wsBase.search = '';
    wsBase.hash = '';
    const wsUrl = wsBase.toString();
    let ws: WebSocket;
    let reconnectTimeout: ReturnType<typeof setTimeout>;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (disposed) {
            ws.close();
            return;
          }
          setConnected(true);
          console.log('WebSocket connected');
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            handleWebSocketMessage(msg);
          } catch (e) {
            console.error('WS message parse error:', e);
          }
        };

        ws.onclose = () => {
          if (disposed) return;
          setConnected(false);
          console.log('WebSocket disconnected, reconnecting in 5s...');
          reconnectTimeout = setTimeout(connect, 5000);
        };

        ws.onerror = (err) => {
          if (!disposed) console.error('WebSocket error:', err);
        };
      } catch (e) {
        console.error('WebSocket connection failed:', e);
        if (!disposed) reconnectTimeout = setTimeout(connect, 5000);
      }
    };

    const handleWebSocketMessage = (msg: any) => {
      switch (msg.type) {
        case 'incident_created':
          addIncident(msg.data);
          break;
        case 'incident_updated':
          updateIncident(msg.data.incidentId, msg.data);
          break;
        case 'incident_resolved':
          removeIncident(msg.data.incidentId);
          if (selectedIncident?.incidentId === msg.data.incidentId) {
            setSelectedIncident(null);
            setIncidentDetailOpen(false);
          }
          break;
        case 'summary_update':
          setSummary(msg.data);
          break;
        case 'risk_update':
          // Handle risk updates if needed
          break;
      }
    };

    connect();

    return () => {
      disposed = true;
      clearTimeout(reconnectTimeout);
      if (ws?.readyState === WebSocket.OPEN) ws.close();
    };
  }, [addIncident, updateIncident, removeIncident, setConnected, setSummary, selectedIncident, setSelectedIncident, setIncidentDetailOpen]);

  // Initial data fetch
  const fetchInitialData = useCallback(async () => {
    setIsRefreshing(true);
    setDataError(null);
    try {
      const [incidentsRes, summaryRes, locationsRes, monitoringRes] = await Promise.all([
        api.getActiveIncidents(),
        api.getIncidentsSummary(),
        api.getMonitoredLocations(),
        api.getMonitoringStatus(),
      ]);
      setIncidents(incidentsRes);
      setSummary(summaryRes);
      setMonitoredLocations(locationsRes);
      setMonitoringActive(monitoringRes.monitoring_active);
    } catch (err) {
      console.error('Failed to fetch initial data:', err);
      setDataError(err instanceof Error ? err.message : 'Unable to load live operations data.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [setIncidents, setSummary, setMonitoredLocations]);

  const scanForRiskNow = useCallback(async () => {
    setIsScanning(true);
    setScanFeedback(null);
    setDataError(null);
    try {
      const result = await api.triggerMonitoring();
      await fetchInitialData();
      const feedback = [
        `Scanned ${result.locations_checked} locations`,
        `${result.incidents_created} new warning${result.incidents_created === 1 ? '' : 's'}`,
        `${result.incidents_updated} updated`,
        `${result.incidents_resolved} resolved`,
      ].join(' · ');
      if (result.errors?.length) {
        setScanFeedback(
          `${feedback}. ${result.errors.length} location${result.errors.length === 1 ? '' : 's'} could not be checked; results may be incomplete.`,
        );
      } else if (result.incidents_created === 0 && result.incidents_updated === 0) {
        setScanFeedback(`${feedback}. No current risk at or above the 20% watch threshold was detected.`);
      } else {
        setScanFeedback(`${feedback}. Risk watches are shown below.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to scan monitored locations.';
      setDataError(message);
    } finally {
      setIsScanning(false);
    }
  }, [fetchInitialData]);

  useEffect(() => {
    const initializeCommandCenter = async () => {
      await fetchInitialData();
      if (!hasScannedOnEntry.current) {
        hasScannedOnEntry.current = true;
        void scanForRiskNow();
      }
    };

    void initializeCommandCenter();
    const interval = setInterval(fetchInitialData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [fetchInitialData, scanForRiskNow]);

  // Filter incidents
  const filteredIncidents = activeIncidents.filter((incident) => {
    const typeMatch = typeFilter === 'ALL' || incident.type === typeFilter;
    const severityMatch = severityFilter === 'ALL' || incident.severity === severityFilter;
    const location = monitoredLocations.find((item) => item.locationId === incident.locationId);
    const locationText = [
      incident.locationId,
      location?.city,
      location?.district,
      location?.state,
      location?.country,
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    const locationMatch = locationText.includes(locationFilter.trim().toLocaleLowerCase());
    return typeMatch && severityMatch && locationMatch;
  });

  const filteredDemoIncidents = demoIncidents.filter((incident) => {
    const typeMatch = typeFilter === 'ALL' || incident.type === typeFilter;
    const severityMatch = severityFilter === 'ALL' || incident.severity === severityFilter;
    const location = monitoredLocations.find((item) => item.locationId === incident.locationId);
    const locationText = [
      incident.locationId,
      location?.city,
      location?.district,
      location?.state,
      location?.country,
    ].filter(Boolean).join(' ').toLocaleLowerCase();
    const locationMatch = locationText.includes(locationFilter.trim().toLocaleLowerCase());
    return typeMatch && severityMatch && locationMatch;
  });

  const toggleDemoPreview = async () => {
    if (showDemoPreview) {
      setShowDemoPreview(false);
      if (selectedIncident?.incidentId.startsWith('DEMO-')) {
        setSelectedIncident(null);
        setIncidentDetailOpen(false);
      }
      return;
    }

    if (demoIncidents.length === 0) {
      setIsLoadingDemo(true);
      setDemoError(null);
      try {
        setDemoIncidents(await api.getDemoIncidents());
      } catch (err) {
        setDemoError(err instanceof Error ? err.message : 'Unable to load demo scenarios.');
        setIsLoadingDemo(false);
        return;
      }
      setIsLoadingDemo(false);
    }
    setShowDemoPreview(true);
  };

  const handleIncidentSelect = (incidentId: string) => {
    const incident = [...activeIncidents, ...demoIncidents].find((i) => i.incidentId === incidentId);
    if (incident) {
      setSelectedIncident(incident);
      setIncidentDetailOpen(true);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-theme-bg-primary">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🛰️</div>
          <p className="text-theme-text-secondary">Loading emergency command center...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-theme-bg-primary">
      {/* Header */}
      <header className="sticky top-0 z-40 glass px-6 py-3 border-b border-theme-divider">
        <div className="container flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setShowMap(!showMap)}>
              {showMap ? '📋' : '🗺️'}
            </Button>
            <div>
              <h1 className="font-heading text-h2 text-theme-text-primary">India Emergency Command Center</h1>
              <p className="text-sm text-theme-text-muted">
                {monitoringActive ? 'Monitoring active' : 'Monitoring paused'}
                {' · '}
                {isConnected ? 'Live connection connected' : 'Live connection reconnecting'}
                {' · '}20%+ risk watch
              </p>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-risk-critical/10 border border-risk-critical/20 rounded-organic-sm px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-risk-critical animate-pulse" />
              <span className="font-mono font-bold text-risk-critical">{summary?.critical_count || 0}</span>
              <span className="text-xs text-theme-text-muted">Critical</span>
            </div>
            <div className="flex items-center gap-2 bg-risk-high/10 border border-risk-high/20 rounded-organic-sm px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-risk-high" />
              <span className="font-mono font-bold text-risk-high">{summary?.high_risk_count || 0}</span>
              <span className="text-xs text-theme-text-muted">High Risk</span>
            </div>
            <div className="flex items-center gap-2 bg-risk-low/10 border border-risk-low/20 rounded-organic-sm px-3 py-2">
              <span className="w-2 h-2 rounded-full bg-risk-low" />
              <span className="font-mono font-bold text-risk-low">{summary?.total || 0}</span>
              <span className="text-xs text-theme-text-muted">Total Active</span>
            </div>

            <div className="flex items-center gap-2 ml-4">
              <Button
                variant="secondary"
                size="sm"
                onClick={scanForRiskNow}
                disabled={isScanning}
                aria-label="Scan monitored Indian cities for risk at or above 20 percent"
              >
                <ScanLine className={cn('w-4 h-4', isScanning && 'animate-pulse')} />
                {isScanning ? 'Scanning cities…' : 'Scan now'}
              </Button>
              <Button
                variant={showDemoPreview ? 'secondary' : 'ghost'}
                size="sm"
                onClick={toggleDemoPreview}
                disabled={isLoadingDemo}
                aria-pressed={showDemoPreview}
              >
                <FlaskConical className="w-4 h-4" />
                {isLoadingDemo ? 'Loading…' : showDemoPreview ? 'Hide demo' : 'Demo preview'}
              </Button>
              {isConnected ? (
                <span className="flex items-center gap-1 text-risk-low text-sm">
                  <Wifi className="w-4 h-4" />
                  Live
                </span>
              ) : (
                <span className="flex items-center gap-1 text-risk-critical text-sm">
                  <WifiOff className="w-4 h-4" />
                  Offline
                </span>
              )}
              <Button variant="ghost" size="sm" onClick={fetchInitialData} disabled={isRefreshing} aria-label="Refresh live operations">
                <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="container flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-theme-divider">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Search className="w-4 h-4 text-theme-text-muted" />
            <input
              type="search"
              value={locationFilter}
              onChange={(event) => setLocationFilter(event.target.value)}
              placeholder="Filter incidents by location..."
              className="flex-1 bg-transparent border-none focus:outline-none text-theme-text-primary placeholder-theme-text-muted text-sm"
              aria-label="Filter incidents"
            />
          </div>
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as any)}
              className="input py-1.5 px-3 text-sm min-w-[140px]"
              aria-label="Filter by incident type"
            >
              {INCIDENT_TYPE_FILTERS.map((type) => (
                <option key={type} value={type}>{type === 'ALL' ? 'All Types' : type}</option>
              ))}
            </select>
            <select
              value={severityFilter}
              onChange={(e) => setSeverityFilter(e.target.value as any)}
              className="input py-1.5 px-3 text-sm min-w-[130px]"
              aria-label="Filter by severity"
            >
              {SEVERITY_FILTERS.map((sev) => (
                <option key={sev} value={sev}>{sev === 'ALL' ? 'All Severities' : sev}</option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {dataError && (
        <div className="container mt-3" role="alert">
          <div className="flex items-center justify-between gap-4 rounded-organic-sm border border-risk-critical/20 bg-risk-critical/5 px-4 py-3 text-sm text-theme-text-primary">
            <span>Live operations data could not be refreshed: {dataError}</span>
            <Button variant="ghost" size="sm" onClick={fetchInitialData} disabled={isRefreshing}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {scanFeedback && (
        <div className="container mt-3" role="status">
          <p className="rounded-organic-sm border border-theme-accent/20 bg-theme-accent/5 px-4 py-3 text-sm text-theme-text-secondary">
            {scanFeedback}
          </p>
        </div>
      )}

      {demoError && (
        <div className="container mt-3" role="alert">
          <p className="rounded-organic-sm border border-risk-critical/20 bg-risk-critical/5 px-4 py-3 text-sm text-theme-text-primary">
            Demo scenarios could not be loaded: {demoError}
          </p>
        </div>
      )}

      {showDemoPreview && (
        <div className="container mt-3" role="status">
          <p className="flex items-start gap-2 rounded-organic-sm border border-theme-accent/20 bg-theme-accent/5 px-4 py-3 text-sm text-theme-text-secondary">
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-theme-accent" />
            <span>
              <strong className="text-theme-text-primary">Demo preview:</strong> these illustrative scenarios are synthetic and are not current alerts. Live incident counts above remain unchanged.
            </span>
          </p>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        {showMap ? (
          <div className="h-full flex">
            <EmergencyMap
              incidents={activeIncidents}
              monitoredLocations={monitoredLocations}
              selectedIncidentId={selectedIncident?.incidentId}
              onIncidentSelect={handleIncidentSelect}
              className="flex-1"
              height={window.innerHeight - 120}
            />

            {/* Side Panel - Incident List */}
            <motion.aside
              className="w-96 bg-theme-bg-secondary border-l border-theme-divider overflow-y-auto flex flex-col"
              initial={{ x: 384 }}
              animate={{ x: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            >
              <div className="p-4 border-b border-theme-divider flex items-center justify-between">
                <h2 className="font-heading text-h3 text-theme-text-primary">Active Incidents</h2>
                <Badge variant="risk" riskLevel={filteredIncidents.some(i => i.severity === 'CRITICAL') ? 'CRITICAL' : filteredIncidents.some(i => i.severity === 'EXTREME') ? 'CRITICAL' : filteredIncidents.some(i => i.severity === 'WARNING') ? 'MEDIUM' : 'LOW'}>
                  {filteredIncidents.length}
                </Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredIncidents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-theme-text-muted">
                    <span className="text-4xl mb-2">{activeIncidents.length === 0 ? '✓' : '⌕'}</span>
                    <p className="font-medium text-theme-text-secondary">
                      {activeIncidents.length === 0 ? 'No active incidents' : 'No incidents match these filters'}
                    </p>
                    {activeIncidents.length === 0 && (
                      <p className="mt-2 max-w-xs text-center text-sm">
                        {monitoringActive
                          ? 'Monitoring is checking enabled locations. New incidents will appear when risk thresholds are reached.'
                          : 'Automated monitoring is paused, so new incidents are not being detected.'}
                      </p>
                    )}
                    {showDemoPreview && (
                      <section className="mt-5 border-t border-theme-divider pt-4" aria-label="Demo incident scenarios">
                        <div className="mb-3 flex items-center justify-between gap-2">
                          <h3 className="text-sm font-semibold text-theme-text-secondary">Illustrative scenarios</h3>
                          <Badge variant="info" size="sm">DEMO · NOT LIVE</Badge>
                        </div>
                        {filteredDemoIncidents.map((incident) => (
                          <IncidentCard
                            key={incident.incidentId}
                            incident={incident}
                            locationName={monitoredLocations.find((location) => location.locationId === incident.locationId)?.city}
                            onClick={() => handleIncidentSelect(incident.incidentId)}
                            isSelected={selectedIncident?.incidentId === incident.incidentId}
                          />
                        ))}
                        {filteredDemoIncidents.length === 0 && (
                          <p className="py-4 text-center text-sm text-theme-text-muted">No demo scenarios match these filters.</p>
                        )}
                      </section>
                    )}
                  </div>
                ) : (
                  filteredIncidents.map((incident) => (
                    <IncidentCard
                      key={incident.incidentId}
                      incident={incident}
                      locationName={monitoredLocations.find(l => l.locationId === incident.locationId)?.city}
                      onClick={() => handleIncidentSelect(incident.incidentId)}
                      isSelected={selectedIncident?.incidentId === incident.incidentId}
                    />
                  ))
                )}
                {showDemoPreview && (
                  <section className="mt-8 border-t border-theme-divider pt-6" aria-label="Demo incident scenarios">
                    <div className="mb-4 flex items-center justify-between gap-2">
                      <h2 className="font-heading text-h3 text-theme-text-primary">Illustrative scenarios</h2>
                      <Badge variant="info">DEMO · NOT LIVE</Badge>
                    </div>
                    <div className="space-y-4">
                      {filteredDemoIncidents.map((incident) => (
                        <IncidentCard
                          key={incident.incidentId}
                          incident={incident}
                          locationName={monitoredLocations.find((location) => location.locationId === incident.locationId)?.city}
                          onClick={() => handleIncidentSelect(incident.incidentId)}
                          isSelected={selectedIncident?.incidentId === incident.incidentId}
                        />
                      ))}
                      {filteredDemoIncidents.length === 0 && (
                        <p className="py-4 text-center text-sm text-theme-text-muted">No demo scenarios match these filters.</p>
                      )}
                    </div>
                  </section>
                )}
              </div>
            </motion.aside>
          </div>
        ) : (
          <div className="container py-8">
            <motion.div
              className="space-y-4"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              {filteredIncidents.length === 0 ? (
                <Card variant="outlined" padding="xl" className="text-center">
                  <span className="text-5xl mb-4 block text-theme-accent">✓</span>
                  <h2 className="font-heading text-h2 text-theme-text-primary mb-2">
                    {activeIncidents.length === 0 ? 'No Active Incidents' : 'No incidents match these filters'}
                  </h2>
                  <p className="text-theme-text-secondary">
                    {activeIncidents.length === 0
                      ? monitoringActive
                        ? `Monitoring is active across ${monitoredLocations.filter((location) => location.monitoringEnabled).length} locations. This view updates as risk thresholds are reached.`
                        : 'Automated monitoring is paused. Start the backend monitoring service to detect new incidents.'
                      : 'Try changing the location, type, or severity filters.'}
                  </p>
                </Card>
              ) : (
                filteredIncidents.map((incident) => (
                  <IncidentCard
                    key={incident.incidentId}
                    incident={incident}
                    locationName={monitoredLocations.find(l => l.locationId === incident.locationId)?.city}
                    onClick={() => handleIncidentSelect(incident.incidentId)}
                    isSelected={selectedIncident?.incidentId === incident.incidentId}
                  />
                ))
              )}
            </motion.div>
          </div>
        )}

        {/* Incident Detail Modal */}
        {selectedIncident && (
          <IncidentDetail
            incident={selectedIncident}
            timeline={EMPTY_INCIDENT_TIMELINE}
            locationName={monitoredLocations.find(l => l.locationId === selectedIncident.locationId)?.city}
            onClose={() => { setSelectedIncident(null); setIncidentDetailOpen(false); }}
          />
        )}
      </main>
    </div>
  );
}