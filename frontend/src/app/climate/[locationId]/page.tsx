'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { SearchAutocomplete } from '@/components/climate/SearchAutocomplete';
import { RiskGauge } from '@/components/climate/RiskGauge';
import { RiskBadge } from '@/components/climate/RiskBadge';
import { AIInsight } from '@/components/climate/AIInsight';
import { ContextChat } from '@/components/climate/ContextChat';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SimulationDrawer } from '@/components/simulation/SimulationDrawer';
import { MapPin, Clock, TrendingUp, Share2, Download, Zap, Droplets, Sun, CloudRain, Thermometer } from 'lucide-react';
import { useLocationStore, useSimulationStore } from '@/store';
import { api } from '@/lib/api';
import type { AIExplanation, ClimateRiskResponse, ClimateRiskDetail, SearchResult } from '@/types';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';

const RISK_CONFIG = {
  heat: { label: 'Heat Risk', icon: Thermometer, color: 'risk-high', unit: '°C', trendLabel: 'Temp' },
  flood: { label: 'Flood Risk', icon: Droplets, color: 'risk-medium', unit: 'mm', trendLabel: 'Rain' },
  water_stress: { label: 'Water Stress', icon: Sun, color: 'risk-low', unit: '%', trendLabel: 'Deficit' },
  drought: { label: 'Drought Risk', icon: CloudRain, color: 'risk-high', unit: '%', trendLabel: 'Soil' },
};

