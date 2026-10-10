import type {
  ClimateRiskResponse,
  AIExplanation,
  ChatMessage,
  ChatResponse,
  EnvironmentalObservation,
  Incident,
  IncidentAIExplanation,
  MonitoringTriggerResponse,
  IncidentSummaryResponse,
  IncidentTimelineResponse,
  Location,
  SearchResult,
  SimulationParams,
  SimulationResponse,
} from '@/types';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  // Climate Intelligence
  searchLocations: (query: string, limit = 10, options?: Pick<RequestInit, 'signal'>) => {
    const params = new URLSearchParams({ q: query, limit: String(limit) });
    return fetchJson<SearchResult[]>(`/api/locations/search?${params}`, options);
  },

  getClimateRisk: (locationId: string) =>
    fetchJson<ClimateRiskResponse>(`/api/climate/${locationId}`),

  explainClimateRisk: (locationId: string) =>
    fetchJson<AIExplanation>(`/api/climate/${locationId}/explain`, { method: 'POST' }),

  chatAboutClimate: (locationId: string, messages: ChatMessage[]) =>
    fetchJson<ChatResponse>(`/api/climate/${locationId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),

  getClimateHistory: (locationId: string, hours = 24) =>
    fetchJson<{ locationId: string; hours: number; observations: EnvironmentalObservation[] }>(
      `/api/climate/${locationId}/history?hours=${hours}`
    ),

  // Simulation
  runSimulation: (locationId: string, params: SimulationParams) =>
    fetchJson<SimulationResponse>(`/api/climate/${locationId}/simulate`, {
      method: 'POST',
      body: JSON.stringify(params),
    }),

  getSimulation: (simulationId: string) =>
    fetchJson<SimulationResponse>(`/api/simulations/${simulationId}`),

  // Emergency Ops
  getActiveIncidents: () =>
    fetchJson<Incident[]>(`/api/incidents/active`),

  getDemoIncidents: () =>
    fetchJson<Incident[]>(`/api/incidents/demo-preview`),

  getIncidentsSummary: () =>
    fetchJson<IncidentSummaryResponse>(`/api/incidents/summary`),

  getIncident: (incidentId: string) =>
    fetchJson<Incident>(`/api/incidents/${incidentId}`),

  explainIncident: (incidentId: string) =>
    fetchJson<IncidentAIExplanation>(`/api/incidents/${incidentId}/explain`, { method: 'POST' }),

  chatAboutIncident: (incidentId: string, messages: ChatMessage[]) =>
    fetchJson<ChatResponse>(`/api/incidents/${incidentId}/chat`, {
      method: 'POST',
      body: JSON.stringify({ messages }),
    }),

  getIncidentTimeline: (incidentId: string) =>
    fetchJson<IncidentTimelineResponse>(`/api/incidents/${incidentId}/timeline`),

  simulateIncident: (locationId: string, incidentType: string, severity = 'WARNING') =>
    fetchJson<{ simulation: boolean; incident: Incident; message: string }>(
      `/api/incidents/simulate?location_id=${locationId}&incident_type=${incidentType}&severity=${severity}`,
      { method: 'POST' }
    ),

  // Monitoring
  getMonitoredLocations: () =>
    fetchJson<Location[]>(`/api/monitoring/locations`),

  getMonitoringStatus: () =>
    fetchJson<{ monitoring_active: boolean; interval_minutes: number; summary: IncidentSummaryResponse }>(
      `/api/monitoring/status`
    ),

  triggerMonitoring: () =>
    fetchJson<MonitoringTriggerResponse>(
      `/api/monitoring/trigger`,
      { method: 'POST' }
    ),

  // Health
  healthCheck: () =>
    fetchJson<{ status: string; service: string; version: string; environment: string }>(`/health`),
};

export type { SearchResult, ClimateRiskResponse, EnvironmentalObservation, RiskAssessment, Incident, IncidentTimelineResponse, IncidentSummaryResponse, SimulationParams, SimulationResponse, Location } from '@/types';