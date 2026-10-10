'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { RiskGauge } from '@/components/climate/RiskGauge';
import { AIInsight } from '@/components/climate/AIInsight';
import { ContextChat } from '@/components/climate/ContextChat';
import { AlertTriangle, Clock, MapPin, Droplets, Thermometer, Sun, CloudRain } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { api } from '@/lib/api';
import type { ClimateRiskDetail, Incident, IncidentObservation, IncidentAIExplanation } from '@/types';

interface IncidentDetailProps {
  incident: Incident;
  timeline: IncidentObservation[];
  riskDetail?: ClimateRiskDetail;
  locationName?: string;
  onClose: () => void;
  className?: string;
}

const TYPE_CONFIG = {
  HEAT: { icon: '🌡️', label: 'Heat', color: 'risk-high', lucide: Thermometer },
  FLOOD: { icon: '🌊', label: 'Flood', color: 'risk-medium', lucide: Droplets },
  HEAVY_RAIN: { icon: '🌧️', label: 'Heavy Rain', color: 'risk-medium', lucide: CloudRain },
  WATER_STRESS: { icon: '💧', label: 'Water Stress', color: 'risk-low', lucide: Droplets },
  DROUGHT: { icon: '☀️', label: 'Drought', color: 'risk-high', lucide: Sun },
};