export default function ClimateDetailPage() {
  const router = useRouter();
  const params = useParams();
  const locationId = params.locationId as string;
  const { selectedLocation, setSelectedLocation, searchResults } = useLocationStore();
  const { setActive: setSimulationActive } = useSimulationStore();

  const [data, setData] = useState<ClimateRiskResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [simulationOpen, setSimulationOpen] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<AIExplanation | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  useEffect(() => {
    if (locationId) {
      fetchClimateData(locationId);
    }
  }, [locationId]);

  const fetchClimateData = async (id: string) => {
    setIsLoading(true);
    setError(null);
    setAiExplanation(null);
    setAiError(null);
    try {
      const result = await api.getClimateRisk(id);
      setData(result);
      void generateAIInsight(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch climate data');
    } finally {
      setIsLoading(false);
    }
  };

  const generateAIInsight = async (id: string) => {
    setAiLoading(true);
    setAiError(null);
    try {
      setAiExplanation(await api.explainClimateRisk(id));
    } catch (err) {
      setAiExplanation(null);
      setAiError(err instanceof Error ? err.message : 'AI climate analysis is unavailable.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleSearch = (location: SearchResult) => {
    setSelectedLocation(location);
    router.push(`/climate/${location.locationId}`);
  };

  const handleSimulate = () => {
    setSimulationOpen(true);
    setSimulationActive(true);
  };

  if (isLoading && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">🌱</div>
          <p className="text-theme-text-secondary">Loading climate data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card variant="outlined" padding="xl" className="max-w-md mx-auto">
          <div className="text-center">
            <span className="text-6xl mb-4 block">⚠️</span>
            <h2 className="font-heading text-h2 text-theme-text-primary mb-2">Unable to Load Data</h2>
            <p className="text-theme-text-secondary mb-6">{error}</p>
            <Button variant="primary" onClick={() => fetchClimateData(locationId)}>
              Try Again
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  const { location, observation, risk } = data;
  const locationName = `${location.city || location.district || location.state}, ${location.country}`;
  const riskDetails: ClimateRiskDetail = {
    heat: { score: risk.heatRisk, severity: risk.heatSeverity, factors: risk.contributingFactors.heat ?? [] },
    flood: { score: risk.floodRisk, severity: risk.floodSeverity, factors: risk.contributingFactors.flood ?? [] },
    water_stress: { score: risk.waterStressRisk, severity: risk.waterStressSeverity, factors: risk.contributingFactors.water_stress ?? [] },
    drought: { score: risk.droughtRisk, severity: risk.droughtSeverity, factors: risk.contributingFactors.drought ?? [] },
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-40 glass px-6 py-4">
        <div className="container flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Button>
          <div className="flex-1 text-center">
            <h1 className="font-heading text-h2 text-theme-text-primary truncate">{locationName}</h1>
            <p className="text-sm text-theme-text-muted">
              {location.latitude.toFixed(2)}°N, {location.longitude.toFixed(2)}°E
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleSimulate}>
              <Zap className="w-4 h-4 mr-2" />
              Simulate
            </Button>
            <Button variant="ghost" size="sm">
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
            <Button variant="ghost" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </header>

      {/* Search Bar (Mobile) */}
      <div className="lg:hidden px-6 py-4 border-b border-theme-divider">
        <SearchAutocomplete
          value={searchQuery}
          onChange={setSearchQuery}
          onSearch={handleSearch}
          placeholder="Search another location..."
        />
      </div>

      <main className="container py-8 px-6">
        {/* Risk Gauge - Large */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <RiskGauge
            risks={riskDetails}
            size={360}
            interactive
            showLabels={true}
          />
        </motion.section>

        {/* Risk Detail Cards */}
        <motion.section
          className="grid-organic mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          {(['heat', 'flood', 'water_stress', 'drought'] as const).map((riskType) => {
            const r = riskDetails[riskType];
            const config = RISK_CONFIG[riskType];
            const Icon = config.icon;

            return (
              <motion.article
                key={riskType}
                className="card-organic group p-6"
                whileHover={{ y: -4 }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + ['heat', 'flood', 'water_stress', 'drought'].indexOf(riskType) * 0.08 }}
              >
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-12 h-12 rounded-organic-sm flex items-center justify-center text-xl',
                      `bg-${config.color.replace('risk-', '')}-100 dark:bg-${config.color.replace('risk-', '')}-900 text-${config.color.replace('risk-', '')}-600 dark:text-${config.color.replace('risk-', '')}-400`
                    )}>
                      <Icon className="w-6 h-6" aria-hidden="true" />
                    </div>
                    <div>
                      <h3 className="font-heading text-h3 text-theme-text-primary">{config.label}</h3>
                      <p className="text-body-sm text-theme-text-muted">{r.factors.length} contributing factors</p>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <RiskBadge
                      score={r.score}
                      label={config.label}
                      size="lg"
                      animate
                      showTrend={r.factors.some(f => f.includes('Rising') || f.includes('rising')) ? 'up' : r.factors.some(f => f.includes('Falling') || f.includes('falling')) ? 'down' : 'stable'}
                      trendValue={0}
                    />
                  </div>
                </div>

                <div className="h-2 bg-theme-bg-accent rounded-full overflow-hidden mb-4">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ backgroundColor: `var(--${config.color})` }}
                    initial={{ width: 0 }}
                    animate={{ width: `${r.score}%` }}
                    transition={{ duration: 1, delay: 0.2, ease: [0.4, 0, 0.2, 1] }}
                  />
                </div>

                <div className="space-y-2">
                  {r.factors.slice(0, 3).map((factor, i) => (
                    <motion.div
                      key={i}
                      className="flex items-center gap-2 text-sm text-theme-text-secondary p-2 rounded-organic-sm bg-theme-bg-primary border border-theme-border"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.05 }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-theme-accent flex-shrink-0" />
                      <span>{factor}</span>
                    </motion.div>
                  ))}
                  {r.factors.length > 3 && (
                    <Button variant="ghost" size="sm" className="w-full justify-start text-theme-text-muted">
                      +{r.factors.length - 3} more factors
                    </Button>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-theme-divider flex items-center justify-between text-sm">
                  <span className="text-theme-text-muted">Trend: {r.factors.some(f => f.includes('Rising') || f.includes('rising')) ? '↗ Rising' : r.factors.some(f => f.includes('Falling') || f.includes('falling')) ? '↘ Falling' : '→ Stable'}</span>
                  <span className="text-theme-text-muted">Sources: {risk.dataSources.join(', ')}</span>
                </div>
              </motion.article>
            );
          })}
        </motion.section>

        {/* AI Insight */}
        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <AIInsight
            explanation={aiExplanation}
            isLoading={aiLoading}
            error={aiError}
            onRegenerate={() => generateAIInsight(locationId)}
          />
        </motion.section>

        <motion.section
          className="mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
        >
          <ContextChat
            key={locationId}
            title={`Ask about ${location.city || location.district || 'this place'}`}
            description="Get contextual answers about local weather, climate risks, and practical preparation."
            suggestions={[
              'What does the highest risk score mean?',
              'What should I watch over the next few days?',
              'What practical steps can residents take?',
            ]}
            onSend={async (messages) => (await api.chatAboutClimate(locationId, messages)).reply}
          />
        </motion.section>

        {/* Trends & Forecast */}
        <motion.section
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card variant="elevated" padding="lg">
            <h3 className="font-heading text-h3 text-theme-text-primary mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              24-Hour Risk Trends
            </h3>
            <div className="space-y-4">
              {(['heat', 'flood', 'water_stress', 'drought'] as const).map((riskType) => {
                const r = riskDetails[riskType];
                return (
                  <div key={riskType} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-2 text-sm">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `var(--${RISK_CONFIG[riskType].color})` }} />
                        <span className="font-medium text-theme-text-primary">{RISK_CONFIG[riskType].label}</span>
                      </span>
                      <span className="font-mono text-theme-text-primary">{r.score}%</span>
                    </div>
                    <div className="h-16 relative">
                      <TrendSparkline data={generateMockTrend(r.score)} color={`var(--${RISK_CONFIG[riskType].color})`} />
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card variant="elevated" padding="lg">
            <h3 className="font-heading text-h3 text-theme-text-primary mb-4 flex items-center gap-2">
              <CloudRain className="w-5 h-5" />
              7-Day Forecast Summary
            </h3>
            <div className="space-y-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-organic-sm bg-theme-bg-primary border border-theme-border">
                  <span className="text-sm font-medium text-theme-text-primary">
                    {new Date(Date.now() + i * 86400000).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}
                  </span>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="flex items-center gap-1 text-risk-high">🌡️ {35 + Math.random() * 5}°C</span>
                    <span className="flex items-center gap-1 text-risk-medium">🌧️ {Math.random() * 20}mm</span>
                    <span className="flex items-center gap-1 text-risk-low">💧 {60 + Math.random() * 20}%</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.section>
      </main>

      {/* Simulation Drawer */}
      <SimulationDrawer
        isOpen={simulationOpen}
        onClose={() => { setSimulationOpen(false); setSimulationActive(false); }}
        locationId={locationId}
        originalRisks={riskDetails}
        onRunSimulation={async (params) => {
          try {
            const result = await api.runSimulation(locationId, params);
            // Update simulation store with results
          } catch (err) {
            console.error('Simulation failed:', err);
          }
        }}
      />
    </div>
  );
}

function TrendSparkline({ data, color }: { data: number[]; color: string }) {
  const width = 200;
  const height = 64;
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - (value / 100) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="w-full h-full" aria-hidden="true">
      <defs>
        <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path
        d={`M${points}`}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="animate-draw"
        style={{ strokeDasharray: '1000', strokeDashoffset: '1000' }}
      />
      <path
        d={`M${points} L${width},${height} L0,${height} Z`}
        fill="url(#gradient)"
      />
    </svg>
  );
}

function generateMockTrend(current: number): number[] {
  const data = [current];
  for (let i = 1; i < 24; i++) {
    const change = (Math.random() - 0.5) * 10;
    data.push(Math.max(0, Math.min(100, data[i - 1] + change)));
  }
  return data;
}