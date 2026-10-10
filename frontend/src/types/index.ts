export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RiskType = 'heat' | 'flood' | 'water_stress' | 'drought';
export type IncidentType = 'HEAT' | 'FLOOD' | 'HEAVY_RAIN' | 'WATER_STRESS' | 'DROUGHT';
export type IncidentSeverity = 'WARNING' | 'CRITICAL' | 'EXTREME';
export type IncidentStatus = 'MONITORING' | 'ACTIVE' | 'WARNING' | 'CRITICAL' | 'EXTREME' | 'RECOVERY' | 'RESOLVED';

export interface Location {
  locationId: string;
  country: string;
  state?: string;
  district?: string;
  city?: string;
  latitude: number;
  longitude: number;
  monitoringEnabled?: boolean;
  riskTypes?: string[];
}

export interface WeatherData {
  temperature?: number;
  humidity?: number;
  rainfall?: number;
  windSpeed?: number;
  pressure?: number;
}

export interface WaterData {
  riverLevel?: number;
  riverLevelTrend?: 'RISING' | 'FALLING' | 'STABLE';
}

export interface AlertData {
  type: string;
  severity: string;
  description: string;
  issuedAt: string;
  expiresAt?: string;
}

export interface EnvironmentalObservation {
  locationId: string;
  timestamp: string;
  weather?: WeatherData;
  water?: WaterData;
  alerts: AlertData[];
  source: string;
  rawData?: Record<string, unknown>;
}

export interface RiskFactorDetail {
  score: number;
  severity: RiskLevel;
  factors: string[];
}

export interface ClimateRiskDetail {
  heat: RiskFactorDetail;
  flood: RiskFactorDetail;
  water_stress: RiskFactorDetail;
  drought: RiskFactorDetail;
}

export interface RiskAssessment {
  locationId: string;
  timestamp: string;
  heatRisk: number;
  floodRisk: number;
  waterStressRisk: number;
  droughtRisk: number;
  heatSeverity: RiskLevel;
  floodSeverity: RiskLevel;
  waterStressSeverity: RiskLevel;
  droughtSeverity: RiskLevel;
  contributingFactors: Record<RiskType, string[]>;
  dataSources: string[];
}

export interface ClimateRiskResponse {
  location: Location;
  observation: EnvironmentalObservation;
  risk: RiskAssessment;
}

export interface Incident {
  incidentId: string;
  locationId: string;
  type: IncidentType;
  severity: IncidentSeverity;
  status: IncidentStatus;
  riskScore: number;
  source?: string;
  createdAt: string;
  lastUpdated: string;
  lastChecked?: string;
  nextCheck?: string;
}

export interface IncidentObservation {
  incidentId: string;
  timestamp: string;
  rainfall?: number;
  temperature?: number;
  riverLevel?: number;
  riskScore: number;
  severity: IncidentSeverity;
  source: string;
}

export interface IncidentTimelineResponse {
  incidentId: string;
  incident: Incident;
  timeline: IncidentObservation[];
}

export interface IncidentSummaryResponse {
  total: number;
  by_type: Record<string, number>;
  by_severity: Record<string, number>;
  by_status: Record<string, number>;
  critical_count: number;
  high_risk_count: number;
}

export interface MonitoringTriggerResponse {
  locations_checked: number;
  incidents_created: number;
  incidents_updated: number;
  incidents_resolved: number;
  errors?: Array<{ locationId: string; message: string }>;
}

export interface SimulationParams {
  temperature_change?: number;
  humidity_change?: number;
  rainfall_change_pct?: number;
  rainfall_change_mm?: number;
  river_level_change?: number;
  river_trend?: 'RISING' | 'FALLING' | 'STABLE';
  add_alert?: Record<string, unknown>;
  remove_alert_type?: string;
}

export interface SimulationComparison {
  original: number;
  simulated: number;
  change: number;
  change_pct: number;
  worsened: boolean;
}

export interface SimulationResponse {
  simulationId: string;
  locationId: string;
  scenario: SimulationParams;
  originalRisks: Record<RiskType, number>;
  simulatedRisks: Record<RiskType, number>;
  comparison: Record<RiskType, SimulationComparison>;
  summary: string;
  aiExplanation?: Record<string, unknown>;
  createdAt: string;
}

export interface AIExplanation {
  summary: string;
  key_factors: string[];
  recommendations: string[];
  potential_impacts: string[];
}

export interface IncidentAIExplanation {
  why_emergency: string;
  key_factors: string[];
  immediate_actions: string[];
  monitoring_priorities: string[];
  escalation_scenarios: string[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
}

export interface SimulationAIExplanation {
  summary: string;
  most_affected_risks: string[];
  implications: string[];
  threat_level: string;
}

export interface SearchResult {
  locationId: string;
  country: string;
  state?: string;
  district?: string;
  city?: string;
  latitude: number;
  longitude: number;
  source: string;
}

export interface WebSocketMessage {
  type: 'incident_created' | 'incident_updated' | 'incident_resolved' | 'risk_update' | 'summary_update';
  timestamp: string;
  data: unknown;
}

export interface ThemeTokens {
  bgPrimary: string;
  bgSecondary: string;
  bgAccent: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentGlow: string;
  border: string;
  divider: string;
  shadow: string;
  shadowHover: string;
}