export function IncidentDetail({
  incident,
  timeline,
  riskDetail,
  locationName,
  onClose,
  className,
}: IncidentDetailProps) {
  const typeConfig = TYPE_CONFIG[incident.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.FLOOD;
  const LucideIcon = typeConfig.lucide;
  const isDemo = incident.source?.startsWith('DEMO SCENARIO') ?? false;
  const sourceLabel = incident.source?.split('; Updated:')[0] || 'Automated detection';
  const [currentRiskDetail, setCurrentRiskDetail] = useState(riskDetail);
  const [currentTimeline, setCurrentTimeline] = useState(timeline);
  const [timelineError, setTimelineError] = useState<string | null>(null);
  const [aiExplanation, setAIExplanation] = useState<IncidentAIExplanation | null>(null);
  const [aiLoading, setAILoading] = useState(false);
  const [aiError, setAIError] = useState<string | null>(null);
  const [aiRequest, setAIRequest] = useState(0);

  useEffect(() => {
    if (isDemo) return;

    let cancelled = false;
    setCurrentRiskDetail(undefined);
    api.getClimateRisk(incident.locationId).then(({ risk }) => {
      if (cancelled) return;
      setCurrentRiskDetail({
        heat: { score: risk.heatRisk, severity: risk.heatSeverity, factors: risk.contributingFactors.heat ?? [] },
        flood: { score: risk.floodRisk, severity: risk.floodSeverity, factors: risk.contributingFactors.flood ?? [] },
        water_stress: { score: risk.waterStressRisk, severity: risk.waterStressSeverity, factors: risk.contributingFactors.water_stress ?? [] },
        drought: { score: risk.droughtRisk, severity: risk.droughtSeverity, factors: risk.contributingFactors.drought ?? [] },
      });
    }).catch(() => {
      if (!cancelled) setCurrentRiskDetail(undefined);
    });

    return () => {
      cancelled = true;
    };
  }, [incident.locationId, isDemo]);

  useEffect(() => {
    setCurrentTimeline(timeline);
    setTimelineError(null);
    if (isDemo || timeline.length > 0) return;

    let cancelled = false;
    api.getIncidentTimeline(incident.incidentId).then((response) => {
      if (cancelled) return;
      setCurrentTimeline(response.timeline);
      setTimelineError(null);
    }).catch((error: unknown) => {
      if (!cancelled) {
        setTimelineError(error instanceof Error ? error.message : 'Unable to load incident history.');
      }
    });

    return () => {
      cancelled = true;
    };
  }, [incident.incidentId, isDemo, timeline]);

  useEffect(() => {
    if (isDemo) return;

    let cancelled = false;
    setAIExplanation(null);
    setAILoading(true);
    setAIError(null);
    api.explainIncident(incident.incidentId).then((explanation) => {
      if (!cancelled) setAIExplanation(explanation);
    }).catch((error: unknown) => {
      if (!cancelled) {
        setAIError(error instanceof Error ? error.message : 'Unable to load AI incident analysis.');
      }
    }).finally(() => {
      if (!cancelled) setAILoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [incident.incidentId, isDemo, aiRequest]);

  return (
    <motion.div
      className={cn('fixed inset-0 z-50 flex justify-end', className)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="incident-detail-title"
    >
      <motion.div
        className="absolute inset-0 z-0 bg-black/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        aria-hidden="true"
      />
      <motion.div
        className="relative z-10 flex w-full max-w-4xl flex-col h-full overflow-y-auto border-l border-theme-border bg-theme-bg-primary"
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-theme-divider sticky top-0 bg-theme-bg-primary/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close incident detail">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-2xl" aria-hidden="true">{typeConfig.icon}</span>
                <h2 id="incident-detail-title" className="font-heading text-h2 text-theme-text-primary">
                  {typeConfig.label} Incident
                </h2>
              </div>
              <p className="text-body-sm text-theme-text-muted">{locationName || incident.locationId}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="risk" riskLevel={incident.severity as any} size="lg">
              {incident.severity}
            </Badge>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Risk Overview */}
          <motion.div className="grid grid-cols-1 lg:grid-cols-3 gap-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <Card variant="elevated" className="lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-heading text-h3 text-theme-text-primary flex items-center gap-2">
                  <LucideIcon className="w-5 h-5" aria-hidden="true" />
                  Current Risk Assessment
                </h3>
                <Badge variant="risk" riskLevel={incident.severity as any}>
                  Risk Score: {incident.riskScore}%
                </Badge>
              </div>
              {currentRiskDetail ? (
                <RiskGauge risks={currentRiskDetail} size={280} interactive={false} showLabels={true} />
              ) : (
                <p className="text-sm text-theme-text-muted">Current risk breakdown is unavailable.</p>
              )}
            </Card>

            <Card variant="elevated">
              <h3 className="font-heading text-h3 text-theme-text-primary mb-4">Incident Details</h3>
              <dl className="space-y-4">
                <div>
                  <dt className="text-sm text-theme-text-muted">Status</dt>
                  <dd className="flex items-center gap-2 mt-1">
                    <span className={cn('w-2 h-2 rounded-full', incident.status === 'RESOLVED' ? 'bg-forest-500' : 'bg-risk-critical animate-pulse')} />
                    <span className="font-medium text-theme-text-primary capitalize">{incident.status.toLowerCase()}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-theme-text-muted">Type</dt>
                  <dd className="font-medium text-theme-text-primary mt-1">{typeConfig.label}</dd>
                </div>
                <div>
                  <dt className="text-sm text-theme-text-muted">Severity</dt>
                  <dd className="font-medium text-theme-text-primary mt-1">{incident.severity}</dd>
                </div>
                <div>
                  <dt className="text-sm text-theme-text-muted">Risk Score</dt>
                  <dd className="font-mono text-2xl font-bold text-theme-text-primary mt-1">{incident.riskScore}%</dd>
                </div>
                <div>
                  <dt className="text-sm text-theme-text-muted">Created</dt>
                  <dd className="font-medium text-theme-text-primary mt-1">{formatDateTime(incident.createdAt)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-theme-text-muted">Last Updated</dt>
                  <dd className="font-medium text-theme-text-primary mt-1">{formatDateTime(incident.lastUpdated)}</dd>
                </div>
                <div>
                  <dt className="text-sm text-theme-text-muted">Next Check</dt>
                  <dd className="font-medium text-theme-text-primary mt-1">{incident.nextCheck ? formatDateTime(incident.nextCheck) : '—'}</dd>
                </div>
                <div>
                  <dt className="text-sm text-theme-text-muted">Source</dt>
                  <dd className="font-medium text-theme-text-primary mt-1">{sourceLabel}</dd>
                </div>
              </dl>
            </Card>
          </motion.div>

          {/* Why Emergency */}
          <motion.div className="card-organic p-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <h3 className="font-heading text-h3 text-theme-text-primary mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-risk-high" aria-hidden="true" />
              {isDemo ? 'Scenario context' : 'Incident context'}
            </h3>
            <p className="text-body text-theme-text-secondary">
              {isDemo
                ? 'This is a synthetic training scenario for exploring the response workflow. Its risk score and status are illustrative and do not describe current conditions.'
                : `This incident was reported by ${sourceLabel}. Review the AI analysis, linked observations, and official local advisories before making response decisions.`}
            </p>
          </motion.div>

          {!isDemo && incident.type === 'DROUGHT' && (
            <Card variant="elevated">
              <h3 className="font-heading text-h3 text-theme-text-primary mb-2">Resolution target</h3>
              <p className="text-body text-theme-text-secondary">
                This drought watch clears after a monitoring reassessment brings the risk below 30%.
                Follow the recommendations and verify water restrictions with local authorities;
                individual actions cannot guarantee when regional conditions will recover.
              </p>
            </Card>
          )}

          {/* AI Explanation */}
          {!isDemo && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <AIInsight
                title="AI Incident Analysis"
                explanation={{
                  summary: aiExplanation?.why_emergency ?? '',
                  key_factors: aiExplanation?.key_factors ?? [],
                  recommendations: aiExplanation?.immediate_actions ?? [],
                  potential_impacts: aiExplanation?.escalation_scenarios ?? [],
                }}
                isLoading={aiLoading}
                error={aiError}
                onRegenerate={() => setAIRequest((request) => request + 1)}
              />
              {aiExplanation && aiExplanation.monitoring_priorities.length > 0 && (
                <Card variant="elevated" className="mt-4">
                  <h3 className="font-heading text-h3 text-theme-text-primary mb-3">What to monitor</h3>
                  <ul className="space-y-2 text-sm text-theme-text-secondary">
                    {aiExplanation.monitoring_priorities.map((priority) => (
                      <li key={priority} className="flex gap-2">
                        <span aria-hidden="true">•</span>
                        <span>{priority}</span>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <ContextChat
                key={incident.incidentId}
                className="mt-4"
                title="Ask about this incident"
                description="Discuss the current incident, response options, and what could change its risk."
                suggestions={[
                  'What should responders prioritize first?',
                  'What could make this incident worse?',
                  'How will we know the risk is improving?',
                ]}
                onSend={async (messages) => (await api.chatAboutIncident(incident.incidentId, messages)).reply}
              />
            </motion.div>
          )}

          {/* Timeline */}
          <motion.div className="card-organic p-4" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <h3 className="font-heading text-h3 text-theme-text-primary mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" aria-hidden="true" />
              Live Timeline
            </h3>
            <div className="space-y-3">
              {currentTimeline.map((entry, index) => (
                <motion.div
                  key={`${entry.incidentId}-${entry.timestamp}`}
                  className="flex items-start gap-3 p-3 rounded-organic-sm bg-theme-bg-secondary border border-theme-border"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.05 * index }}
                >
                  <div className="flex-shrink-0 w-10 text-right text-theme-text-muted font-mono text-xs">
                    {formatTime(entry.timestamp)}
                  </div>
                  <div className="flex-1">
                    <p className="text-body text-theme-text-primary">{getTimelineMessage(entry)}</p>
                    <div className="flex flex-wrap gap-2 mt-2 text-xs text-theme-text-muted">
                      {entry.rainfall != null && <span>🌧️ {entry.rainfall}mm</span>}
                      {entry.temperature != null && <span>🌡️ {entry.temperature}°C</span>}
                      {entry.riverLevel != null && <span>🌊 {entry.riverLevel}m</span>}
                      <span className={cn('badge badge-risk-', entry.severity.toLowerCase())}>{entry.severity}</span>
                    </div>
                  </div>
                </motion.div>
              ))}
              {timelineError && (
                <p className="text-sm text-theme-text-muted" role="status">{timelineError}</p>
              )}
              {!timelineError && currentTimeline.length === 0 && (
                <p className="text-sm text-theme-text-muted">No observation history is recorded for this incident yet.</p>
              )}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getTimelineMessage(entry: IncidentObservation): string {
  const messages: string[] = [];
  if (entry.rainfall != null) messages.push(`Rainfall: ${entry.rainfall}mm`);
  if (entry.temperature != null) messages.push(`Temperature: ${entry.temperature}°C`);
  if (entry.riverLevel != null) messages.push(`River level: ${entry.riverLevel}m`);
  if (entry.riskScore !== undefined) messages.push(`Risk score: ${entry.riskScore}%`);
  return messages.join(' • ') || 'Monitoring update';
}